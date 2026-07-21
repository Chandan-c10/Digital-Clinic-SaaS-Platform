# CLAUDE.md

Instructions for Claude Code (and any other agent) working in this repository.

## What this is

Digital Clinic SaaS — a proprietary, multi-tenant platform giving every doctor/clinic
a private website, booking, patient records, and clinic operations tools.

`README.md` is the single reference doc for this repo — setup, architecture, API
reference, testing, deployment, troubleshooting, contributing conventions,
security policy, changelog, and license all live there as numbered chapters (kept
in one file per the user's explicit instruction, not split into docs/,
CONTRIBUTING.md, CHANGELOG.md, SECURITY.md, LICENSE, etc.). This file is the only
exception, since Claude Code (and similar tools) auto-load it specifically by
filename — read `README.md` first for everything else.

## Standing maintenance charter

This repo is maintained to production-ready, professional open-source-grade standards
at every commit, not just at release time. Concretely, that means:

- **Docs move with code.** Any change to an API shape, env var, module boundary, or
  setup step must update the relevant chapter of `README.md` (including its
  Changelog chapter) in the same change — not as a follow-up.
- **No dead config or fake features.** If an env var, script, or module isn't wired
  to anything, delete it or wire it up — don't leave it looking functional.
- **Every module follows the existing pattern** before inventing a new one: guard →
  controller → service → DTO for the API (see `apps/api/src/patients/` as the
  reference shape), tenant-scoped by `clinicId` derived from the JWT (never
  client-supplied — see `apps/api/src/common/guards/tenant.guard.ts`).
- **Record scope decisions, not just code.** When a module is deliberately narrower
  than the full spec (e.g. `staff` module excludes DOCTOR because doctor accounts
  are created in `doctors/` alongside a DoctorProfile), say so in a code comment at
  the decision point, not just in a commit message.
- **Changelog every user-visible change** under `[Unreleased]` in `README.md`'s
  Changelog chapter (Keep a Changelog format) — added/changed/fixed/security.
- **Commits stay logical and scoped**; write the "why" in the body when it isn't
  obvious from the diff.

## Operating posture

The user has asked that every change be produced to the standard of a full
engineering team (architecture, security, QA, DevOps, docs, accessibility — not
just "make it work"), captured here as what that means in practice rather than
as a list of job titles to roleplay:

- **No placeholder or fake implementations, ever** — not for core functionality,
  not "for now." If something is genuinely out of scope for the current task,
  don't stub it silently; say so and leave it undone, or ask.
- **Security, tenant isolation, and tests are part of the task, not an
  afterthought.** When building an endpoint: validate the DTO, scope every
  query by `clinicId`, check the role boundary, and consider what breaks it —
  in the same pass as writing the happy path, not a cleanup pass after.
- **Think before coding**: read the existing pattern for this kind of change
  first (see Architecture quick reference below and `README.md`), and prefer it
  over a new one unless there's a concrete reason not to — state that reason
  when you deviate.
- **Ambiguity**: ask when a requirement genuinely has multiple reasonable
  interpretations that would lead to different work; don't ask about things
  answerable by reading the code.

## Definition of done

Before treating any feature/fix as complete, check it against this list — it's
the same bar `README.md § 7 Testing` and `§ 11 Security policy` describe in
detail, restated here as a concrete gate:

- [ ] Works end-to-end, not just the happy path (edge cases, invalid input).
- [ ] Every query touching tenant-owned data is scoped by `clinicId`; verified
      by reasoning through "what would a different clinic's token see here."
- [ ] Authorization enforced (`@Roles(...)` matches who should actually be
      allowed) and checked, not assumed from the guard chain being present.
- [ ] New/changed API endpoints: DTO validation, meaningful HTTP status codes,
      errors handled (not silently swallowed).
- [ ] New/changed UI: responsive, loading/error/success feedback present, no
      dead buttons or unreachable states (see `README.md § 10 Frontend conventions`).
- [ ] Tests exist for the tenant-isolation and auth-boundary cases at minimum
      (`README.md § 7`); existing tests still pass if you could run them, and
      you've said explicitly if you couldn't (see Environment constraint below).
- [ ] `README.md` (relevant chapter + Changelog) and `.env.example` updated if
      the change touches setup, API shape, or config.
- [ ] No dead code, no unused config, no leftover debug logging.

If an item doesn't apply, that's fine — but skipping one because it's
inconvenient, on a change where it does apply, isn't.

## Environment constraint (important)

Node/pnpm/Docker are **not installed** in the default sandbox this repo is often
worked in. Before claiming lint/build/test/typecheck pass, check whether they were
actually run — `command -v node` — and say explicitly if they weren't, rather than
asserting success. Static review (reading the guard chain, checking a new query is
tenant-scoped, checking a script points at a real config) is the fallback, not a
substitute for the user running `pnpm build && pnpm lint && pnpm test` locally
before merging.

## Architecture quick reference

- `apps/api` — NestJS. Global guard order: `ThrottlerGuard` → `JwtAuthGuard` →
  `RolesGuard` (registered in `app.module.ts`), then per-controller `TenantGuard`.
  Tenant id always comes from the access token's `clinicId` claim
  (`common/guards/tenant.guard.ts`), never from a request param/header, except the
  `x-clinic-id` escape hatch for `SUPER_ADMIN` only.
- `apps/web` — Next.js App Router. Server components call the API directly via
  `lib/api.ts` (attaches the httpOnly cookie server-side). Client components go
  through the same-origin proxy at `app/api/[...path]/route.ts` so the access token
  never reaches client JS.
- `packages/database` — Prisma schema is the single source of truth; no migrations
  have been generated yet, so schema edits don't need a hand-written migration
  file — the first `pnpm db:migrate` generates it.
- Multi-tenancy: shared database, `clinicId` column + app-level filtering on every
  query (enforced today). Postgres RLS (`packages/database/prisma/rls.sql` +
  `PrismaService.forTenant()`) exists as a second layer but is not yet wired into
  every request — see the comment in `apps/api/src/prisma/prisma.service.ts` for
  what's left to make it an active backstop.

## Where things are tracked

- Product vision, phase roadmap, and per-phase progress: agent memory
  (`project-vision`, `project-roadmap`) — also mirrored in `README.md`'s Roadmap
  and Changelog chapters.
- Architecture, API surface, deployment, dev setup, testing, troubleshooting,
  contributing conventions, security policy, license: `README.md`, one chapter
  each (see its table of contents).
