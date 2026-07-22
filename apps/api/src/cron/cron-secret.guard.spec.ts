import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CronSecretGuard } from "./cron-secret.guard";

function makeContext(headerValue: string | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header: (name: string) => (name === "x-cron-secret" ? headerValue : undefined) }),
    }),
  } as unknown as ExecutionContext;
}

function makeConfig(secret: string | undefined) {
  return { get: () => secret } as unknown as ConfigService;
}

describe("CronSecretGuard", () => {
  it("rejects when CRON_SECRET isn't configured, even if a header is sent", () => {
    const guard = new CronSecretGuard(makeConfig(undefined));
    expect(() => guard.canActivate(makeContext("anything"))).toThrow(UnauthorizedException);
  });

  it("rejects a missing or wrong header", () => {
    const guard = new CronSecretGuard(makeConfig("correct-secret"));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(makeContext("wrong-secret"))).toThrow(UnauthorizedException);
  });

  it("allows a matching header", () => {
    const guard = new CronSecretGuard(makeConfig("correct-secret"));
    expect(guard.canActivate(makeContext("correct-secret"))).toBe(true);
  });
});
