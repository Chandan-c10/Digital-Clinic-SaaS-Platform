import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

/**
 * This route is @Public() (no JWT — the caller is an external cron pinger,
 * e.g. cron-job.org, not a logged-in user) so it needs its own auth: a
 * shared secret in a header, checked with a length-safe comparison isn't
 * critical here (this isn't a password/token guessing surface at the scale
 * of one daily ping) but we still reject on any mismatch or missing config.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("CRON_SECRET");
    if (!expected) {
      throw new UnauthorizedException("CRON_SECRET is not configured");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header("x-cron-secret");
    if (provided !== expected) {
      throw new UnauthorizedException("Invalid cron secret");
    }
    return true;
  }
}
