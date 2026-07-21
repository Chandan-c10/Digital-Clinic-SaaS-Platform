import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { TenantGuard } from "./tenant.guard";
import { AuthenticatedRequest, RequestUser } from "../interfaces/request-with-user.interface";

function makeContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function makeRequest(
  user: RequestUser | undefined,
  headers: Record<string, string> = {},
): AuthenticatedRequest {
  return {
    user,
    header: (name: string) => headers[name],
  } as unknown as AuthenticatedRequest;
}

describe("TenantGuard", () => {
  const guard = new TenantGuard();

  it("resolves the tenant from the user's own clinicId for staff/doctor/patient roles", () => {
    const request = makeRequest({ userId: "u1", role: Role.RECEPTIONIST, clinicId: "clinic-1" });
    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.tenantId).toBe("clinic-1");
  });

  it("rejects a staff account with no clinicId", () => {
    const request = makeRequest({ userId: "u1", role: Role.DOCTOR, clinicId: null });
    expect(() => guard.canActivate(makeContext(request))).toThrow(ForbiddenException);
  });

  it("lets SUPER_ADMIN through without a clinicId, and honors x-clinic-id if given", () => {
    const request = makeRequest(
      { userId: "admin", role: Role.SUPER_ADMIN, clinicId: null },
      { "x-clinic-id": "clinic-9" },
    );
    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.tenantId).toBe("clinic-9");
  });

  it("lets SUPER_ADMIN through with no tenantId set when x-clinic-id is absent", () => {
    const request = makeRequest({ userId: "admin", role: Role.SUPER_ADMIN, clinicId: null });
    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.tenantId).toBeUndefined();
  });

  it("denies a request with no authenticated user at all", () => {
    const request = makeRequest(undefined);
    expect(guard.canActivate(makeContext(request))).toBe(false);
  });
});
