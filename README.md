# Digital Clinic SaaS Platform

A multi-tenant SaaS platform giving every doctor/clinic their own website,
online booking, patient records, and clinic operations tools.

This repo currently implements **Phase 1 — Foundation**: authentication,
multi-tenancy, the core data model, a doctor/clinic dashboard, a public
clinic website (website builder), appointment booking, and patient
management. See [Roadmap](#roadmap) below for what comes next.

## Stack

- **apps/web** — Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **apps/api** — NestJS + REST, JWT auth with refresh tokens, RBAC
- **packages/database** — Prisma schema + client, shared by the API
- **PostgreSQL** — one shared database; every tenant-owned table carries
  `clinicId` + application-level tenant guards + Postgres row-level
  security as a defense-in-depth backstop (see `packages/database/prisma/rls.sql`)

## Prerequisites

This machine did not have these installed when the project was scaffolded —
install them before running anything:

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 9+ (`corepack enable` ships it with modern Node, or `npm i -g pnpm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Postgres)

## First-time setup

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

# 5. Seed a demo clinic (owner@sunrise-clinic.test / Password123!)
pnpm db:seed

# 6. Run both apps in dev mode
pnpm dev
```

- API: http://localhost:4000/api/v1
- Web: http://localhost:3000

## Local subdomains (website builder)

The public clinic website lives at `{slug}.platform.local` in production
routing terms; locally, visit `http://localhost:3000/c/{slug}` directly
(e.g. `/c/sunrise` after seeding) — the `middleware.ts` subdomain rewrite
only kicks in once you have real DNS/hosts-file entries pointing
`*.platform.local` at localhost.

## Project structure

```
apps/
  web/     Next.js frontend — marketing site, auth, dashboard, public clinic websites
  api/     NestJS backend — auth, clinics, doctors, patients, appointments
packages/
  database/  Prisma schema, migrations, seed script
docker-compose.yml   Local Postgres
```

## Security notes

- Every staff/doctor/patient request is tenant-scoped by the `clinicId`
  embedded in their JWT (`TenantGuard`), never by a client-supplied value;
  every service query additionally filters explicitly by `clinicId`. This
  is the enforced isolation boundary today.
- Row-level security policies in `packages/database/prisma/rls.sql` and
  `PrismaService.forTenant()` are a second layer, ready to apply, but not
  yet wired into every request automatically — that needs a request-scoped
  interceptor calling `forTenant()` and the API connecting as a non-owner
  DB role (see the comment in `apps/api/src/prisma/prisma.service.ts`).
  Treat it as available infrastructure, not an active backstop, until that's done.
- Refresh tokens are stored hashed (SHA-256) and rotated on every use;
  access tokens live only in httpOnly cookies set by Next.js Server
  Actions, never in `localStorage`.
- Passwords are hashed with scrypt + a random salt, compared in constant time.

## Roadmap

- **Phase 1 — Foundation** (this repo): auth, multi-tenancy, dashboard,
  website builder, appointments, patient management
- **Phase 2 — Business features**: billing, reports, notifications
  (WhatsApp/SMS/email), prescriptions, staff management, patient portal
- **Phase 3 — Enterprise**: multi-branch, inventory, pharmacy, insurance,
  advanced analytics
- **Phase 4 — AI**: AI assistant, voice notes, AI summaries, chatbot,
  predictive analytics

Build order matters here — resist adding Phase 3/4 features before Phase 1
and 2 are solid and in front of real users.
