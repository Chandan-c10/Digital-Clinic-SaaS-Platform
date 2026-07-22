import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { AuthService, RequestMeta } from "./auth.service";
import { RegisterClinicDto } from "./dto/register-clinic.dto";
import { RegisterPatientDto } from "./dto/register-patient.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // QA/security audit, TC-SEC-08: registration is exactly the "public-facing
  // signup" surface the finding flagged as unprotected beyond the 100/min
  // global bucket.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register-clinic")
  registerClinic(@Body() dto: RegisterClinicDto) {
    return this.authService.registerClinic(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register-patient")
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.meta(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.meta(req));
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  // Same generic "if that email is registered, check it" response either
  // way — this is the only thing keeping it from being an account-existence
  // oracle, so don't let the branches below ever return something different
  // for "found" vs "not found".
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: "If that email is registered, a reset link has been sent." };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: "Password updated. Please log in again." };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("verify-email")
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: "Email verified." };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("resend-verification")
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
    return { message: "If that email is registered and unverified, a new link has been sent." };
  }

  private meta(req: Request): RequestMeta {
    return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
  }
}
