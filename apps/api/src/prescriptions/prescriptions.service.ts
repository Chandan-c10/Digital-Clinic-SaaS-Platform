import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationChannel, NotificationType } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MAX_PAGE_SIZE } from "../common/pagination.util";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";

const PRESCRIPTION_INCLUDE = {
  patient: true,
  doctor: true,
};

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(clinicId: string, filters: { patientId?: string }) {
    return this.prisma.prescription.findMany({
      where: { clinicId, ...filters },
      include: PRESCRIPTION_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: MAX_PAGE_SIZE, // QA/security audit, TC-FUNC-01 / TC-PERF-01
    });
  }

  async findOne(clinicId: string, id: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, clinicId },
      include: PRESCRIPTION_INCLUDE,
    });
    if (!prescription) throw new NotFoundException("Prescription not found");
    return prescription;
  }

  async create(clinicId: string, doctorUserId: string, dto: CreatePrescriptionDto) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { userId: doctorUserId, clinicId },
    });
    if (!doctor) {
      throw new ForbiddenException("Only a doctor profile in this clinic can write prescriptions");
    }

    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } });
    if (!patient) throw new NotFoundException("Patient not found");

    // Branch (module Z) is inherited from the appointment, same reasoning as
    // BillingService.create — a prescription written during a visit belongs
    // to whichever branch that visit was at.
    let branchId: string | null = null;
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, clinicId },
      });
      if (!appointment) throw new NotFoundException("Appointment not found");
      branchId = appointment.branchId;

      const existing = await this.prisma.prescription.findUnique({
        where: { appointmentId: dto.appointmentId },
      });
      if (existing) throw new ConflictException("This appointment already has a prescription");
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        doctorId: doctor.id,
        appointmentId: dto.appointmentId,
        branchId,
        medicines: dto.medicines,
        notes: dto.notes,
      },
      include: PRESCRIPTION_INCLUDE,
    });

    void this.notifications.send({
      clinicId,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.PRESCRIPTION_READY,
      recipient: prescription.patient.email,
      subject: "Your prescription is ready",
      body: `Dr. ${prescription.doctor.displayName} has added a new prescription to your record.`,
    });

    return prescription;
  }
}
