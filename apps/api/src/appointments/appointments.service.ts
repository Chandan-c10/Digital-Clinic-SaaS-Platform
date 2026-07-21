import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, AppointmentType, NotificationChannel, NotificationType } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { AvailableSlotsQueryDto } from "./dto/available-slots-query.dto";
import { computeAvailableSlots, resolveBranchForTime } from "./available-slots.util";

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getAvailableSlots(clinicId: string, query: AvailableSlotsQueryDto) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { id: query.doctorId, clinicId },
      include: { availabilities: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const date = new Date(`${query.date}T00:00:00`);
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId: query.doctorId,
        status: { in: ACTIVE_STATUSES },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      select: { scheduledAt: true },
    });
    const bookedTimes = new Set(bookedAppointments.map((a) => a.scheduledAt.toISOString()));

    return computeAvailableSlots(date, doctor.availabilities, bookedTimes);
  }

  async list(
    clinicId: string,
    filters: { doctorId?: string; patientId?: string; status?: AppointmentStatus },
  ) {
    return this.prisma.appointment.findMany({
      where: { clinicId, ...filters },
      include: { patient: true, doctor: true },
      orderBy: { scheduledAt: "asc" },
    });
  }

  async create(clinicId: string, dto: CreateAppointmentDto) {
    const [patient, doctor] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } }),
      this.prisma.doctorProfile.findFirst({
        where: { id: dto.doctorId, clinicId },
        include: { availabilities: true },
      }),
    ]);
    if (!patient) throw new NotFoundException("Patient not found");
    if (!doctor) throw new NotFoundException("Doctor not found");

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException("Invalid scheduledAt date");
    }

    // Branch is implied by which availability window this time falls in —
    // no separate branch selection step in the booking UI (see README §
    // Architecture, Patient Portal). Null for single-branch clinics.
    const branchId = resolveBranchForTime(scheduledAt, doctor.availabilities);

    const appointment = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          clinicId,
          doctorId: dto.doctorId,
          scheduledAt,
          status: { in: ACTIVE_STATUSES },
        },
      });
      if (conflict) {
        throw new ConflictException("That slot is no longer available");
      }

      const type = dto.type ?? AppointmentType.ONLINE;
      let tokenNumber: number | undefined;
      if (type === AppointmentType.WALK_IN) {
        const dayStart = new Date(scheduledAt);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const todaysCount = await tx.appointment.count({
          where: {
            clinicId,
            doctorId: dto.doctorId,
            type: AppointmentType.WALK_IN,
            scheduledAt: { gte: dayStart, lt: dayEnd },
          },
        });
        tokenNumber = todaysCount + 1;
      }

      return tx.appointment.create({
        data: {
          clinicId,
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          branchId,
          scheduledAt,
          durationMinutes: dto.durationMinutes ?? 15,
          type,
          reasonForVisit: dto.reasonForVisit,
          tokenNumber,
          status: AppointmentStatus.CONFIRMED,
        },
        include: { patient: true, doctor: true },
      });
    });

    // Fired after the transaction commits, not inside it — a notification
    // failure (see NotificationsService.send) must never roll back a
    // successful booking.
    void this.notifications.send({
      clinicId,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.APPOINTMENT_CONFIRMATION,
      recipient: appointment.patient.email,
      subject: "Appointment confirmed",
      body: `Your appointment with ${appointment.doctor.displayName} is confirmed for ${appointment.scheduledAt.toLocaleString()}.`,
    });

    return appointment;
  }

  async updateStatus(clinicId: string, id: string, dto: UpdateAppointmentStatusDto) {
    await this.findOneOrThrow(clinicId, id);
    return this.prisma.appointment.update({ where: { id }, data: { status: dto.status } });
  }

  async reschedule(clinicId: string, id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.findOneOrThrow(clinicId, id);
    const scheduledAt = new Date(dto.scheduledAt);

    const conflict = await this.prisma.appointment.findFirst({
      where: {
        clinicId,
        doctorId: appointment.doctorId,
        scheduledAt,
        status: { in: ACTIVE_STATUSES },
        NOT: { id },
      },
    });
    if (conflict) throw new ConflictException("That slot is no longer available");

    return this.prisma.appointment.update({
      where: { id },
      data: { scheduledAt, status: AppointmentStatus.CONFIRMED },
    });
  }

  private async findOneOrThrow(clinicId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({ where: { id, clinicId } });
    if (!appointment) throw new NotFoundException("Appointment not found");
    return appointment;
  }
}
