import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { AuthenticatedRequest } from "../interfaces/request-with-user.interface";

/**
 * Resolves the trusted tenant id for the request onto `req.tenantId`.
 *
 * For every staff/doctor/patient role, the tenant is whatever clinicId is
 * embedded in their access token — never a client-supplied value, so a
 * user cannot simply pass a different clinic's id to read its data.
 *
 * SUPER_ADMIN has no clinicId of their own and may operate against any
 * clinic by passing `x-clinic-id`, used only by the Super Admin platform
 * (module Y) for cross-tenant support/administration.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user } = request;

    if (!user) {
      return false;
    }

    if (user.role === Role.SUPER_ADMIN) {
      const headerClinicId = request.header("x-clinic-id");
      if (headerClinicId) {
        request.tenantId = headerClinicId;
      }
      return true;
    }

    if (!user.clinicId) {
      throw new ForbiddenException("Account is not associated with a clinic");
    }

    request.tenantId = user.clinicId;
    return true;
  }
}
