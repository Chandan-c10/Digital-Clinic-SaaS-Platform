import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuthModule } from "./auth/auth.module";
import { ClinicsModule } from "./clinics/clinics.module";
import { DoctorsModule } from "./doctors/doctors.module";
import { PatientsModule } from "./patients/patients.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { StaffModule } from "./staff/staff.module";
import { BillingModule } from "./billing/billing.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrescriptionsModule } from "./prescriptions/prescriptions.module";
import { PatientPortalModule } from "./patient-portal/patient-portal.module";
import { BranchesModule } from "./branches/branches.module";
import { InventoryModule } from "./inventory/inventory.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    PrismaModule,
    AuthModule,
    ClinicsModule,
    DoctorsModule,
    PatientsModule,
    AppointmentsModule,
    StaffModule,
    BillingModule,
    ReportsModule,
    NotificationsModule,
    PrescriptionsModule,
    PatientPortalModule,
    BranchesModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [
    // Order matters: rate limit -> authenticate -> authorize by role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
