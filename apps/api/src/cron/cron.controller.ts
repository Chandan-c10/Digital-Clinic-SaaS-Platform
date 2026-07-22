import { Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { CronSecretGuard } from "./cron-secret.guard";
import { CronService } from "./cron.service";

/** Called by an external scheduler (cron-job.org) — see README § Deployment
 * for the exact schedule/header setup. Not a user-facing route. */
@Controller("internal/cron")
@Public()
@UseGuards(CronSecretGuard)
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post("appointment-reminders")
  @HttpCode(HttpStatus.OK)
  sendAppointmentReminders() {
    return this.cronService.sendAppointmentReminders();
  }
}
