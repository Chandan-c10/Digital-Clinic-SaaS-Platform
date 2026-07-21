import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { AuthService, RequestMeta } from "./auth.service";
import { RegisterClinicDto } from "./dto/register-clinic.dto";
import { RegisterPatientDto } from "./dto/register-patient.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register-clinic")
  registerClinic(@Body() dto: RegisterClinicDto) {
    return this.authService.registerClinic(dto);
  }

  @Public()
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

  private meta(req: Request): RequestMeta {
    return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
  }
}
