import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@digital-clinic/database";

/**
 * Thin wrapper around PrismaClient.
 *
 * The primary tenant-isolation boundary today is `TenantGuard` (see
 * common/guards/tenant.guard.ts) plus every service query filtering
 * explicitly by `clinicId`. `forTenant` is the opt-in second layer: it runs
 * a callback inside a transaction with the Postgres session variable
 * `app.current_clinic_id` set, so the RLS policies in
 * packages/database/prisma/rls.sql apply even if a query forgets its
 * `where: { clinicId }`. It is not yet called from every request path —
 * doing that automatically (e.g. via a request-scoped interceptor) and
 * running the API under a non-owner DB role are the two steps left to make
 * RLS an always-on backstop rather than available infrastructure.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async forTenant<T>(clinicId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      // set_config(..., true) with Prisma's tagged-template $executeRaw is
      // parameter-bound (unlike $executeRawUnsafe) — never interpolate
      // clinicId into raw SQL directly here.
      await tx.$executeRaw`SELECT set_config('app.current_clinic_id', ${clinicId}, true)`;
      return fn(tx as PrismaClient);
    });
  }
}
