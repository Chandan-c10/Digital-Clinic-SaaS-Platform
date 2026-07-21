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
- **Phase 3 — Enterprise** (in progress): inventory, pharmacy, insurance,
  advanced analytics remain.
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
- **Phase 4 — AI**: AI assistant, voice notes, AI summaries, chatbot, predictive
  analytics.
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

### Roles

`SUPER_ADMIN`, `CLINIC_OWNER`, `DOCTOR`, `RECEPTIONIST`, `NURSE`, `ACCOUNTANT`,
`PATIENT` (`Role` enum, `packages/database/prisma/schema.prisma`). Staff accounts
for `RECEPTIONIST` / `NURSE` / `ACCOUNTANT` are managed through the `staff`
module; `DOCTOR` accounts go through the `doctors` module instead because
creating one also creates a `DoctorProfile` — routing doctor creation through
`staff` as well would produce a `User` with no profile.

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
- Known gap, called out in a schema comment: Postgres treats `NULL` as
  distinct from `NULL` in unique constraints, so
  `DoctorAvailability`'s `@@unique([doctorId, branchId, dayOfWeek,
  startTime])` doesn't actually block duplicate rows when `branchId` is
  null (single-branch clinics). Not tightened further — `setAvailability`
  always fully replaces a doctor's availability in one
  `deleteMany`+`createMany` rather than inserting incrementally, so the
  practical risk is a caller submitting duplicate rows in one request, not
  a race between separate requests.
- No dedicated UI exists yet for doctors to set per-branch availability —
  there's no doctor-management page in `apps/web` at all (a pre-existing
  gap from Phase 1, not introduced here). `/dashboard/branches` (branch
  CRUD) and the `branchId` field on `POST /doctors/:id/availability` are
  both real and usable via the API today; wiring a UI for the latter is a
  follow-up.

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
| POST | `/auth/register-clinic` | public | `{ clinicName, slug, ownerName, email, password }` |
| POST | `/auth/register-patient` | public | `{ name, email, phone?, password }` — creates a Patient Portal login (`Role.PATIENT`, `clinicId: null`); does not auto-link any existing walk-in `Patient` record |
| POST | `/auth/login` | public, throttled 5/min | `{ email, password }` — same endpoint for staff and patients, role decides what the token can do |
| POST | `/auth/refresh` | public | `{ refreshToken }` |
| POST | `/auth/logout` | public | `{ refreshToken }` |

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
| PATCH | `/doctors/:id/availability` | CLINIC_OWNER, DOCTOR | `{ slots: [{ dayOfWeek, startTime, endTime, slotDurationMinutes, branchId? }] }` — `branchId` optional, validated to belong to this clinic if given (module Z, see [Architecture § Multi-branch](#5-architecture)) |

### Patients (`/patients`)

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/patients?search=` | CLINIC_OWNER, DOCTOR, RECEPTIONIST, NURSE, ACCOUNTANT (read-only) | — |
| GET | `/patients/:id` | same | — |
| POST | `/patients` | CLINIC_OWNER, DOCTOR, RECEPTIONIST, NURSE | `{ name, phone?, email?, gender?, dateOfBirth?, address?, allergies?, medicalHistory? }` |
| PATCH | `/patients/:id` | same | partial of the above |
| DELETE | `/patients/:id` | CLINIC_OWNER | — |

ACCOUNTANT's GET-only access was added for Billing — invoicing needs to look up a patient, but accountants shouldn't edit medical/demographic records.

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
| POST | `/staff` | `{ name, email, password, phone?, role: RECEPTIONIST\|NURSE\|ACCOUNTANT }` |
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
| POST | `/billing/invoices` | write roles | `{ patientId, appointmentId?, lineItems: [{ description, quantity, unitPrice }], discountAmount?, taxAmount?, notes? }` |
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
- `apps/api/src/{clinics,doctors,patients,appointments,staff,billing,reports,notifications,prescriptions,patient-portal,branches,inventory}/*.service.spec.ts`
  — one spec per service, mocking `PrismaService` directly (no DB). Each covers
  the tenant-isolation case ("does a query scoped to clinic A ever return or
  touch clinic B's row" — for `patient-portal`, the equivalent "own userId
  only, never another patient's") and the module's specific business rule
  where there is one (appointment double-booking, duplicate-email rejection,
  staff deactivation revoking live sessions, invoice balance/status
  transitions, report aggregation grouping — including the `branchId` filter
  and that it never leaks into the branch-unaware `newPatients` count —
  notification dispatch never throwing, find-or-create `Patient` row on
  first portal booking, branch CRUD tenant isolation).
- `apps/api/src/appointments/available-slots.util.spec.ts` — the shared
  slot-computation logic (excludes booked times, ignores other days/inactive
  windows, never returns a past slot) plus `resolveBranchForTime` (which
  availability window's branch a booked time falls into, or `null`), used by
  both staff and portal booking.
- `apps/api/src/doctors/doctors.service.spec.ts` also covers
  `setAvailability` rejecting a `branchId` that doesn't belong to the
  caller's clinic.
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

- **MVP**: Render (API + Web), Neon (managed Postgres), Cloudflare R2 (object
  storage, not yet wired up in code).
- **Production scale**: cloud-ready for AWS/GCP/Azure, Docker/Kubernetes — not
  yet built out; `docker-compose.yml` today only stands up local Postgres for
  development, it is not a deployment artifact.

### Environments

Local → Staging → Production is the intended separation; only local exists today
(via `.env` + `docker-compose.yml`). Staging/production environment configs,
secrets management, and a deploy pipeline are not yet set up.

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

- **Components**: extend `apps/web/src/components/ui/` (currently just `Button`
  and `Input`) rather than styling one-off elements inline. When a page needs
  something that doesn't exist yet (a modal, a table, a date picker), add it
  there so the next page that needs one reuses it instead of a second
  implementation with its own quirks.
- **Loading/error feedback**: follow the pattern already established in
  `NewPatientForm.tsx` / `NewStaffForm.tsx` — a `submitting` state that disables
  the submit button and swaps its label, inline error text from the API
  response, and `router.refresh()` on success. Don't ship a form or button that
  silently does nothing while a request is in flight.
- **Responsive**: check new pages at desktop, ~1024–1280px (laptop), tablet, and
  mobile widths — no horizontal scroll, no clipped content.
- **Gaps not yet addressed** (don't assume otherwise): no dark mode, no
  systematic accessibility pass (focus states/ARIA/contrast), no breadcrumbs, no
  mobile nav drawer (the dashboard sidebar is desktop-only today), no confirmed
  custom 404 page. Close these when the page/feature you're building actually
  needs it, not speculatively.

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
| Rate limiting (`ThrottlerGuard`, 100 req/min default; login throttled to 5/min) | Enforced |
| CSRF | N/A — bearer-token API, not cookie-authenticated; revisit if that changes |
| Input validation | `class-validator` DTOs, `whitelist: true` on every route |
| Audit logging | Login events only (`LoginEvent`); no general activity log yet |
| Encryption at rest | Delegated to the managed Postgres provider — no field-level encryption yet |
| Dependency scanning / SAST | Not yet configured |

If you're changing authentication, tenant scoping, or role checks, treat it as
security-sensitive: get a second review before merging, regardless of how small
the diff looks.

---

## 12. Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project doesn't follow semver yet (pre-1.0, no tagged releases) — entries are
grouped by what landed, most recent first.

### [Unreleased]

**Added**
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
