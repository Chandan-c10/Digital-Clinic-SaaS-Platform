import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators/public.decorator";

/** Render's healthCheckPath (see render.yaml) — must stay unauthenticated. */
@Controller()
export class AppController {
  @Public()
  @Get("health")
  health() {
    return { status: "ok" };
  }
}
