import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import { Role, VerificationTokenPurpose } from "@digital-clinic/database";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailProvider } from "../notifications/providers/email.provider";
import { hashPassword } from "./password.util";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function makePrismaMock() {
  const tx = {
    user: { create: jest.fn(), update: jest.fn() },
    clinic: { create: jest.fn() },
  };
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    loginEvent: { create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    refreshToken: { create: jest.fn(), updateMany: jest.fn() },
    verificationToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    clinic: { findUnique: jest.fn() },
    // AuthService uses both $transaction forms: the callback form
    // (registerClinic) and the array form (resetPassword, revoking every
    // session) — same dual-form mock as billing.service.spec.ts.
    $transaction: jest.fn((arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof tx) => unknown)(tx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    __tx: tx,
  } as unknown as PrismaService & { __tx: typeof tx };
}

function makeJwtMock() {
  return { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") } as unknown as JwtService;
}

function makeConfigMock() {
  return {
    get: jest.fn((key: string, fallback?: unknown) => fallback),
    getOrThrow: jest.fn(() => "test-secret"),
  } as unknown as ConfigService;
}

function makeEmailProviderMock() {
  return { send: jest.fn().mockResolvedValue({ status: "SENT" }) } as unknown as EmailProvider;
}

describe("AuthService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let jwt: ReturnType<typeof makeJwtMock>;
  let config: ReturnType<typeof makeConfigMock>;
  let emailProvider: ReturnType<typeof makeEmailProviderMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    jwt = makeJwtMock();
    config = makeConfigMock();
    emailProvider = makeEmailProviderMock();
    service = new AuthService(prisma, jwt, config, emailProvider);
  });

  describe("login", () => {
    const activeUser = {
      id: "user-1",
      email: "doc@example.com",
      passwordHash: hashPassword("correct-password"),
      isActive: true,
      isEmailVerified: true,
      role: Role.DOCTOR,
      clinicId: "clinic-1",
    };

    it("rejects an unknown email without revealing that it's unknown", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.login({ email: "nobody@example.com", password: "whatever1" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a wrong password and logs the failed attempt", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(activeUser);
      await expect(
        service.login({ email: activeUser.email, password: "wrong-password" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.loginEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", success: false }) }),
      );
    });

    it("rejects a deactivated account", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...activeUser, isActive: false });
      await expect(
        service.login({ email: activeUser.email, password: "correct-password" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects an unverified email, but still records it as a successful credential check", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...activeUser, isEmailVerified: false });
      await expect(
        service.login({ email: activeUser.email, password: "correct-password" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.loginEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ success: true }) }),
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("locks out an account after 5 recent failed attempts, even with the correct password", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(activeUser);
      (prisma.loginEvent.count as jest.Mock).mockResolvedValue(5);
      await expect(
        service.login({ email: activeUser.email, password: "correct-password" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("issues tokens and logs a successful attempt for correct, verified, active credentials", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(activeUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: "rt-1" });

      const result = await service.login({ email: activeUser.email, password: "correct-password" });

      expect(result.accessToken).toBe("signed.jwt.token");
      expect(prisma.loginEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", success: true }) }),
      );
      // Never leaks the password hash to the caller.
      expect(result.user).not.toHaveProperty("passwordHash");
    });
  });

  describe("registerClinic / registerPatient", () => {
    it("sends a verification email after creating a new clinic owner", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.clinic.findUnique as jest.Mock).mockResolvedValue(null);
      prisma.__tx.user.create.mockResolvedValue({ id: "new-user", email: "owner@example.com" });
      prisma.__tx.clinic.create.mockResolvedValue({ id: "new-clinic" });
      prisma.__tx.user.update.mockResolvedValue({
        id: "new-user",
        email: "owner@example.com",
        clinicId: "new-clinic",
      });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: "rt-1" });

      await service.registerClinic({
        clinicName: "Sunrise Clinic",
        slug: "sunrise",
        ownerName: "Dr. Rao",
        email: "owner@example.com",
        password: "password123",
      });

      // registerClinic fires this with `void` (a delivery failure shouldn't
      // fail registration), so only the deterministic, synchronously-called
      // part — the token being issued at all — is asserted here. The actual
      // email send is exercised end-to-end by requestPasswordReset and
      // resendVerification below, which both await it directly.
      expect(prisma.verificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "new-user", purpose: VerificationTokenPurpose.VERIFY_EMAIL }),
        }),
      );
    });
  });

  describe("requestPasswordReset", () => {
    it("silently no-ops for an unregistered email (no enumeration)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await service.requestPasswordReset("nobody@example.com");
      expect(prisma.verificationToken.create).not.toHaveBeenCalled();
      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it("issues a RESET_PASSWORD token and emails it for a real account", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", email: "a@example.com" });
      await service.requestPasswordReset("a@example.com");
      expect(prisma.verificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "user-1", purpose: VerificationTokenPurpose.RESET_PASSWORD }),
        }),
      );
      expect(emailProvider.send).toHaveBeenCalledWith(
        "a@example.com",
        expect.any(String),
        expect.stringContaining("/reset-password?token="),
      );
    });

    it("stores only a hash of the token, not the raw value that goes in the email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", email: "a@example.com" });
      await service.requestPasswordReset("a@example.com");

      const emailedBody = (emailProvider.send as jest.Mock).mock.calls[0][2] as string;
      const rawToken = new URL(
        emailedBody.match(/https?:\/\/\S+/)![0],
      ).searchParams.get("token")!;

      const storedHash = (prisma.verificationToken.create as jest.Mock).mock.calls[0][0].data.tokenHash;
      expect(storedHash).toBe(hashToken(rawToken));
      expect(storedHash).not.toBe(rawToken);
    });
  });

  describe("resetPassword", () => {
    it("rejects an unknown/expired/used token", async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.resetPassword("bad-token", "newpassword1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects a token for the wrong purpose (e.g. a verify-email token used to reset)", async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: "vt-1",
        userId: "user-1",
        purpose: VerificationTokenPurpose.VERIFY_EMAIL,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.resetPassword("some-token", "newpassword1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects setting the same password you already have", async () => {
      const currentHash = hashPassword("same-password");
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: "vt-1",
        userId: "user-1",
        purpose: VerificationTokenPurpose.RESET_PASSWORD,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", passwordHash: currentHash });

      await expect(service.resetPassword("some-token", "same-password")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("updates the password and revokes every existing session on success", async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: "vt-1",
        userId: "user-1",
        purpose: VerificationTokenPurpose.RESET_PASSWORD,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        passwordHash: hashPassword("old-password"),
      });

      await service.resetPassword("some-token", "brand-new-password");

      expect(prisma.verificationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "vt-1" }, data: { usedAt: expect.any(Date) } }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: { passwordHash: expect.any(String) },
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe("verifyEmail", () => {
    it("marks the user verified for a valid VERIFY_EMAIL token", async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: "vt-1",
        userId: "user-1",
        purpose: VerificationTokenPurpose.VERIFY_EMAIL,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.verifyEmail("some-token");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { isEmailVerified: true },
      });
    });

    it("rejects a token that's already been used", async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: "vt-1",
        userId: "user-1",
        purpose: VerificationTokenPurpose.VERIFY_EMAIL,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.verifyEmail("some-token")).rejects.toThrow(BadRequestException);
    });

    it("rejects an expired token", async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: "vt-1",
        userId: "user-1",
        purpose: VerificationTokenPurpose.VERIFY_EMAIL,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.verifyEmail("some-token")).rejects.toThrow(BadRequestException);
    });
  });

  describe("resendVerification", () => {
    it("silently no-ops for an unregistered email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await service.resendVerification("nobody@example.com");
      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it("silently no-ops for an already-verified account", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        isEmailVerified: true,
      });
      await service.resendVerification("a@example.com");
      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it("sends a fresh verification email for an unverified account", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        isEmailVerified: false,
      });
      await service.resendVerification("a@example.com");
      expect(emailProvider.send).toHaveBeenCalled();
    });
  });
});
