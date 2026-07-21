import { Request } from "express";
import { Role } from "@digital-clinic/database";

export interface RequestUser {
  userId: string;
  role: Role;
  /** Null for SUPER_ADMIN and patient accounts not yet linked to a clinic. */
  clinicId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  /** Resolved, trusted tenant id for this request — set by TenantGuard. */
  tenantId?: string;
}
