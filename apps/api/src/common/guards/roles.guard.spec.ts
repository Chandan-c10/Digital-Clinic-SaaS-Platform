import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@digital-clinic/database";
import { RolesGuard } from "./roles.guard";
import { AuthenticatedRequest } from "../interfaces/request-with-user.interface";

function makeContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe("RolesGuard", () => {
  it("allows any authenticated user when the route has no @Roles() metadata", () => {
    const guard = makeGuard(undefined);
    const request = { user: { userId: "u1", role: Role.NURSE, clinicId: "c1" } };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it("allows a user whose role is in the required list", () => {
    const guard = makeGuard([Role.CLINIC_OWNER, Role.DOCTOR]);
    const request = { user: { userId: "u1", role: Role.DOCTOR, clinicId: "c1" } };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it("denies a user whose role is not in the required list", () => {
    const guard = makeGuard([Role.CLINIC_OWNER]);
    const request = { user: { userId: "u1", role: Role.RECEPTIONIST, clinicId: "c1" } };
    expect(guard.canActivate(makeContext(request))).toBe(false);
  });

  it("denies when there is no authenticated user at all", () => {
    const guard = makeGuard([Role.CLINIC_OWNER]);
    const request = { user: undefined };
    expect(guard.canActivate(makeContext(request))).toBe(false);
  });
});
