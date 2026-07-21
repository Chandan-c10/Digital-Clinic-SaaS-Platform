import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
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
  ],
  providers: [
    // Order matters: rate limit -> authenticate -> authorize by role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
