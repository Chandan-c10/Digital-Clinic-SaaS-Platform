import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, AppointmentType } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { AvailableSlotsQueryDto } from "./dto/available-slots-query.dto";

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableSlots(clinicId: string, query: AvailableSlotsQueryDto) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { id: query.doctorId, clinicId },
      include: { availabilities: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const date = new Date(`${query.date}T00:00:00`);
    const dayOfWeek = date.getDay();
    const dayAvailabilities = doctor.availabilities.filter(
      (slot) => slot.dayOfWeek === dayOfWeek && slot.isActive,
    );
    if (dayAvailabilities.length === 0) return [];

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

    const slots: string[] = [];
    for (const availability of dayAvailabilities) {
      const [startHour, startMinute] = availability.startTime.split(":").map(Number);
      const [endHour, endMinute] = availability.endTime.split(":").map(Number);

      const cursor = new Date(date);
      cursor.setHours(startHour, startMinute, 0, 0);
      const end = new Date(date);
      end.setHours(endHour, endMinute, 0, 0);

      while (cursor < end) {
        if (!bookedTimes.has(cursor.toISOString()) && cursor.getTime() > Date.now()) {
          slots.push(cursor.toISOString());
        }
        cursor.setMinutes(cursor.getMinutes() + availability.slotDurationMinutes);
      }
    }
    return slots.sort();
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
      this.prisma.doctorProfile.findFirst({ where: { id: dto.doctorId, clinicId } }),
    ]);
    if (!patient) throw new NotFoundException("Patient not found");
    if (!doctor) throw new NotFoundException("Doctor not found");

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException("Invalid scheduledAt date");
    }

    return this.prisma.$transaction(async (tx) => {
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
