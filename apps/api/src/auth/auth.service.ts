import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import { ClinicPlan, ClinicStatus, Role, User, VerificationTokenPurpose } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { EmailProvider } from "../notifications/providers/email.provider";
import { RegisterClinicDto } from "./dto/register-clinic.dto";
import { RegisterPatientDto } from "./dto/register-patient.dto";
import { LoginDto } from "./dto/login.dto";
import { hashPassword, verifyPassword } from "./password.util";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const REFRESH_TOKEN_BYTES = 48;
const VERIFICATION_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h — short-lived, high-value action
const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48h — low-stakes, give people time

// QA/security audit, 2026-07-22, TC-AUTH-04: per-account lockout complementing
// (not replacing) the IP-based ThrottlerGuard on POST /auth/login — a
// credential-stuffing attempt spread across IPs, or behind a shared/NAT'd IP
// with throttler headroom, isn't slowed by the IP bucket alone.
const LOCKOUT_FAILURE_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailProvider: EmailProvider,
  ) {}

  async registerClinic(dto: RegisterClinicDto) {
    const [existingEmail, existingSlug] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.clinic.findUnique({ where: { slug: dto.slug } }),
    ]);
    if (existingEmail) throw new ConflictException("Email already registered");
    if (existingSlug) throw new ConflictException("That clinic URL is already taken");

    const passwordHash = hashPassword(dto.password);

    const { user, clinic } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.ownerName,
          email: dto.email,
          passwordHash,
          role: Role.CLINIC_OWNER,
        },
      });

      const createdClinic = await tx.clinic.create({
        data: {
          name: dto.clinicName,
          slug: dto.slug,
          plan: ClinicPlan.TRIAL,
          status: ClinicStatus.TRIALING,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          ownerId: createdUser.id,
          profile: { create: {} },
          website: { create: { template: "default" } },
        },
      });

      const linkedUser = await tx.user.update({
        where: { id: createdUser.id },
        data: { clinicId: createdClinic.id },
      });

      return { user: linkedUser, clinic: createdClinic };
    });

    void this.sendVerificationEmail(user);

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), clinic, ...tokens };
  }

  /**
   * Creates a Patient Portal login — `clinicId: null`, same as SUPER_ADMIN,
   * since a patient isn't scoped to one clinic (see the User model comment).
   * Deliberately does NOT try to auto-link this account to any existing
   * walk-in `Patient` rows matching this email/phone — guessing that link
   * risks attaching someone else's medical record to the wrong login. A
   * `Patient` row is created fresh, per clinic, the first time this user
   * books through the portal (see PatientPortalService.bookAppointment).
   */
  async registerPatient(dto: RegisterPatientDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash: hashPassword(dto.password),
        role: Role.PATIENT,
      },
    });

    void this.sendVerificationEmail(user);

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user && (await this.isAccountLocked(user.id))) {
      throw new UnauthorizedException(
        "Too many failed attempts on this account — try again in a few minutes",
      );
    }

    const passwordOk = user?.passwordHash ? verifyPassword(dto.password, user.passwordHash) : false;

    if (!user || !passwordOk || !user.isActive) {
      if (user) {
        await this.prisma.loginEvent.create({
          data: { userId: user.id, success: false, ...meta },
        });
      }
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isEmailVerified) {
      // Recorded as a successful credential check (it was one) — lockout
      // should count wrong *passwords*, not "right password, unverified".
      await this.prisma.loginEvent.create({
        data: { userId: user.id, success: true, ...meta },
      });
      throw new UnauthorizedException(
        "Please verify your email before logging in — check your inbox, or request a new link.",
      );
    }

    await this.prisma.loginEvent.create({
      data: { userId: user.id, success: true, ...meta },
    });

    const tokens = await this.issueTokens(user, meta);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Always resolves, whether or not the email is registered — the caller
   * (controller) returns the same generic "check your email" response
   * either way, so this can't be used to enumerate registered accounts.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const rawToken = await this.issueVerificationToken(
      user.id,
      VerificationTokenPurpose.RESET_PASSWORD,
      RESET_TOKEN_TTL_MS,
    );

    const link = `${this.frontendOrigin()}/reset-password?token=${rawToken}`;
    await this.sendEmail(
      // `email`, not `user.email` — Prisma types User.email as `string |
      // null` (it's an optional column), but this row was found *by* that
      // exact value, so the function's own non-null parameter is both
      // correct and avoids a spurious type error.
      email,
      "Reset your password",
      `We received a request to reset your password.\n\n${link}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.consumeVerificationToken(rawToken, VerificationTokenPurpose.RESET_PASSWORD);

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) throw new BadRequestException("This reset link is no longer valid");

    if (user.passwordHash && verifyPassword(newPassword, user.passwordHash)) {
      throw new BadRequestException("New password must be different from your current password");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(newPassword) },
      }),
      // A password reset should end every existing session, not just this
      // one device's — same reasoning as staff deactivation revoking tokens.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const record = await this.consumeVerificationToken(rawToken, VerificationTokenPurpose.VERIFY_EMAIL);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { isEmailVerified: true },
    });
  }

  /** Same non-enumerating shape as requestPasswordReset — always resolves. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isEmailVerified) return;
    await this.sendVerificationEmail(user);
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    if (!user.email) return;
    const rawToken = await this.issueVerificationToken(
      user.id,
      VerificationTokenPurpose.VERIFY_EMAIL,
      VERIFY_TOKEN_TTL_MS,
    );
    const link = `${this.frontendOrigin()}/verify-email?token=${rawToken}`;
    await this.sendEmail(
      user.email,
      "Verify your email",
      `Welcome — please confirm this is your email address.\n\n${link}\n\nThis link expires in 48 hours.`,
    );
  }

  private async issueVerificationToken(
    userId: string,
    purpose: VerificationTokenPurpose,
    ttlMs: number,
  ): Promise<string> {
    const rawToken = randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");
    await this.prisma.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return rawToken;
  }

  private async consumeVerificationToken(rawToken: string, purpose: VerificationTokenPurpose) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });

    if (
      !record ||
      record.purpose !== purpose ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException("This link is invalid or has expired");
    }

    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return record;
  }

  /** Never throws — a delivery failure (e.g. SMTP unconfigured in dev)
   * shouldn't fail the registration/reset request itself, same philosophy
   * as NotificationsService.send(). Logged via the provider's own result,
   * not surfaced here. */
  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.emailProvider.send(to, subject, body);
  }

  private frontendOrigin(): string {
    const raw = this.config.get<string>("API_CORS_ORIGIN", "http://localhost:3000");
    return raw.split(",")[0].trim();
  }

  private async isAccountLocked(userId: string): Promise<boolean> {
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
    const recentFailures = await this.prisma.loginEvent.count({
      where: { userId, success: false, createdAt: { gte: since } },
    });
    return recentFailures >= LOCKOUT_FAILURE_THRESHOLD;
  }

  private async issueTokens(user: User, meta: RequestMeta = {}): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, clinicId: user.clinicId },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
        algorithm: "HS256", // QA/security audit, TC-AUTH-08 — see jwt.strategy.ts
      },
    );

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const tokenHash = this.hashToken(refreshToken);
    const expiresInMs = this.parseRefreshTtlMs();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresInMs),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private parseRefreshTtlMs(): number {
    const raw = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "30d");
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
    return value * unitMs;
  }

  private toPublicUser(user: User) {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }
}
