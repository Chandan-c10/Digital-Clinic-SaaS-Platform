import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import { ClinicPlan, ClinicStatus, Role, User } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterClinicDto } from "./dto/register-clinic.dto";
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), clinic, ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const passwordOk = user?.passwordHash ? verifyPassword(dto.password, user.passwordHash) : false;

    if (!user || !passwordOk) {
      if (user) {
        await this.prisma.loginEvent.create({
          data: { userId: user.id, success: false, ...meta },
        });
      }
      throw new UnauthorizedException("Invalid email or password");
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

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
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

  private async issueTokens(user: User, meta: RequestMeta = {}): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, clinicId: user.clinicId },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
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
    const { passwordHash: _passwordHash, twoFactorSecret: _twoFactorSecret, ...publicUser } = user;
    return publicUser;
  }
}
