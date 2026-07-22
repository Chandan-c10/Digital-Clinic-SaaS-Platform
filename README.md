# Digital Clinic SaaS Platform

A multi-tenant SaaS platform giving every doctor/clinic their own website,
online booking, patient records, and clinic operations tools.

This is the single reference document for the project — setup, architecture, API
surface, testing, deployment, contributing conventions, security policy, license,
and changelog all live here as chapters, rather than scattered across separate
files, so there's one place to read top to bottom or jump into from the table of
contents below.

> The one exception is `CLAUDE.md` at the repo root: that file is auto-loaded by
> Claude Code specifically (and similar AI coding tools look for their own
> equivalent), so it stays separate by necessity — everything human-facing is here.

## Table of contents

1. [Overview](#1-overview)
2. [Roadmap](#2-roadmap)
3. [Getting started](#3-getting-started)
4. [Project structure](#4-project-structure)
5. [Architecture](#5-architecture)
6. [API reference](#6-api-reference)
7. [Testing](#7-testing)
8. [Deployment](#8-deployment)
9. [Troubleshooting](#9-troubleshooting)
10. [Contributing & conventions](#10-contributing--conventions)
11. [Security policy](#11-security-policy)
12. [Changelog](#12-changelog)
13. [License](#13-license)

---

## 1. Overview

**Stack**

- **apps/web** — Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **apps/api** — NestJS + REST, JWT auth with refresh tokens, RBAC
- **packages/database** — Prisma schema + client, shared by the API
- **PostgreSQL** — one shared database; every tenant-owned table carries
  `clinicId` + application-level tenant guards + Postgres row-level security as a
  defense-in-depth backstop (see `packages/database/prisma/rls.sql`)

---

## 2. Roadmap

- **Phase 1 — Foundation** (done): auth, multi-tenancy, dashboard, website
  builder, appointments, patient management.
- **Phase 2 — Business features** (done):
  - **Staff management**: clinic owners can add/deactivate receptionist, nurse,
    and accountant accounts under `/dashboard/staff` (API:
    `apps/api/src/staff/`). Deactivating blocks future logins/refreshes and
    revokes live sessions immediately.
  - **Billing**: invoices with line items/discount/tax, manual payment
    recording (cash/card/UPI/bank transfer — no online gateway, see
    [Architecture § Billing](#5-architecture)), PDF download, cancellation.
    `/dashboard/billing`, API: `apps/api/src/billing/`.
  - **Reports**: revenue/appointment/patient-growth aggregates for
    CLINIC_OWNER/ACCOUNTANT. `/dashboard/reports`, API: `apps/api/src/reports/`.
  - **Notifications**: email is real (SMTP), SMS/WhatsApp are honest
    not-configured stubs (see [Architecture § Notifications](#5-architecture)).
    Audit log at `/dashboard/notifications`, API: `apps/api/src/notifications/`.
  - **Prescriptions**: doctors write prescriptions with a medicines list, PDF
    download, "prescription ready" email. `/dashboard/prescriptions`, API:
    `apps/api/src/prescriptions/`.
  - **Patient Portal**: patients register/log in (`/portal`, same
    `/auth/login` staff use), view their appointments/prescriptions/invoices
    across every clinic they've visited, and book new appointments. Identity-
    scoped, not clinic-scoped — see
    [Architecture § Patient Portal](#5-architecture). Not built: PDF download
    or online payment from the portal.
- **Phase 3 — Enterprise** (done, all 5 items):
  - **Multi-branch** (done): opt-in, non-breaking — see
    [Architecture § Multi-branch](#5-architecture). `Branch` model, optional
    `branchId` on availability/appointments/invoices/prescriptions/staff,
    `/dashboard/branches`, branch filter on Reports. API:
    `apps/api/src/branches/`.
  - **Inventory** (done): stock catalog + an append-only transaction ledger
    (current stock is always computed, never cached — see
    [Architecture § Inventory](#5-architecture)), low-stock indicator,
    optional per-branch stock pools. `/dashboard/inventory`, API:
    `apps/api/src/inventory/`. No purchase orders/supplier management —
    stock tracking only.
  - **Pharmacy** (done): dispensing a prescription against Inventory —
    not a new domain, a workflow over Prescription + Inventory (see
    [Architecture § Pharmacy](#5-architecture)). `/dashboard/pharmacy`, API:
    `apps/api/src/pharmacy/`. No new `PHARMACIST` role — reuses the same
    staff who already handle stock.
  - **Insurance** (done): providers, per-patient policies, and claims filed
    against invoices — claims settle *through* Billing
    (`BillingService.recordPayment`, method `INSURANCE`), not around it
    (see [Architecture § Insurance](#5-architecture)). `/dashboard/insurance`,
    API: `apps/api/src/insurance/`.
  - **Advanced analytics** (done): doctor performance, popular services,
    patient growth trend, patient retention — extends the existing Reports
    endpoints rather than a separate module (see
    [Architecture § Advanced analytics](#5-architecture)).
    `/dashboard/reports/advanced`, same API: `apps/api/src/reports/`.
- **Phase 4 — AI**: AI assistant, voice notes, AI summaries, chatbot, predictive
  analytics. Needs a real AI provider account/API key not yet configured —
  same situation as the payment gateway and SMS provider.
- **Cross-platform (web + mobile)** — not a phase with a fixed slot, a standing
  requirement layered across all of them: the platform is meant to grow into 7
  client applications (public website, doctor dashboard, patient portal, super
  admin dashboard, doctor mobile app, patient mobile app, and a future
  receptionist mobile app) sharing one backend. React Native is the preferred
  mobile stack if/when that work starts. No mobile app work has begun — see
  [Architecture § API-first design](#5-architecture) for what this means for how
  the API is built *today*, before any mobile client exists.
- **UI/UX quality bar** — also standing, not a phase: every page shipped from now
  on is expected to be responsive (desktop through mobile, no horizontal
  scroll), give clear loading/success/error feedback, validate forms inline, and
  draw from a consistent, growing `components/ui/` set rather than one-off
  styling. See [Contributing § Frontend conventions](#10-contributing--conventions)
  for what that means concretely and what's already in place vs. still missing
  (dark mode, accessibility pass, most of the component library).

Build order matters here — resist adding Phase 3/4 features before Phase 1 and 2
are solid and in front of real users.

---

## 3. Getting started

### Prerequisites

This machine did not have these installed when the project was scaffolded —
install them before running anything, and confirm with `node -v` / `pnpm -v` /
`docker -v`:

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 9+ (`corepack enable` ships it with modern Node, or
  `npm i -g pnpm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local
  Postgres)

### First-time setup

```bash
# 1. Install dependencies for every package in the monorepo
pnpm install

# 2. Copy environment variables and adjust as needed
cp .env.example .env

# 3. Start local Postgres
docker compose up -d

# 4. Generate the Prisma client, run migrations, apply row-level security
pnpm db:generate
pnpm db:migrate
psql "$DATABASE_URL" -f packages/database/prisma/rls.sql

# 5. Seed a demo clinic
pnpm db:seed

# 6. Run both apps in dev mode
pnpm dev
```

- API: http://localhost:4000/api/v1
- Web: http://localhost:3000

Seeded logins (Sunrise Family Clinic, password `Password123!` for all):
`owner@sunrise-clinic.test` (CLINIC_OWNER), `dr.rao@sunrise-clinic.test` (DOCTOR),
`reception@sunrise-clinic.test` (RECEPTIONIST), `accounts@sunrise-clinic.test`
(ACCOUNTANT) — log in at `/login`. Also `ramesh.patient@example.test`
(PATIENT) — log in at `/portal/login`, linked to the demo patient record with
one upcoming appointment, one prescription, one paid and one unpaid invoice.
The clinic also seeds one `Branch` ("Main Branch") that the doctor's
availability and the demo appointment/prescription are wired to, demonstrating
module Z end to end even though this demo clinic only has one location, plus
two inventory items (Paracetamol with stock; Examination Gloves seeded below
its reorder level, to show the low-stock indicator).

### Local subdomains (website builder)

The public clinic website lives at `{slug}.platform.local` in production routing
terms; locally, visit `http://localhost:3000/c/{slug}` directly (e.g. `/c/sunrise`
after seeding) — the `middleware.ts` subdomain rewrite only kicks in once you have
real DNS/hosts-file entries pointing `*.platform.local` at localhost.

---

## 4. Project structure

```
apps/
  web/     Next.js frontend — marketing site, auth, dashboard, public clinic websites
  api/     NestJS backend — auth, clinics, doctors, patients, appointments, staff
packages/
  database/  Prisma schema, migrations, seed script
docker-compose.yml   Local Postgres
```

Backend module layout (`apps/api/src/<module>/`), one per business area:
`*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/*.dto.ts`. See
`apps/api/src/patients/` as the reference shape for a new module.

---

## 5. Architecture

### Request path & guards

Global guard order (registered in `apps/api/src/app.module.ts`):
`ThrottlerGuard` (rate limiting, 100 req/min default) → `JwtAuthGuard` (verifies
the bearer token; routes marked `@Public()` skip this) → `RolesGuard` (checks
`@Roles(...)` metadata against `user.role`). Per-controller, `TenantGuard` then
resolves the trusted tenant id.

### Multi-tenancy

Single shared database, discriminator column: every clinic-owned table carries
`clinicId`. Two layers:

1. **Enforced today** — `TenantGuard` (`apps/api/src/common/guards/tenant.guard.ts`)
   sets the tenant id from the JWT's `clinicId` claim, never from a client-supplied
   value, and every service method takes `clinicId` as an explicit parameter and
   filters every query by it (see `apps/api/src/patients/patients.service.ts` for
   the pattern). `SUPER_ADMIN` has no clinic of its own and may pass `x-clinic-id`
   to operate cross-tenant, for the future Super Admin platform only.
2. **Written, not yet active** — Postgres row-level security policies
   (`packages/database/prisma/rls.sql`) plus `PrismaService.forTenant()`
   (`apps/api/src/prisma/prisma.service.ts`), which runs a callback inside a
   transaction with the `app.current_clinic_id` session variable set so RLS
   policies apply even if a query forgets its `where: { clinicId }`. Not yet
   called from every request path — that needs a request-scoped interceptor and
   the API connecting as a non-owner DB role. Treat it as available
   infrastructure, not an active backstop, until that's done.

### Auth

- Access tokens: JWT, 15 minutes default (`JWT_ACCESS_EXPIRES_IN`), signed with
  `JWT_ACCESS_SECRET`, carrying `{ sub, role, clinicId }`.
- Refresh tokens: opaque random bytes (48), **never JWT-signed** — stored hashed
  (SHA-256) in `RefreshToken`, rotated on every use (`AuthService.refresh`), and
  individually revocable. There is deliberately no `JWT_REFRESH_SECRET`.
- Passwords: scrypt + random salt per user, compared in constant time
  (`apps/api/src/auth/password.util.ts`).
- Deactivated accounts (`User.isActive = false`) fail login and refresh with a
  generic "invalid credentials" error — the API never reveals that an account
  exists but is disabled.
- Web app: access token lives only in an httpOnly cookie set by a Next.js Server
  Action, never in `localStorage`. Server components read it via
  `apps/web/src/lib/api.ts`; client components go through the same-origin proxy
  at `apps/web/src/app/api/[...path]/route.ts`, so client-side JS never touches
  the token directly.
- Silent token refresh: since the access token expires every 15 minutes, both
  `apps/web/src/middleware.ts` (page navigations) and the proxy route above
  (client-side fetches) call `/auth/refresh` automatically when a request comes
  back 401/missing its token, using the refresh token cookie, before falling
  back to redirecting to `/login`. Cookie lifetimes are defined once in
  `apps/web/src/lib/session-cookies.ts` — see the comment there about keeping
  them in sync with `JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` if those
  are changed from their defaults.
- **Password reset + email verification** (QA/security audit, 2026-07-22,
  TC-AUTH-01/02): one shared `VerificationToken` model for both — same
  hashed-random-token shape as `RefreshToken` (opaque, SHA-256 at rest,
  expiring, single-use), distinguished by a `purpose` enum so one table
  covers both flows instead of two near-identical ones. `POST
  /auth/forgot-password` and `/resend-verification` always return the same
  generic response whether or not the email is registered — see the code
  comment on `AuthController` for why that's load-bearing, not incidental.
  Self-registration (`registerClinic`/`registerPatient`) sends a
  verification email and starts `isEmailVerified: false`; `login()` now
  actually enforces it (previously set but never read — TC-AUTH-02).
  Staff/doctor accounts created *by* a clinic owner start pre-verified
  instead — the owner is vouching for that email, unlike a stranger
  self-registering — so this doesn't add a verification step to onboarding
  a new team member. Resetting a password revokes every existing
  `RefreshToken` for that account, and rejects setting the same password
  back.
- **Per-account login lockout** (TC-AUTH-04): after 5 failed attempts on
  one account within 15 minutes, further logins are rejected — including
  with the *correct* password — until the window ages out. Computed from
  `LoginEvent` (already recorded every attempt) rather than a new counter
  column. Complements, doesn't replace, `ThrottlerGuard`'s IP-based
  `/auth/login` throttle (5/min): the IP throttle stops one source hitting
  many accounts, this stops many sources hitting one account.
- 2FA schema scaffolding (`User.isTwoFactorEnabled`/`twoFactorSecret`) was
  removed (TC-AUTH-03) rather than built out — it had zero implementation
  behind it (no TOTP generation, no login-flow check), which the audit
  flagged as worse than simply absent: a reader of the data model could
  reasonably assume MFA was available when it provided zero protection.
  Real TOTP-based MFA is a substantial standalone feature, not something to
  half-build alongside 23 other findings in one pass.

### Roles

`SUPER_ADMIN`, `CLINIC_OWNER`, `DOCTOR`, `RECEPTIONIST`, `NURSE`, `ACCOUNTANT`,
`PATIENT` (`Role` enum, `packages/database/prisma/schema.prisma`). Staff accounts
for `RECEPTIONIST` / `NURSE` / `ACCOUNTANT` are managed through the `staff`
module; `DOCTOR` accounts go through the `doctors` module instead because
creating one also creates a `DoctorProfile` — routing doctor creation through
`staff` as well would produce a `User` with no profile.

### Patients

- **Soft delete, not hard delete** (QA/security audit, 2026-07-22,
  TC-SEC-01/TC-DB-01). `DELETE /patients/:id` used to call
  `prisma.patient.delete()` directly — every clinically/financially linked
  model (`Appointment`, `Prescription`, `Payment`, `PatientDocument`, …) is
  `onDelete: Cascade`, so one call permanently erased a patient's whole
  history with nothing logged. Now mirrors the `isActive` pattern already
  used for staff/branches/inventory items: `remove()` flips `isActive` to
  `false` (idempotent — a no-op, not an error, if already inactive) and
  `PATCH /patients/:id/restore` flips it back. A true hard delete (e.g. a
  data-subject erasure request) would need to be a separate, explicitly
  confirmed operation — not built here.
- **Every soft-delete/restore is logged to `AuditLog`** (TC-DB-04) — a new
  general-purpose audit trail (`clinicId`, `actorId`, `action`,
  `entityType`, `entityId`, `metadata`), viewable at `GET /audit-log`
  (CLINIC_OWNER only). Deliberately not retrofitted into every mutation
  across the app in this pass — Patient soft-delete/restore is the one call
  site today, chosen because it's the highest-value case (undoing/tracing a
  "deletion" of clinical records). Extend `AuditLogService.record()` call
  sites as other modules' trails become worth having.
- **Paginated for real** (TC-FUNC-01/TC-PERF-01) — `GET /patients` accepts
  `page`/`pageSize` and returns a bounded array with the total count on an
  `X-Total-Count` response header (not a `{data, total}` body shape, to
  avoid breaking every other existing caller of `apiFetch<Patient[]>(...)`
  — see the doc comment on `apps/api/src/common/pagination.util.ts`).
  `/dashboard/patients` is the one page with real pager controls
  (`components/ui/Pager.tsx`) plus a "show deleted patients" toggle; seven
  other list endpoints (appointments, invoices, staff, notifications,
  inventory, prescriptions, insurance claims/providers/policies) are now
  bounded the same way `NotificationsService.list()` always was
  (`take: 200`, no `skip`) but don't have page-through UI yet.

### Billing

- No online payment gateway integration — `Payment` records are entered
  manually by staff (cash/card/UPI/bank transfer). Integrating Razorpay/Stripe
  needs a real merchant account and API keys this project doesn't have
  configured; see the `Invoice`/`Payment` model comments in `schema.prisma`.
- `Invoice.invoiceNumber` is sequential *per clinic*, not a database identity
  column (those are global) — computed as `count + 1` inside
  `BillingService.create`'s transaction, with `@@unique([clinicId,
  invoiceNumber])` as the actual safety net against the race that computation
  has under concurrent creates (see the code comment there).
- Money fields (`subtotal`, `totalAmount`, `amountPaid`, `Payment.amount`, …)
  are Prisma `Decimal`, which serializes to a **JSON string**, not a number —
  `apps/web/src/lib/types.ts` types these as `string` deliberately; the
  frontend does `Number(invoice.totalAmount)` before formatting/math. This is
  the first Decimal field surfaced through the API to a browser client (the
  existing `consultationFee` fields never made it into `apps/web`'s types),
  so it's worth knowing the pattern before adding the next one.

### Notifications

- Pluggable per channel: `apps/api/src/notifications/providers/` has one
  provider class per channel (`EmailProvider`, `SmsProvider`,
  `WhatsAppProvider`), all implementing the same `NotificationProvider`
  interface. `NotificationsService.send()` records a `Notification` row,
  dispatches to the right provider, and updates the row with the result —
  **never throws**, under any failure mode (see the doc comment on `send()`),
  because every call site fires it with `void` rather than awaiting it; a
  notification failure must never break the booking/invoice/prescription
  that triggered it.
- Only `EmailProvider` is real (SMTP via `nodemailer`, using the `SMTP_*` env
  vars). `SmsProvider`/`WhatsAppProvider` always return a `FAILED` result with
  an explanatory error — there's no Twilio/MSG91/WhatsApp Business account
  configured for this project. This is intentional, not a bug: faking a
  successful send would be worse than an honest, visible failure (see
  `/dashboard/notifications`, the audit log).
- Trigger points live in the module that owns the event, not in
  `NotificationsService` itself: `AppointmentsService.create` (confirmation),
  `BillingService.create`/`recordPayment` (invoice created / payment
  received), `PrescriptionsService.create` (prescription ready). Each imports
  `NotificationsModule` and calls `notifications.send(...)` after its own
  write succeeds, not inside the same transaction.

### Patient Portal

- **Identity-scoped, not clinic-scoped** — the one place in this API where
  that's true. Every other module resolves a `clinicId` from the JWT via
  `TenantGuard` and filters every query by it; `PatientPortalController` has
  no `TenantGuard` at all, because a patient isn't scoped to one clinic (see
  the `User`/`Patient` model comments) — they can have appointments,
  prescriptions, and invoices at several. Every query is scoped by
  `patient: { userId }` instead, using the caller's own id from the JWT.
  Authorization is still enforced, by the same global `JwtAuthGuard` +
  `RolesGuard` + `@Roles(Role.PATIENT)` every route gets — see the class
  comment on `PatientPortalService`.
- Patient login reuses the same `/auth/login` endpoint staff use — it's
  already role-agnostic (checks the `User` table, returns a token carrying
  whatever role that row has). Only registration is a separate endpoint
  (`/auth/register-patient`), because it creates a different kind of `User`
  (`Role.PATIENT`, `clinicId: null`).
- Booking from the portal (`PatientPortalService.bookAppointment`)
  find-or-creates the patient's per-clinic `Patient` row rather than
  requiring clinic staff to have pre-registered them — see the method's doc
  comment. This duplicates some of `AppointmentsService.create`'s shape
  (conflict check, slot booking) because the actor and auth model differ
  enough (patient picks their own clinic from the request body; there's no
  staff-side `TenantGuard`-provided `clinicId`) that forcing a shared
  abstraction under time pressure felt riskier than the small duplication —
  flagged here rather than left silent. The slot-computation math itself
  *is* shared (`apps/api/src/appointments/available-slots.util.ts`), used by
  both `AppointmentsService.getAvailableSlots` and
  `PatientPortalService.availableSlots`.
- Deliberately **not** built: auto-linking a new portal registration to any
  existing walk-in `Patient` record that matches the same email/phone —
  guessing that link risks attaching someone else's medical record to the
  wrong login (see the doc comment on `AuthService.registerPatient`).
  Patient-facing PDF downloads and online invoice payment are also not built
  — see the API reference's Patient Portal section for what that leaves.

### Multi-branch

- **Purely additive, not a breaking migration.** A new `Branch` model
  (scoped under `Clinic`, same `TenantGuard`/`clinicId` isolation as
  everything else) plus an **optional** `branchId` on `DoctorAvailability`,
  `Appointment`, `Invoice`, `Prescription`, and staff `User`. A single-branch
  clinic creates zero `Branch` rows and every existing query keeps working
  unchanged — `branchId` columns just stay `null`. This was a deliberate
  design choice specifically to avoid the breaking-migration risk multi-
  branch usually implies (see [Roadmap](#2-roadmap)'s original framing of
  it as one).
- `Patient` and `DoctorProfile` stay **clinic-scoped, not branch-scoped** —
  a patient's medical identity and a doctor's employment belong to the
  organization, not one building. Which branch a specific *visit* happened
  at is tracked per-appointment/invoice/prescription instead.
- **No separate "pick a branch" step in booking.** Branch is implied by
  which `DoctorAvailability` window a booked time falls into
  (`resolveBranchForTime` in `available-slots.util.ts`) — a doctor sets
  availability per branch they work at, and `AppointmentsService.create` /
  `PatientPortalService.bookAppointment` both stamp the new appointment's
  `branchId` from that automatically. `BillingService.create` and
  `PrescriptionsService.create` in turn inherit `branchId` from the linked
  appointment when there is one.
- `Payment` has no `branchId` of its own — branch-filtered revenue queries
  (`ReportsService`) go through `Payment`'s `Invoice` relation
  (`where: { invoice: { branchId } }`) instead of denormalizing the column
  onto `Payment` too.
- Postgres treats `NULL` as distinct from `NULL` in unique constraints, so
  `DoctorAvailability`'s `@@unique([doctorId, branchId, dayOfWeek,
  startTime])` can't itself block duplicate rows when `branchId` is null
  (single-branch clinics). Fixed at the application layer instead:
  `DoctorsService.setAvailability` rejects a submitted slot list containing
  a duplicate `(branchId, dayOfWeek, startTime)` with a 400 before writing
  anything — it's the only place these rows are ever written (a full
  `deleteMany`+`createMany` replace, never an incremental insert), so this
  fully closes the gap without needing a partial-index migration.
- **Doctor management UI**: `/dashboard/doctors` — list, create, edit
  profile, and a weekly-availability editor (`/dashboard/doctors/:id`).
  Saving availability replaces the doctor's whole schedule in one request,
  matching `setAvailability`'s replace semantics — the form is pre-filled
  with the doctor's current week rather than needing a separate view/edit
  mode. Per-slot `branchId` only shows once the clinic has at least one
  branch, same "don't ask for what doesn't apply yet" rule as
  `/dashboard/branches`.
- **`Branch.isActive` enforcement was a promise the code didn't keep until
  now.** `BranchesService.setStatus`'s doc comment always said deactivating
  "stops it being offered for new availability/bookings... enforced by the
  modules that read `Branch.isActive` when listing options" — but no module
  actually did. The availability editor's branch dropdown is the first real
  one: it now filters to active branches, while still showing a slot's
  *already-assigned* branch even if it's since been deactivated (labeled
  "(deactivated)") rather than silently swapping the visible selection out
  from under a value that didn't change. `GET /branches` itself still
  returns every branch regardless of status — deactivation was never meant
  to hide a branch from management, only from being offered fresh.

### Inventory

- **Append-only ledger, not a cached running total.** `InventoryItem` is
  just the catalog entry — current stock is never stored directly, it's
  computed on read as `SUM(InventoryTransaction.quantity)`
  (`InventoryService.stockFor`). This trades a slightly more expensive read
  for a correctness guarantee a denormalized "current quantity" column
  can't give you: the computed value can never drift out of sync with the
  transactions that produced it, because there's nothing else to drift.
- `quantity` on a transaction is a **signed delta**: positive for
  `RECEIVED`, negative for `DISPENSED`/`EXPIRED`/`DAMAGED` (the service
  applies the sign — callers always send a positive magnitude for these),
  and caller-signed for `ADJUSTED` (a correction can go either way). Every
  write is checked against the computed current stock first and rejected
  with a 400 if it would go negative.
- Branch-scoped and branch-less stock for the *same item* are tracked as
  **separate pools**, not merged (`stockFor(itemId, branchId)` filters on
  `branchId ?? null` exactly, no "any branch" fallback) — same additive
  convention `branchId` follows everywhere else (see
  [Architecture § Multi-branch](#5-architecture)). A single-branch clinic
  never sets `branchId` on a transaction, so this doesn't come up in
  practice there.
- No purchase orders, supplier management, or automatic reorder
  notifications — this is stock *tracking* (what do we have, is anything
  low), not procurement. Out of scope for this pass.

### Pharmacy

- **Not a separate domain — a workflow over Prescription + Inventory.**
  Dispensing writes `DISPENSED` `InventoryTransaction` rows (via
  `InventoryService.recordTransaction`, reusing its stock/branch validation
  rather than duplicating it) tagged with an internal `prescriptionId` param
  not exposed on the public `/inventory` DTO, then stamps
  `Prescription.dispensedAt`.
- **Single timestamp, not a partial-dispense state machine.** A
  prescription is either pending (`dispensedAt` null) or fully dispensed —
  there's no "dispensed 2 of 3 medicines" state. `PharmacyService.dispense`
  takes every line in one call.
- **No new `PHARMACIST` role.** Dispensing reuses the same roles that
  already handle physical stock in Inventory (CLINIC_OWNER, NURSE,
  RECEPTIONIST) rather than adding a role that would ripple through Staff
  Management, nav visibility, etc. for what's a small-clinic-scale feature.
- **Multi-line dispense is atomic.** `PharmacyService.dispense` wraps every
  line's existence/stock check + write in one `prisma.$transaction`, passed
  through to `InventoryService.recordTransaction` via an optional trailing
  `db` parameter (`PrismaService | Prisma.TransactionClient`, defaulting to
  the ambient `PrismaService` for every other caller so this is additive,
  not a breaking signature change). A concurrent request against the same
  item can no longer interleave between one line's check and its write —
  Postgres serializes the two transactions instead of the application
  racing itself.

### Insurance

- **Claims settle through Billing, not around it.** Marking a claim `PAID`
  calls the existing `BillingService.recordPayment` with
  `method: INSURANCE` (a new `PaymentMethod` value) rather than adjusting
  `Invoice.amountPaid` directly — this reuses Billing's balance/status
  transition logic (and its own remaining-balance check) instead of a
  second, parallel implementation of "apply money to an invoice." Same
  compose-don't-duplicate pattern as Pharmacy over Inventory.
- `InsuranceProvider` (the catalog of insurers a clinic works with) and
  `InsurancePolicy` (one patient's specific coverage) are separate models —
  a provider exists once per clinic, a policy exists once per
  patient-provider pair.
- A claim is validated against its invoice at filing time: the policy must
  belong to the *same patient* as the invoice (not just the same clinic —
  filing someone else's policy against your invoice is a real integrity
  bug, not just a tenant-isolation one), and `claimedAmount` can't exceed
  the invoice total.
- `respondToClaim` requires `approvedAmount` for every status except
  `REJECTED`, and refuses to respond to a claim that's already `PAID`
  (claims settle once, like invoices don't get double-invoiced).

### Advanced analytics

- **Lives inside `ReportsService`/`ReportsController`, not a separate
  module.** It's the same domain (reporting over existing data) as the
  Phase 2 Reports endpoints, just deeper — `resolveRange`/`dayKey` were
  extracted to `apps/api/src/reports/date-range.util.ts` so both the
  original four endpoints and these four share the exact same date-range
  and day-bucketing logic instead of two copies drifting apart.
- **Doctor performance** revenue is attributed via `Invoice.amountPaid` on
  invoices linked to that doctor's appointments
  (`Invoice.appointmentId` → `Appointment.doctorId`) — `Payment` has no
  doctor link at all, so this is a practical measure ("how much did this
  doctor generate"), not an audited financial attribution.
- **Popular services** aggregates `Invoice.lineItems` (a JSON blob, not a
  normalized table) by `description` in JS after one ranged fetch — same
  reasoning as `revenue()`/`appointmentTrend()` for not reaching for raw
  SQL at this data volume.
- **Patient retention** defines "returning" as a patient seen in the
  requested window who was *also* seen at least once before it started.
  Not branch-filterable, like `overview()`'s `newPatients` — `Patient`
  isn't branch-scoped, and retention is a whole-clinic behavior question,
  not a per-location one.
- Frontend: `/dashboard/reports/advanced`, linked from the main Reports
  page rather than a separate top-level nav item (same reasoning as the
  backend — it's more Reports, not a new section). The daily bar chart
  (patient growth) reuses a new shared `components/ui/BarChart.tsx`,
  extracted from the Reports page's original revenue chart so this doesn't
  duplicate the same chart code — the "extend `components/ui/` rather than
  one-off styling" convention actually paying off with a second caller.

### API-first design (for future web + mobile clients)

The plan is a shared backend behind every client this platform will eventually
have: the public website, doctor and patient web apps, a super admin dashboard,
and doctor/patient mobile apps (React Native preferred — see
[Roadmap](#2-roadmap)). None of the mobile apps exist yet, but the API is already
built in a way that doesn't need to change when they show up:

- `apps/api` is the only place business logic lives. `apps/web`'s server
  components and Server Actions call it like any other client would — they don't
  reimplement rules locally. A mobile app calling the same endpoints gets
  identical behavior for free.
- Auth is bearer-JWT at the API layer (see [Auth](#5-architecture) above), not
  cookie-only — `apps/web` happens to store the token in an httpOnly cookie
  because that's the safe place for a browser to keep it, but the API itself
  doesn't know or care how a client stores the token. A mobile client stores the
  same access/refresh token pair in its platform's secure storage instead.
- New endpoints should return data, not HTML or web-specific shapes — every
  response so far is plain JSON, which is what keeps this true.

When the roadmap reaches Patient Portal or Super Admin (Phase 2/3), build them as
API consumers like everything else, so adding a mobile client later is a new
frontend against an unchanged backend, not a backend rework. Don't start
React Native/Flutter work or extract a shared client package before that's
actually asked for — there's no second client yet to share code with.

---

## 6. API reference

Base URL: `http://localhost:4000/api/v1`. All routes except those marked
**public** require `Authorization: Bearer <accessToken>`.

### Auth (`/auth`)

| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/auth/register-clinic` | public, throttled 10/min | `{ clinicName, slug, ownerName, email, password }` — sends a verification email |
| POST | `/auth/register-patient` | public, throttled 10/min | `{ name, email, phone?, password }` — creates a Patient Portal login (`Role.PATIENT`, `clinicId: null`); does not auto-link any existing walk-in `Patient` record; sends a verification email |
| POST | `/auth/login` | public, throttled 5/min | `{ email, password }` — same endpoint for staff and patients, role decides what the token can do; rejects if the account isn't email-verified or has 5+ recent failed attempts (see [Architecture § Auth](#5-architecture)) |
| POST | `/auth/refresh` | public | `{ refreshToken }` |
| POST | `/auth/logout` | public | `{ refreshToken }` |
| POST | `/auth/forgot-password` | public, throttled 5/min | `{ email }` — always 200 with the same generic message, registered or not |
| POST | `/auth/reset-password` | public | `{ token, newPassword }` — revokes every existing session on success |
| POST | `/auth/verify-email` | public | `{ token }` |
| POST | `/auth/resend-verification` | public, throttled 5/min | `{ email }` — always 200 with the same generic message |

### Clinics (`/clinics`)

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/clinics/public/:slug` | public | — (published website only) |
| GET | `/clinics/me` | any authenticated staff | — |
| PATCH | `/clinics/me/profile` | CLINIC_OWNER | `UpdateClinicProfileDto` |
| PATCH | `/clinics/me/website` | CLINIC_OWNER | `UpdateClinicWebsiteDto` |

### Doctors (`/doctors`)

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/doctors` | any authenticated staff | — |
| GET | `/doctors/:id` | any authenticated staff | — |
| POST | `/doctors` | CLINIC_OWNER | `{ email, password, displayName, qualification?, specialization?, registrationNumber?, experienceYears?, consultationFee?, bio?, languagesSpoken? }` |
| PATCH | `/doctors/:id` | CLINIC_OWNER, DOCTOR | partial of the above minus `email`/`password` |
| PATCH | `/doctors/:id/availability` | CLINIC_OWNER, DOCTOR | `{ slots: [{ dayOfWeek, startTime, endTime, slotDurationMinutes, branchId? }] }` — `branchId` optional, validated to belong to this clinic if given (module Z, see [Architecture § Multi-branch](#5-architecture)); replaces the doctor's whole schedule (min 1 slot) and 400s on a duplicate `(branchId, dayOfWeek, startTime)` within the same request |

### Patients (`/patients`)

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/patients?search=&includeInactive=&page=&pageSize=` | CLINIC_OWNER, DOCTOR, RECEPTIONIST, NURSE, ACCOUNTANT (read-only) | — bounded array, total count on the `X-Total-Count` response header (see [Architecture § Patients](#5-architecture)) |
| GET | `/patients/:id` | same | — |
| POST | `/patients` | CLINIC_OWNER, DOCTOR, RECEPTIONIST, NURSE, throttled 20/min | `{ name, phone?, email?, gender?, dateOfBirth?, address?, allergies?, medicalHistory? }` |
| PATCH | `/patients/:id` | same | partial of the above |
| DELETE | `/patients/:id` | CLINIC_OWNER | soft delete — sets `isActive: false`, logged to `AuditLog`, idempotent |
| PATCH | `/patients/:id/restore` | CLINIC_OWNER | — sets `isActive: true`, logged to `AuditLog` |

ACCOUNTANT's GET-only access was added for Billing — invoicing needs to look up a patient, but accountants shouldn't edit medical/demographic records.

### Audit log (`/audit-log`)

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/audit-log` | CLINIC_OWNER | — most recent 200 entries, newest first, actor name/email included |

See [Architecture § Patients](#5-architecture) for what's logged today (Patient soft-delete/restore only — not every mutation).

### Appointments (`/appointments`)

All routes: CLINIC_OWNER, DOCTOR, RECEPTIONIST, NURSE.

| Method | Path | Body / query |
|---|---|---|
| GET | `/appointments/available-slots?doctorId=&date=` | computes open slots for one doctor on one day |
| GET | `/appointments?doctorId=&patientId=&status=` | filters optional |
| POST | `/appointments` | `{ patientId, doctorId, scheduledAt, durationMinutes?, type?, reasonForVisit? }` |
| PATCH | `/appointments/:id/status` | `{ status: PENDING\|CONFIRMED\|CANCELLED\|COMPLETED\|NO_SHOW }` |
| PATCH | `/appointments/:id/reschedule` | `{ scheduledAt }` |

### Staff (`/staff`)

All routes: CLINIC_OWNER only. Scoped to `RECEPTIONIST` / `NURSE` / `ACCOUNTANT`
roles — `DOCTOR` accounts are not manageable here (see [Architecture](#5-architecture)).

| Method | Path | Body |
|---|---|---|
| GET | `/staff` | — |
| GET | `/staff/:id` | — |
| GET | `/staff/:id/activity` | — (last 50 `LoginEvent` rows) |
| POST | `/staff` (throttled 20/min) | `{ name, email, password, phone?, role: RECEPTIONIST\|NURSE\|ACCOUNTANT }` — starts pre-verified (see [Architecture § Auth](#5-architecture)) |
| PATCH | `/staff/:id` | partial `{ name?, phone?, role? }` |
| PATCH | `/staff/:id/status` | `{ isActive: boolean }` — deactivating revokes live refresh tokens immediately |

### Branches (`/branches`)

Read: any authenticated staff (needed to pick a branch when setting
availability or filtering reports). Write: CLINIC_OWNER only. Purely
optional infrastructure — see [Architecture § Multi-branch](#5-architecture);
a single-branch clinic never needs to call any of these.

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/branches` | any staff | — |
| GET | `/branches/:id` | any staff | — |
| POST | `/branches` | CLINIC_OWNER | `{ name, addressLine1?, addressLine2?, city?, state?, country?, postalCode?, phone? }` |
| PATCH | `/branches/:id` | CLINIC_OWNER | partial of the above |
| PATCH | `/branches/:id/status` | CLINIC_OWNER | `{ isActive: boolean }` — soft-disable only, no hard delete; existing rows pointing at a deactivated branch stay valid |

### Billing (`/billing/invoices`)

CLINIC_OWNER, RECEPTIONIST, ACCOUNTANT for all routes; GET routes also allow
DOCTOR (read-only). `PATCH .../cancel` is CLINIC_OWNER/ACCOUNTANT only. No
online payment gateway — payments are recorded manually (cash/card/UPI/bank
transfer at the counter); integrating Razorpay/Stripe needs a real merchant
account and API keys this project doesn't have configured, so it isn't
stubbed out.

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/billing/invoices?patientId=&status=` | read roles | — |
| GET | `/billing/invoices/:id` | read roles | — includes `payments[]` |
| GET | `/billing/invoices/:id/pdf` | read roles | — streams a PDF |
| POST | `/billing/invoices` | write roles, throttled 20/min | `{ patientId, appointmentId?, lineItems: [{ description, quantity, unitPrice }], discountAmount?, taxAmount?, notes? }` — every quantity/amount field bounded (TC-FUNC-02), `NewInvoiceForm` pre-validates discount+tax against subtotal client-side before submitting (TC-EDGE-02) |
| POST | `/billing/invoices/:id/payments` | write roles | `{ amount, method: CASH\|CARD\|UPI\|BANK_TRANSFER\|OTHER, reference? }` — rejects amounts exceeding the remaining balance |
| PATCH | `/billing/invoices/:id/cancel` | CLINIC_OWNER, ACCOUNTANT | — only an `UNPAID` invoice can be cancelled |

`invoiceNumber` is sequential per clinic (not a DB identity column — see the
schema comment on `Invoice.invoiceNumber`), guarded by a
`@@unique([clinicId, invoiceNumber])` constraint against the race inherent in
computing it as `count + 1`.

### Reports (`/reports`)

CLINIC_OWNER, ACCOUNTANT only, read-only. All three accept optional
`?from=&to=` (ISO date strings; default range is the trailing 30 days) and
`?branchId=` (module Z — filters everything except `newPatients`, since
`Patient` isn't branch-scoped; see [Architecture § Multi-branch](#5-architecture)).

| Method | Path | Returns |
|---|---|---|
| GET | `/reports/overview` | `{ range, totalRevenue, totalInvoiced, outstandingAmount, totalAppointments, appointmentsByStatus, newPatients }` |
| GET | `/reports/revenue` | `[{ date, amount }]` — daily, from recorded `Payment`s |
| GET | `/reports/appointments` | `[{ date, count }]` — daily appointment volume |
| GET | `/reports/doctor-performance` | `[{ doctorId, doctorName, totalAppointments, appointmentsByStatus, revenue }]` — supports `?branchId=` |
| GET | `/reports/popular-services` | `[{ description, count, revenue }]`, sorted by revenue desc — supports `?branchId=` |
| GET | `/reports/patient-growth` | `[{ date, count }]` — daily new-patient series (not `?branchId=` filterable, see [Architecture § Advanced analytics](#5-architecture)) |
| GET | `/reports/patient-retention` | `{ range, totalPatients, returningPatients, newPatients, retentionRate }` — not `?branchId=` filterable |

### Prescriptions (`/prescriptions`)

Read (CLINIC_OWNER, DOCTOR, RECEPTIONIST, NURSE); create is DOCTOR only —
resolved to the caller's own `DoctorProfile` in this clinic, not a
client-supplied doctor id.

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/prescriptions?patientId=` | read roles | — |
| GET | `/prescriptions/:id` | read roles | — |
| GET | `/prescriptions/:id/pdf` | read roles | — streams a PDF |
| POST | `/prescriptions` | DOCTOR | `{ patientId, appointmentId?, medicines: [{ name, dosage, frequency, durationDays, instructions? }], notes? }` |

At most one prescription per appointment (`appointmentId` is unique) —
attaching a second throws a 409.

### Inventory (`/inventory/items`)

Read (item list/detail): any authenticated staff. Item catalog
create/update: CLINIC_OWNER only. Recording a stock transaction:
CLINIC_OWNER, NURSE, RECEPTIONIST. See
[Architecture § Inventory](#5-architecture) for the ledger design.

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/inventory/items?category=&lowStockOnly=true` | any staff | — returns each item with a computed `currentStock` |
| GET | `/inventory/items/:id` | any staff | — includes `currentStock` + last 50 transactions |
| POST | `/inventory/items` | CLINIC_OWNER | `{ name, unit, sku?, category?, reorderLevel? }` |
| PATCH | `/inventory/items/:id` | CLINIC_OWNER | partial of the above + `isActive?` |
| POST | `/inventory/items/:id/transactions` | CLINIC_OWNER, NURSE, RECEPTIONIST | `{ type: RECEIVED\|DISPENSED\|ADJUSTED\|EXPIRED\|DAMAGED, quantity, branchId?, reason? }` — rejected with 400 if it would take stock negative |

### Cron (`/internal/cron`)

Not a user-facing route — called by an external scheduler (cron-job.org,
see [Deployment](#8-deployment)). `@Public()` + a shared-secret header
instead of a JWT, and not tenant-scoped (runs across every clinic).

| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/internal/cron/appointment-reminders` | header `x-cron-secret: <CRON_SECRET>` | — none; returns `{ sent, skipped }` |

### Pharmacy (`/pharmacy`)

Read: CLINIC_OWNER, DOCTOR, NURSE, RECEPTIONIST. Dispense:
CLINIC_OWNER, NURSE, RECEPTIONIST. See
[Architecture § Pharmacy](#5-architecture).

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/pharmacy/prescriptions/pending` | read roles | — prescriptions with `dispensedAt: null` |
| GET | `/pharmacy/prescriptions/:id` | read roles | — includes dispense history |
| POST | `/pharmacy/prescriptions/:id/dispense` | dispense roles | `{ items: [{ inventoryItemId, quantity }], branchId? }` — 404 on an unknown item, 400 if already dispensed or stock is insufficient |

### Insurance (`/insurance`)

Providers/policies/claim filing: CLINIC_OWNER, RECEPTIONIST, ACCOUNTANT
(provider *creation* is CLINIC_OWNER only). Responding to a claim:
CLINIC_OWNER, ACCOUNTANT. See [Architecture § Insurance](#5-architecture).

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/insurance/providers` | manage roles | — |
| POST | `/insurance/providers` | CLINIC_OWNER | `{ name, contactEmail?, contactPhone? }` |
| GET | `/insurance/policies?patientId=` | manage roles | — |
| POST | `/insurance/policies` | manage roles | `{ patientId, providerId, policyNumber, memberName?, validFrom?, validTo? }` |
| GET | `/insurance/claims?invoiceId=&policyId=` | manage roles | — |
| GET | `/insurance/claims/:id` | manage roles | — |
| POST | `/insurance/claims` | manage roles | `{ invoiceId, policyId, claimedAmount, notes? }` — 400 if the policy's patient doesn't match the invoice's, or `claimedAmount` exceeds the invoice total |
| PATCH | `/insurance/claims/:id/respond` | CLINIC_OWNER, ACCOUNTANT | `{ status: APPROVED\|PARTIALLY_APPROVED\|REJECTED\|PAID, approvedAmount?, notes? }` — `approvedAmount` required unless `REJECTED`; `PAID` calls `BillingService.recordPayment` (method `INSURANCE`) |

### Notifications (`/notifications`)

CLINIC_OWNER only, read-only — an audit log, not a way to trigger sends
(those happen from the module that owns the event: appointments, billing,
prescriptions). See [Architecture § Notifications](#5-architecture) for the
provider model (email is real, SMS/WhatsApp are not).

| Method | Path | Returns |
|---|---|---|
| GET | `/notifications?status=` | up to 200 most recent `Notification` rows for the clinic |

### Patient Portal (`/patient-portal`)

PATIENT role only. Identity-scoped by the caller's own `userId`, not
clinic-scoped — a patient can have appointments/prescriptions/invoices at
several clinics (see [Architecture § Patient Portal](#5-architecture)).

| Method | Path | Body |
|---|---|---|
| GET | `/patient-portal/me` | — |
| GET | `/patient-portal/appointments` | — across every clinic |
| GET | `/patient-portal/prescriptions` | — across every clinic |
| GET | `/patient-portal/invoices` | — across every clinic |
| GET | `/patient-portal/clinics` | — clinics with a published website, the only ones bookable from the portal |
| GET | `/patient-portal/clinics/:clinicId/doctors` | — |
| GET | `/patient-portal/available-slots?clinicId=&doctorId=&date=` | — |
| POST | `/patient-portal/appointments` | `{ clinicId, doctorId, scheduledAt, reasonForVisit? }` — finds or creates the caller's `Patient` row at that clinic |

Not built: downloading a prescription/invoice PDF from the portal (the
existing PDF endpoints are staff-scoped via `TenantGuard`; a patient-scoped
variant is a small follow-up, not done here), and paying an invoice online
(no payment gateway at all yet — see [Architecture § Billing](#5-architecture)).

---

## 7. Testing

### What exists today

- `apps/api/src/auth/password.util.spec.ts` — hash/verify round-trip and
  wrong-password rejection.
- `apps/api/src/common/guards/tenant.guard.spec.ts` — `TenantGuard` behavior for
  staff (tenant from JWT), `SUPER_ADMIN` (optional `x-clinic-id` override), and a
  user with no `clinicId` (rejected).
- `apps/api/src/common/guards/roles.guard.spec.ts` — `RolesGuard` allow/deny by
  role, and the "no `@Roles()` metadata → allow any authenticated user" default.
- `apps/api/src/{clinics,doctors,patients,appointments,staff,billing,reports,notifications,prescriptions,patient-portal,branches,inventory,pharmacy,insurance,audit-log}/*.service.spec.ts`
  — one spec per service, mocking `PrismaService` directly (no DB). Each covers
  the tenant-isolation case ("does a query scoped to clinic A ever return or
  touch clinic B's row" — for `patient-portal`, the equivalent "own userId
  only, never another patient's") and the module's specific business rule
  where there is one (appointment double-booking, duplicate-email rejection,
  staff deactivation revoking live sessions, invoice balance/status
  transitions, report aggregation grouping — including the `branchId` filter
  and that it never leaks into the branch-unaware `newPatients` count —
  notification dispatch never throwing, find-or-create `Patient` row on
  first portal booking, branch CRUD tenant isolation, pharmacy dispense —
  unknown item and insufficient stock both rejected inside the same
  transaction as every other line, so nothing is left partially dispensed —
  and insurance claims:
  policy-patient/invoice-patient mismatch rejected, claimed amount capped
  at the invoice total, `PAID` response routed through
  `BillingService.recordPayment`, `REJECTED` response never touching
  billing at all — and the four advanced-analytics methods: doctor revenue
  attributed via the invoice's linked appointment rather than any direct
  doctor field, popular-services sorted correctly by revenue descending,
  and patient retention's zero-appointments short circuit not issuing a
  second query it doesn't need — and, added 2026-07-22 with the QA/security
  audit fixes: `patients.service.spec.ts` covers soft-delete being logged
  and idempotent and `list()` excluding/including inactive patients
  correctly; `audit-log.service.spec.ts` covers scoping and record shape.
- `apps/api/src/auth/auth.service.spec.ts` (added 2026-07-22) — login
  rejecting unknown/wrong-password/deactivated/unverified accounts (each
  with the right side effect on `LoginEvent`), the 5-failed-attempts
  lockout, password reset end-to-end including that only a *hash* of the
  token is ever stored, rejecting a same-as-current-password reset, a
  wrong-purpose token (verify-email token used to reset) being rejected,
  and email verification / resend never leaking whether an address is
  registered.
- `apps/api/src/common/pagination.util.spec.ts` (added 2026-07-22) —
  defaults, `skip`/`take` math, clamping an oversized `pageSize` rather
  than allowing an unbounded request through, and garbage input falling
  back to the default instead of propagating `NaN`.
- `apps/api/src/cron/{cron.service,cron-secret.guard}.spec.ts` — the
  reminder query being clinic-agnostic (a system job, not tenant-scoped),
  the tomorrow-calendar-day window, dedup against an already-sent reminder,
  and the shared-secret guard rejecting a missing/wrong header or an
  unconfigured `CRON_SECRET`.
- `apps/api/src/appointments/available-slots.util.spec.ts` — the shared
  slot-computation logic (excludes booked times, ignores other days/inactive
  windows, never returns a past slot) plus `resolveBranchForTime` (which
  availability window's branch a booked time falls into, or `null`), used by
  both staff and portal booking.
- `apps/api/src/doctors/doctors.service.spec.ts` also covers
  `setAvailability` rejecting a `branchId` that doesn't belong to the
  caller's clinic, rejecting a duplicate branch-less `(dayOfWeek,
  startTime)` slot within the same request, and allowing the same
  day/time for two different branches.
- `apps/api/src/inventory/inventory.service.spec.ts` — stock computed as
  the ledger sum (including "no transactions yet" → 0, not `null`),
  low-stock filtering against each item's own `reorderLevel`, correct sign
  applied per transaction type, negative-stock rejection, and that a
  branch-scoped pool and the branch-less pool for the same item stay
  separate rather than merging.
- `apps/api` has a Jest config (`apps/api/jest.config.js`); `apps/web` and
  `packages/database` have no test setup yet.

This covers the tenant-isolation/auth-boundary floor for every Phase 1 + Phase 2
module (added 2026-07-21 in an audit pass — see [Changelog](#12-changelog)), not
full coverage — no integration/e2e tests exist (those need a real Postgres,
which this environment doesn't always have available), and business-logic edge
cases beyond what's listed above aren't all covered yet. The project's target
(carried over from the original spec) is 80% coverage; treat the tenant-isolation
+ auth-boundary bar as the non-negotiable minimum for new modules, and add to it
rather than assuming it's already complete.

### Running tests

```bash
pnpm test                                  # everything, via turbo
pnpm --filter @digital-clinic/api test     # just the API
```

There is no e2e test setup yet (no `test:e2e` script) — only unit tests today.
Add a proper Nest e2e harness (a real test database, `supertest` against a booted
`INestApplication`) when the first e2e test is actually written, rather than
scaffolding an empty one now.

### What to test for a new module

1. **Tenant isolation** — clinic A's token cannot read/write clinic B's data
   through this endpoint.
2. **Role boundary** — a role that shouldn't be able to call this endpoint gets
   403, not a silent success.
3. **Validation** — the DTO actually rejects malformed/extra fields (the global
   `ValidationPipe` runs `whitelist: true, forbidNonWhitelisted: true`).
4. Business logic (the actual feature) last — the above three are what turn a bug
   into a cross-tenant data leak, so they come first.

---

## 8. Deployment

### Target environments

**apps/web → Vercel, apps/api → Render, database → Neon, appointment
reminders → cron-job.org.** Cloudflare R2 (object storage) is named as the
intended provider but not yet wired into any code (no file-upload feature
exists yet). `docker-compose.yml` only stands up local Postgres for
development — not a deployment artifact.

### Neon (database)

1. Create a project at [neon.tech](https://neon.tech). Free tier works for
   development; move to a paid plan (Launch or above) before real patient
   data goes in it — free tier's storage cap (0.5 GB) and 6-hour
   point-in-time-recovery window are tight for production use.
2. Copy the connection string (includes `?sslmode=require`) — this is
   `DATABASE_URL`.
3. **Before the first deploy**, generate the initial migration locally
   (this repo has none yet — see [§ Database migrations](#database-migrations-in-production)
   below): `pnpm db:migrate` against a local Postgres, commit the generated
   `packages/database/prisma/migrations/` directory.

### Render (backend, `apps/api`)

`render.yaml` in the repo root is a Render Blueprint — connect the repo,
choose "New +" → "Blueprint" in the Render dashboard, and it reads this file
automatically instead of needing manual service configuration. It:
- Runs `prisma migrate deploy` (not `migrate dev`) before starting the
  server on every deploy, so schema changes apply automatically.
- Uses the `starter` plan, not free — Render's free web services spin down
  after 15 minutes idle and take 30–60s to cold-start on the next request,
  which reads as "broken" to a receptionist booking the first appointment
  of the day.
- Defines a health check at `GET /health` (`apps/api/src/app.controller.ts`,
  intentionally `@Public()`).
- Auto-generates `JWT_ACCESS_SECRET` and `CRON_SECRET`. You still need to
  set manually in the Render dashboard: `DATABASE_URL` (from Neon),
  `API_CORS_ORIGIN` (the Vercel frontend URL, set after the next step),
  and `SMTP_*` if you want real email notifications rather than recorded
  failures.

### Vercel (frontend, `apps/web`)

No `vercel.json` needed — `apps/web` has no dependency on
`@digital-clinic/database` or any workspace package (it talks to the API
only over HTTP), so Vercel's standard Next.js build works with dashboard
settings alone:

1. Import the repo into Vercel, framework preset **Next.js**.
2. **Root Directory**: `apps/web`. Vercel auto-detects the pnpm workspace
   root from `pnpm-workspace.yaml` at the repo root.
3. Environment variables: `NEXT_PUBLIC_API_URL` (the Render backend URL,
   including `/api/v1` — see `lib/constants.ts`), `NEXT_PUBLIC_APP_DOMAIN`.
4. After deploying, go back to Render and set `API_CORS_ORIGIN` to this
   Vercel URL (CORS is enforced in `apps/api/src/main.ts`).

### cron-job.org (appointment reminders)

`NotificationType.APPOINTMENT_REMINDER` existed in the schema since Phase 2
but nothing triggered it until `apps/api/src/cron/` — an endpoint an
external scheduler calls once a day, rather than an in-process
`@nestjs/schedule` job (Render's free/starter tiers don't guarantee a
long-running process stays warm the way a dedicated cron worker would, and
this avoids adding that infrastructure for one daily job).

1. At [cron-job.org](https://cron-job.org), create a job:
   - URL: `https://<your-render-url>/api/v1/internal/cron/appointment-reminders`
   - Method: `POST`
   - Header: `x-cron-secret: <the CRON_SECRET Render generated>`
   - Schedule: once daily, e.g. 7:00 AM in the clinic's timezone.
2. The endpoint finds every `CONFIRMED` appointment scheduled for the next
   calendar day across all clinics, emails a reminder, and skips any
   appointment that already has one recorded (dedup via
   `NotificationsService.reminderAlreadySent`, checked against
   `Notification.appointmentId`) — safe to trigger more than once without
   double-sending. Auth is the shared-secret header only (`CronSecretGuard`)
   — this route is deliberately `@Public()` since the caller isn't a logged-in
   user, and it isn't tenant-scoped (it's a system job, not a per-clinic
   request) — see the doc comment on `CronService.sendAppointmentReminders`.

### Environments

Local → Staging → Production is the intended separation; only local +
production exist today. A staging setup is cheap to add later — Neon
supports database branching (a copy-on-write DB branch from production),
Render a second service pointed at a different branch, and Vercel already
creates a preview deployment per branch/PR automatically.

### CI

`.github/workflows/ci.yml` runs install → generate Prisma client → lint →
typecheck → test → build on every push/PR to `main`. There is no CD (automatic
deploy) yet. No `pnpm-lock.yaml` is committed yet either (this repo's first
`pnpm install` with pnpm actually available hasn't happened) — CI runs a plain
`pnpm install` until one exists, then should switch to
`pnpm install --frozen-lockfile` so an out-of-date lockfile fails CI instead of
silently re-resolving.

### Database migrations in production

No migrations have been generated yet (`packages/database/prisma/migrations/`
doesn't exist — every environment so far has run `prisma migrate dev` fresh
against a throwaway local database). Before the first real deploy: run
`pnpm db:migrate` locally to generate the initial migration, commit it, and use
`prisma migrate deploy` (not `migrate dev`) in any non-local environment.

### Backups / disaster recovery

Not yet configured — delegated to the managed Postgres provider's defaults until
a real backup/restore policy is written down here.

---

## 9. Troubleshooting

**`pnpm install` / `pnpm dev` fails immediately, or `node`/`pnpm`/`docker` aren't
found** — this repo is sometimes worked on in a sandbox without them installed;
see [Prerequisites](#3-getting-started).

**Prisma client import errors (`Cannot find module '@digital-clinic/database'`)**
— run `pnpm db:generate` (`prisma generate`) first; the client is generated into
`packages/database/generated/client`, not committed.

**`prisma migrate dev` asks to reset the database / no migrations folder exists**
— expected the first time; a fresh `migrations/` directory and initial migration
are created from the current `schema.prisma`.

**Login succeeds but every request 403s** — check the account's `role` is
actually permitted on that route (see [API reference](#6-api-reference)); the
`RolesGuard` denies by default when `@Roles(...)` is present and the role isn't
listed.

**A staff member can't log in anymore** — check `isActive` on their `User` row;
deactivating via `PATCH /staff/:id/status` blocks login/refresh immediately
(see [Architecture → Auth](#5-architecture)).

**RLS policies don't seem to do anything** — correct, by design for now; they're
not wired into the request path yet. Don't rely on them as a backstop until
`PrismaService.forTenant()` is called from every request and the API connects as
a non-owner DB role. Application-level `clinicId` filtering is the enforced
boundary today.

**Subdomain routing (`{slug}.platform.local`) doesn't work locally** — expected;
use `http://localhost:3000/c/{slug}` directly instead (see
[Getting started](#3-getting-started)).

**Got logged out of the dashboard after ~15 minutes** — shouldn't happen as of
2026-07-21; `middleware.ts` and the `/api/[...path]` proxy both silently refresh
an expired access token using the refresh token cookie first (see
[Architecture § Auth](#5-architecture)). If you still see this, the refresh
token cookie itself is either missing or its own 30-day lifetime has passed —
both cases correctly fall back to `/login`.

---

## 10. Contributing & conventions

### Workflow

1. Branch off `main`: `type/short-description`, e.g. `feat/staff-management`,
   `fix/refresh-token-reuse`, `docs/api-reference`.
2. Keep commits scoped and descriptive — one logical change per commit. Explain
   the *why* in the body when it isn't obvious from the diff.
3. Before opening a PR: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
   all pass, and this README's relevant chapter + [Changelog](#12-changelog) are
   updated for any user-visible or API-shape change.
4. Open a PR against `main` with a summary of what changed and why, and a test
   plan.

### Code conventions

- **Module shape (API)**: guard → controller → service → DTO, following
  `apps/api/src/patients/` as the reference. Every service method touching a
  tenant-owned table takes `clinicId` as its first argument and filters
  explicitly by it — never rely on `TenantGuard` alone.
- **New roles/permissions**: extend the existing `Role` enum and `@Roles(...)`
  decorator pattern; don't add a parallel permissions system — the RBAC model
  assumes one source of truth.
- **DTO validation**: every request body gets a `class-validator`-annotated DTO;
  the global `ValidationPipe` rejects untyped fields rather than dropping them
  silently, so a DTO that's missing a field is a bug, not a no-op.
- **No dead config**: add an env var and wire it up in the same change; remove
  it from `.env.example` when the last usage goes away.
- **Comments**: only where the *why* isn't obvious — a constraint, a workaround,
  a non-obvious invariant. Don't restate what the code does.
- **Scope decisions get recorded** at the decision point in code (e.g. why
  `staff` excludes `DOCTOR`), not only in a commit message.

### Frontend conventions

The UI/UX bar for this project (responsive, accessible, consistent, every
interaction gives clear feedback — see [Roadmap § UI/UX quality bar](#2-roadmap))
applies incrementally to whatever's being built, not as a retrofit project. What
that means day to day:

- **Components**: extend `apps/web/src/components/ui/` (`Button`, `Input`,
  `BarChart`, `Modal`, `Tabs`, `Pager`) rather than styling one-off elements
  inline. `Pager` (added 2026-07-22) is plain prev/next links with a `page`
  query param — no client JS, matching the existing branch-filter-on-reports
  convention — currently used by `/dashboard/patients` only.
  `Modal` is a hand-rolled focus-trapped dialog (portal, Escape to close,
  focus returned to the trigger on close — no dependency exists for this,
  see `apps/web/package.json`); `Tabs` follows the WAI-ARIA tabs pattern
  (roving tabindex, arrow-key navigation, panels stay mounted so a tab's
  in-progress form state survives switching away and back). Both only have
  real callers so far — `Tabs` on `/dashboard/insurance` (providers/
  policies/claims); `Modal` as a confirm-before-deactivating step on Staff
  and Branches, and on cancelling an invoice (replacing a `window.confirm()`
  that was always meant as a stopgap — see its old comment in git history)
  — extend rather than duplicate when the next page needs the same shape,
  but don't reach for `Modal` for a non-destructive action; the existing
  inline-expand form pattern (`NewStaffForm.tsx` etc.) is still right for
  those. When a page needs something that doesn't exist yet (a data table,
  a date picker), add it there so the next page that needs one reuses it
  instead of a second implementation with its own quirks.
- **Loading/error feedback**: follow the pattern already established in
  `NewPatientForm.tsx` / `NewStaffForm.tsx` — a `submitting` state that disables
  the submit button and swaps its label, inline error text from the API
  response, and `router.refresh()` on success. Don't ship a form or button that
  silently does nothing while a request is in flight.
- **Responsive**: check new pages at desktop, ~1024–1280px (laptop), tablet, and
  mobile widths — no horizontal scroll, no clipped content.
- **Accessibility pass, 2026-07-22** (focus states/ARIA/contrast, across every
  page that existed at the time — not just what this session added): every
  form's error message now has `role="alert"` so it's actually announced
  instead of relying on the user spotting red text; every previously-unlabeled
  input in a repeating row (line items, medicines, dispense lines) got an
  `aria-label`; the appointment-slot toggle buttons gained `aria-pressed`;
  `Button` gained a visible `focus-visible` ring (previously the browser
  default only); the two `text-slate-400` secondary-text usages and one
  `text-amber-600` status label were below WCAG AA contrast on white and are
  now `slate-500`/an `amber-700`-on-`amber-50` pill, matching the status-pill
  convention used elsewhere. **Not done in this pass** — real gaps, not
  claimed: `<th>` elements across the app's data tables don't have explicit
  `scope="col"` (most screen readers infer it from simple `<thead>` structure
  anyway, but it's not asserted); no dark mode; no breadcrumbs; no mobile nav
  drawer (the dashboard sidebar is desktop-only today). Close these when the
  page/feature you're building actually needs it, not speculatively.

This is a private, proprietary codebase — these conventions are for the team
(and any contracted contributors), not a public open-source contribution guide.

---

## 11. Security policy

Digital Clinic SaaS handles patient health information. Treat any suspected
vulnerability — especially anything touching tenant isolation, authentication, or
patient records — as high priority.

### Reporting a vulnerability

This is a private repository with no public issue tracker for security reports.
Email **[security contact — add a monitored address before this doc is shared
outside the core team]** with a description of the issue and its impact, steps to
reproduce or a proof of concept, and whether it's known to be actively exploited.
Do not open a GitHub issue or PR describing the vulnerability publicly. Expect an
acknowledgement within 2 business days.

### Supported versions

Pre-1.0, single deployed version — fixes land on `main` and go out with the next
deploy. No separate LTS/patch branch yet.

### Current posture

| Layer | Status |
|---|---|
| Tenant isolation (JWT-derived `clinicId` + explicit query filtering) | Enforced on every request |
| Postgres row-level security (`rls.sql`) | Written, **not yet wired** into the request path |
| Password hashing (scrypt + random salt, constant-time compare) | Enforced |
| Refresh tokens (hashed at rest, rotated every use, revocable) | Enforced |
| Email verification | Enforced at login; self-registration only (see [Architecture § Auth](#5-architecture)) |
| Account lockout | Per-account, 5 failed attempts / 15 min, complementing the IP-based login throttle |
| Password reset | Token-based (`VerificationToken`), revokes existing sessions on use |
| Rate limiting (`ThrottlerGuard`) | 100 req/min default; tighter limits on login (5/min), registration/forgot-password/resend-verification (5–10/min), and patient/staff/invoice creation (20/min) |
| CORS | `API_CORS_ORIGIN` required (no dev fallback) when `NODE_ENV=production` — fails loudly at boot instead of defaulting |
| Request body size | Capped at 1MB explicitly (was relying on Express defaults) |
| JWT algorithm | Pinned to `HS256` on both sign and verify (defense-in-depth — passport-jwt's own defaults were already safe) |
| CSRF | N/A — bearer-token API, not cookie-authenticated; revisit if that changes |
| Input validation | `class-validator` DTOs, `whitelist: true` on every route, numeric/quantity fields bounded with `@Max` |
| Audit logging | Login events (`LoginEvent`) plus a general-purpose `AuditLog` — only Patient soft-delete/restore emits to it today, not every mutation |
| Soft delete | Patients (only — see [Architecture § Patients](#5-architecture)); staff/branches/inventory items already had this |
| Encryption at rest | Delegated to the managed Postgres provider — no field-level encryption yet |
| Dependency scanning / SAST | Not yet configured |
| 2FA | Removed unimplemented schema scaffolding rather than half-build it (2026-07-22) — see Changelog |

If you're changing authentication, tenant scoping, or role checks, treat it as
security-sensitive: get a second review before merging, regardless of how small
the diff looks.

---

## 12. Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project doesn't follow semver yet (pre-1.0, no tagged releases) — entries are
grouped by what landed, most recent first.

### [Unreleased]

**Security** — response to the full QA/security audit (2026-07-22): 18 of 24
findings fully fixed, 2 partially (documented below), 4 acknowledged with no
code change because the audit itself said so (not urgent, or already fine).
The audit's own release recommendation was "No-Go — one blocker"; that
blocker (patient hard-delete) is the first item here.
- **Patients are soft-deleted, not hard-deleted** (Critical — TC-SEC-01,
  High — TC-DB-01). `DELETE /patients/:id` used to cascade-destroy a
  patient's entire clinical/billing/insurance history in one irreversible
  call with nothing logged. Now flips `Patient.isActive` (same pattern as
  staff/branches/inventory items) and logs to a new `AuditLog` model;
  `PATCH /patients/:id/restore` undoes it. See
  [Architecture § Patients](#5-architecture).
- **Password reset + email verification, for real** (High — TC-AUTH-01;
  Medium — TC-AUTH-02). `POST /auth/forgot-password` /
  `/reset-password` / `/verify-email` / `/resend-verification`, a new
  `VerificationToken` model (same hashed-random-token shape as
  `RefreshToken`), and `/forgot-password` + `/reset-password` +
  `/verify-email` pages. `login()` now actually enforces
  `isEmailVerified` — previously set at signup and never read again.
- **Pagination, applied honestly, not cosmetically** (Medium —
  TC-FUNC-01/TC-PERF-01). Every list endpoint used to run a fully unbounded
  query. `/patients` gets real pager UI (`GET /patients` now bounded +
  counted, `components/ui/Pager.tsx`); seven more (appointments, invoices,
  staff, notifications, inventory, prescriptions, insurance) are now
  bounded (`take: 200`) without page-through UI yet — see
  [Architecture § Patients](#5-architecture) for why the response shape
  didn't change to avoid breaking every existing caller.
- **Per-account login lockout** (Medium — TC-AUTH-04): 5 failed attempts /
  15 min, complementing the existing IP-based throttle on `/auth/login`.
- **2FA schema scaffolding removed** (Medium — TC-AUTH-03):
  `User.isTwoFactorEnabled`/`twoFactorSecret` had zero implementation
  behind them — worse than absent, since the data model implied protection
  that didn't exist. Real TOTP-based MFA is a standalone feature, not
  something to half-build here.
- **General audit log** (Low — TC-DB-04): new `AuditLog` model + `GET
  /audit-log` (CLINIC_OWNER). Only Patient soft-delete/restore emits to it
  today — extend call-site by call-site as other modules' trails become
  worth having, not speculatively.
- **Scoped error/loading boundaries** (Medium — TC-UX-01; Low — TC-UX-02):
  `(dashboard)/dashboard/error.tsx` and `portal/error.tsx` so a failed
  panel doesn't take the sidebar/header down with it (previously only one
  `app/error.tsx` existed, at the root); `loading.tsx` for Reports,
  Advanced analytics, and Billing.
- **Hardening**: JWT algorithm pinned to `HS256` on sign + verify
  (Low — TC-AUTH-08); `API_CORS_ORIGIN` required with no dev fallback in
  production (Low — TC-SEC-07); explicit 1MB request body size limit
  (Low — TC-API-03); tighter per-route throttling on registration,
  password-reset requests, and patient/staff/invoice creation
  (Low — TC-SEC-08); every quantity/amount DTO field bounded with `@Max`,
  not just checked for a sane minimum (Low — TC-FUNC-02); resetting a
  password now rejects reusing the current one, and revokes every existing
  session (Low — TC-AUTH-05, partial — no N-deep history or breach-list
  check, which would need either a history table or an external API); the
  unused `STORAGE_*` env vars and the never-built file-upload path are now
  documented as unimplemented rather than looking wired up
  (Low — TC-FUNC-03); `NewInvoiceForm` pre-validates discount+tax against
  subtotal client-side instead of only catching it after a round trip
  (Low — TC-EDGE-02).
- **Acknowledged, no code change** — the audit's own text already called
  these not urgent or already-adequate: sequential invoice numbers are
  never used as a lookup key so there's no real enumeration path
  (Medium — TC-HACK-02); role checks only living at the controller layer
  is "not urgent given the consistency found... worth a lint rule if the
  team grows" (Low — TC-AUTHZ-03); report aggregation happening in
  application code instead of SQL `GROUP BY` is "a deliberate, documented
  tradeoff... worth revisiting if [data volume] grows"
  (Low — TC-PERF-02); Unicode/emoji handling was already confirmed fine
  (Postgres `text` columns are UTF-8 by default, no charset-restricting
  validator exists) (Low — TC-EDGE-03).
- Fixed a real bug found while writing `AuthService.requestPasswordReset`:
  it passed the looked-up `user.email` (typed `string | null`, since email
  is an optional column) to the mailer instead of the function's own
  non-null `email` parameter — a type error, not a runtime bug, but a
  reminder that "found by X" doesn't make TypeScript treat a field as
  narrowed to X.

**Added**
- **Doctor management UI.** `/dashboard/doctors` — the dashboard page that's
  been missing since Phase 1: list, create, edit profile, and a
  weekly-availability editor at `/dashboard/doctors/:id` (full-schedule
  replace per `PATCH /doctors/:id/availability`, pre-filled with the
  doctor's current week, per-slot `branchId` only offered once the clinic
  has a branch). See [Architecture § Multi-branch](#5-architecture).
- **`Modal` and `Tabs`** join `components/ui/` (see
  [Contributing § Frontend conventions](#10-contributing--conventions)).
  `Tabs` now runs `/dashboard/insurance`'s providers/policies/claims
  sections; `Modal` now gates Staff and Branch deactivation behind a
  confirm step (reactivating stays a single click — it isn't destructive).
  `Button` gained a `danger` variant for the confirm action and a visible
  focus-visible ring (previously relied on the browser default).
- **Phase 3 complete — advanced analytics, the last item.** Extends the
  existing Reports endpoints rather than a new module (see
  [Architecture § Advanced analytics](#5-architecture)): doctor performance
  (appointments + revenue attributed via the linked appointment), popular
  services (aggregated from `Invoice.lineItems`), a daily patient-growth
  series, and patient retention (returning vs. new in a window).
  `resolveRange`/`dayKey` extracted to `apps/api/src/reports/date-range.util.ts`
  so the original four Reports endpoints and these four share one
  implementation. `/dashboard/reports/advanced`, plus a new shared
  `components/ui/BarChart.tsx` (extracted from the Reports page's revenue
  chart — this is its second caller, not a speculative extraction).
- **Phase 3, insurance.** `InsuranceProvider` (catalog) + `InsurancePolicy`
  (per-patient coverage) + `InsuranceClaim` (filed against an invoice).
  Claims settle *through* Billing — marking a claim `PAID` calls
  `BillingService.recordPayment` (new `PaymentMethod.INSURANCE` value)
  rather than touching `Invoice.amountPaid` directly, reusing its balance
  logic (see [Architecture § Insurance](#5-architecture)). Filing a claim
  validates the policy belongs to the invoice's own patient and that
  `claimedAmount` doesn't exceed the invoice total. `apps/api/src/insurance/`,
  `/dashboard/insurance` (providers, policies, claims + inline
  approve/reject/pay), `insurance.service.spec.ts`.
- **Phase 3, pharmacy.** Dispensing a prescription against Inventory —
  built as a workflow over the existing `Prescription`/`Inventory` models
  rather than a new domain (see [Architecture § Pharmacy](#5-architecture)):
  `Prescription.dispensedAt` + `InventoryTransaction.prescriptionId`,
  `apps/api/src/pharmacy/` (pending list, dispense — pre-validates every
  line before writing any transaction), `/dashboard/pharmacy` +
  `/dashboard/pharmacy/[id]` UI, `pharmacy.service.spec.ts`. No new
  `PHARMACIST` role. `InventoryService.recordTransaction` gained an
  internal (not DTO-exposed) `prescriptionId` param to link a dispense back
  to its prescription without duplicating stock-write logic.
- **Deployment.** `render.yaml` blueprint for `apps/api` (Render), a
  `GET /health` endpoint it depends on, and concrete Vercel/Neon/cron-job.org
  setup steps in [Deployment](#8-deployment) — apps/web needs no `vercel.json`
  since it has no dependency on `@digital-clinic/database` (talks to the API
  only over HTTP). Closed a real gap this surfaced: `NotificationType
  .APPOINTMENT_REMINDER` existed since Phase 2 but nothing ever triggered
  it — `apps/api/src/cron/` is a shared-secret-guarded, `@Public()`,
  non-tenant-scoped endpoint an external scheduler calls daily, finding
  tomorrow's confirmed appointments and emailing reminders with dedup via a
  new `Notification.appointmentId` field.
- **Phase 3, inventory.** `InventoryItem` (catalog) + `InventoryTransaction`
  (append-only signed-delta ledger — current stock is always computed via
  `SUM(quantity)`, never cached, see
  [Architecture § Inventory](#5-architecture)). `apps/api/src/inventory/`:
  item CRUD (CLINIC_OWNER), stock transactions (CLINIC_OWNER/NURSE/
  RECEPTIONIST) with negative-stock rejection, low-stock listing, optional
  per-branch stock pools tracked separately from the branch-less pool for
  the same item. `/dashboard/inventory` + `/dashboard/inventory/[id]` UI,
  `inventory.service.spec.ts`. Seed data: two demo items (one low-stock).
- **Phase 3, multi-branch (module Z).** Additive, non-breaking: `Branch`
  model + optional `branchId` on `DoctorAvailability`/`Appointment`/
  `Invoice`/`Prescription`/staff `User` (see
  [Architecture § Multi-branch](#5-architecture) for why this avoids the
  breaking migration multi-branch usually implies). `apps/api/src/branches/`
  (CRUD, `branches.service.spec.ts`), branch resolved automatically at
  booking time from which `DoctorAvailability` window a time falls into
  (`resolveBranchForTime`, new in `available-slots.util.ts`, tested),
  inherited onto invoices/prescriptions from their linked appointment,
  optional `?branchId=` filter on all three Reports endpoints.
  `/dashboard/branches` UI + a branch filter dropdown on `/dashboard/reports`
  (plain GET form, no client JS needed).
  - Bug found and fixed while wiring this: `appointments.service.spec.ts`
    was never updated when `AppointmentsService` gained a `NotificationsService`
    dependency during Phase 2 — the test file still called `new
    AppointmentsService(prisma)` with one argument. Fixed alongside the
    branch-resolution changes to that same service.
- **Phase 2 complete.** Three more modules landed in the same pass as the
  entries below:
  - **Notifications**: `Notification` model/audit log, pluggable providers
    (`apps/api/src/notifications/providers/`) — real SMTP email via
    `nodemailer`, honest not-configured SMS/WhatsApp stubs (no vendor account
    for this project — never faked as sent). Wired into appointment
    confirmation, invoice created, payment received, prescription ready.
    `/dashboard/notifications` audit view.
  - **Prescriptions**: `apps/api/src/prescriptions/` (doctor-authored, medicines
    list, PDF via `pdfkit`, one-per-appointment), `/dashboard/prescriptions` +
    `/dashboard/prescriptions/[id]` UI.
  - **Patient Portal**: `/auth/register-patient` + reused `/auth/login`,
    `apps/api/src/patient-portal/` (identity-scoped by `userId`, no
    `TenantGuard` — the one module where that's correct, see
    [Architecture § Patient Portal](#5-architecture)), full `/portal` route
    group (register/login/overview/appointments/prescriptions/invoices/book).
    `middleware.ts` now protects `/portal/:path*` the same way it protects
    `/dashboard/:path*`.
  - Extracted `apps/api/src/appointments/available-slots.util.ts` (pure slot
    computation) out of `AppointmentsService` so `PatientPortalService` could
    reuse it instead of duplicating the logic; `available-slots.util.spec.ts`
    added.
  - Tenant/identity-isolation tests for all three new services plus the
    extracted slot util — see [Testing § What exists today](#7-testing).
- **Billing** (Phase 2): `Invoice`/`Payment` models, `apps/api/src/billing/`
  (create invoice with line items/discount/tax, manual payment recording,
  cancellation, PDF download via `pdfkit`), `/dashboard/billing` +
  `/dashboard/billing/[id]` UI, `billing.service.spec.ts`. No online payment
  gateway — see [Architecture § Billing](#5-architecture) for why.
- **Reports** (Phase 2): `apps/api/src/reports/` (`overview`/`revenue`/
  `appointments`, tenant-scoped, CLINIC_OWNER + ACCOUNTANT), `/dashboard/reports`
  UI with a dependency-free daily-revenue bar chart, `reports.service.spec.ts`.
- `PatientsController` GET routes now also allow ACCOUNTANT (read-only) —
  billing needs to look up a patient to invoice; ACCOUNTANT previously had no
  patient access at all. Write access (create/update/delete) unchanged.
- Dashboard Overview page now redirects ACCOUNTANT to `/dashboard/billing`,
  since Overview depends on `/appointments` and `/patients` list endpoints
  ACCOUNTANT still can't call.
- Dashboard nav links are now filtered by role generally (previously only
  "Staff" was role-gated) — see `apps/web/src/app/(dashboard)/dashboard/layout.tsx`.
- This consolidated README (setup, architecture, API reference, testing,
  deployment, troubleshooting, contributing, security, changelog, license all in
  one place) and `CLAUDE.md` (agent-specific instructions, kept separate — see
  the note under the title).
- Documented the cross-platform (web + mobile) goal: a standing requirement,
  not a scheduled phase, that the platform grow into 7 client apps sharing one
  API-first backend (React Native preferred for mobile, not started yet). See
  [Roadmap](#2-roadmap) and [Architecture § API-first design](#5-architecture).
- Documented the UI/UX quality bar (responsive/accessible/consistent, every
  interaction gives feedback) as a standing requirement applied incrementally,
  plus an honest snapshot of what the frontend has today vs. still needs (dark
  mode, a11y pass, most of the component library). See
  [Roadmap](#2-roadmap) and [Contributing § Frontend conventions](#10-contributing--conventions).
- **Staff management** (Phase 2, first module): clinic owners can create,
  update, and deactivate/reactivate RECEPTIONIST, NURSE, and ACCOUNTANT accounts
  (`apps/api/src/staff/`, dashboard page at `/dashboard/staff`). Deactivation
  revokes live refresh tokens immediately and blocks future logins/refreshes.
  DOCTOR accounts remain managed via `apps/api/src/doctors/` since they also own
  a `DoctorProfile`.
- `User.isActive` column (default `true`) backing the above.
- First unit tests: password hashing round-trip and `TenantGuard` behavior.
- Jest config for `apps/api` (previously the `test` script had nothing to run).
- ESLint config for `apps/api` (previously `lint` referenced eslint with no
  config and no `eslint` devDependency — it would have failed on first run).
- Root `.prettierrc.json` / `.prettierignore` (prettier was a root devDependency
  with no explicit config).
- `.github/workflows/ci.yml`: install, lint, typecheck, test, build on
  push/PR to `main`.

**Fixed** — gaps flagged by the QA/security review, closed 2026-07-22:
- **Pharmacy multi-line dispense is now atomic.** `PharmacyService.dispense`
  wraps every line's check + write in one `prisma.$transaction`, passed
  through `InventoryService.recordTransaction`'s new optional trailing `db`
  parameter (defaults to the ambient `PrismaService`, so every other caller
  is unaffected). See [Architecture § Pharmacy](#5-architecture).
- **`DoctorAvailability` duplicate branch-less slots are now rejected.**
  Postgres can't enforce this itself (`NULL != NULL`); `setAvailability`
  now rejects a duplicate `(branchId, dayOfWeek, startTime)` within the same
  request with a 400. See [Architecture § Multi-branch](#5-architecture).
- **`Branch.isActive` deactivation is now actually enforced somewhere.**
  The doc comment on `BranchesService.setStatus` always described this;
  the doctor-availability editor is the first real caller that reads it.
  See [Architecture § Multi-branch](#5-architecture).
- `Input` silently replaced its whole `className` instead of merging it
  (any caller passing one, e.g. for a grid span, would have lost the
  component's own input styling entirely) — no caller hit this until the
  new Doctor forms needed it. Fixed to merge onto the wrapping `<div>`.
- **Accessibility pass** across every page that existed before this session
  (focus states, ARIA, contrast) — see
  [Contributing § Frontend conventions](#10-contributing--conventions) for
  the full breakdown of what changed and what's still honestly outstanding.

**Fixed** — Phase 1 + Staff Management audit against the engineering charter's
Definition of Done (`CLAUDE.md`), 2026-07-21:
- Removed `JWT_REFRESH_SECRET` from `.env.example` — refresh tokens are opaque
  random bytes hashed with SHA-256 at rest, never JWT-signed, so this variable
  was unused and misleading.
- **No token refresh flow existed** — access tokens expire every 15 minutes and
  nothing ever called `/auth/refresh`, so every session hard-failed after 15
  minutes despite a valid 30-day refresh token. `middleware.ts` now silently
  refreshes on page navigation, and the `/api/[...path]` proxy route does the
  same for client-side fetches, both falling back to `/login` only if the
  refresh itself fails. Cookie option/lifetime literals deduplicated into
  `apps/web/src/lib/session-cookies.ts` (previously hand-copied).
- **No `error.tsx` or `not-found.tsx` existed** — uncaught errors (e.g. a 401
  that outlives the fix above, a genuine outage) and invalid URLs both fell
  through to Next.js's generic unbranded pages instead of the UI/UX goal's
  "helpful message and guidance on what to do next." Added both.
- `UpdateClinicWebsiteDto`'s `servicesJson`/`testimonialsJson`/`faqJson` fields
  had no shape validation (only `@IsOptional()`) — the API would persist
  arbitrary malformed JSON. Added nested DTOs with `@ValidateNested()` and a
  50-item cap per array.
- `BookAppointmentForm`'s available-slots fetch had no error state — a failed
  request looked identical to "no open slots today." Added a distinct error
  message.

**Added** (same audit pass)
- Tenant-isolation unit tests for every Phase 1 + Staff service (`clinics`,
  `doctors`, `patients`, `appointments`, `staff`) plus `RolesGuard` — see
  [Testing § What exists today](#7-testing). Verified consistent, correct
  tenant scoping across all of them; no cross-tenant leakage found.

**Fixed** (found while building Billing)
- The `/api/[...path]` proxy route read every upstream response body via
  `.text()` before forwarding it — harmless for JSON, but would have silently
  corrupted the new binary PDF invoice response. Now streams `upstream.body`
  through directly and forwards `Content-Disposition`.

### Phase 1 — Foundation (2026-07-21)

**Added**
- Multi-tenant auth: email/password login, JWT access tokens (15m default) +
  rotated, hashed refresh tokens (30d default), scrypt password hashing.
- Tenant isolation: `TenantGuard` derives `clinicId` from the access token,
  never from client input; every service query filters explicitly by it.
  Postgres row-level security policies and `PrismaService.forTenant()` written
  as a second layer, not yet wired into the request path.
- Core data model: `Clinic`, `ClinicProfile`, `ClinicWebsite`, `User`,
  `RefreshToken`, `LoginEvent`, `DoctorProfile`, `DoctorAvailability`,
  `Patient`, `PatientDocument`, `Appointment`, `Prescription` (MVP shape).
- Clinic registration + website builder fields, doctor management with weekly
  availability, patient CRM, appointment booking with tenant-scoped conflict
  handling.
- `apps/web` dashboard (Next.js App Router): login/register, appointments,
  patients; public clinic site at `/c/{slug}`.
- Demo seed data: Sunrise Family Clinic, one owner, one doctor, one patient,
  one appointment.

---

## 13. License

Copyright (c) 2026 Chandan-c10. All rights reserved.

This software and associated documentation files (the "Software") are the
proprietary and confidential property of the copyright holder. No part of the
Software may be reproduced, distributed, or transmitted in any form or by any
means, nor may it be used, copied, modified, merged, published, or sublicensed,
without the prior written permission of the copyright holder.

Unauthorized copying, use, or distribution of this Software, via any medium, is
strictly prohibited.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM,
DAMAGES, OR OTHER LIABILITY ARISING FROM THE SOFTWARE OR ITS USE.

> Replace "Chandan-c10" above with the registered legal entity once the business
> is incorporated, and update this section if licensing terms change (e.g. if any
> part of the codebase is later open-sourced).
