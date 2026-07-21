-- Row-Level Security: defense-in-depth behind the application's tenant
-- guard (apps/api/src/common/middleware/tenant.middleware.ts).
--
-- The API sets `SET LOCAL app.current_clinic_id = '<clinicId>'` at the
-- start of every request transaction (see PrismaService.forTenant()).
-- These policies make it impossible for a query to read/write another
-- tenant's rows even if a WHERE clause is missing due to an app bug.
--
-- Run this after `prisma migrate deploy`/`migrate dev` — Prisma Migrate
-- does not manage RLS policies, so it isn't part of schema.prisma.
-- Apply with: psql "$DATABASE_URL" -f prisma/rls.sql

ALTER TABLE "Clinic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClinicProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClinicWebsite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DoctorProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DoctorAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prescription" ENABLE ROW LEVEL SECURITY;

-- Clinic itself: a request may only see the one clinic it's scoped to.
-- SUPER_ADMIN requests bypass RLS entirely via BYPASSRLS role (see below).
CREATE POLICY tenant_isolation_clinic ON "Clinic"
  USING (id = current_setting('app.current_clinic_id', true));

CREATE POLICY tenant_isolation_clinic_profile ON "ClinicProfile"
  USING ("clinicId" = current_setting('app.current_clinic_id', true));

CREATE POLICY tenant_isolation_clinic_website ON "ClinicWebsite"
  USING ("clinicId" = current_setting('app.current_clinic_id', true));

CREATE POLICY tenant_isolation_doctor_profile ON "DoctorProfile"
  USING ("clinicId" = current_setting('app.current_clinic_id', true));

CREATE POLICY tenant_isolation_doctor_availability ON "DoctorAvailability"
  USING (
    "doctorId" IN (
      SELECT id FROM "DoctorProfile"
      WHERE "clinicId" = current_setting('app.current_clinic_id', true)
    )
  );

CREATE POLICY tenant_isolation_patient ON "Patient"
  USING ("clinicId" = current_setting('app.current_clinic_id', true));

CREATE POLICY tenant_isolation_patient_document ON "PatientDocument"
  USING (
    "patientId" IN (
      SELECT id FROM "Patient"
      WHERE "clinicId" = current_setting('app.current_clinic_id', true)
    )
  );

CREATE POLICY tenant_isolation_appointment ON "Appointment"
  USING ("clinicId" = current_setting('app.current_clinic_id', true));

CREATE POLICY tenant_isolation_prescription ON "Prescription"
  USING ("clinicId" = current_setting('app.current_clinic_id', true));

-- A dedicated, non-superuser role is what the API connects as day-to-day.
-- RLS is not enforced against table owners/superusers, so the app's
-- connection role must NOT be a superuser and must NOT own these tables.
-- The migration role (used only for `prisma migrate deploy`) stays the
-- table owner and is exempt on purpose.
--
--   CREATE ROLE app_runtime LOGIN PASSWORD '...';
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
