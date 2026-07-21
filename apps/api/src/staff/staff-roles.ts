import { Role } from "@digital-clinic/database";

/**
 * Roles this module is allowed to create/update/deactivate. DOCTOR is
 * deliberately excluded — doctor accounts are created through the doctors
 * module alongside their DoctorProfile (see doctors.service.ts), and
 * routing them through here too would create a second path that leaves a
 * User without a DoctorProfile.
 */
export const STAFF_MANAGEABLE_ROLES = [Role.RECEPTIONIST, Role.NURSE, Role.ACCOUNTANT] as const;

export type StaffRole = (typeof STAFF_MANAGEABLE_ROLES)[number];
