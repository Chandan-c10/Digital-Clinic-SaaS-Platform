import { ConflictException, NotFoundException } from "@nestjs/common";
import { AppointmentStatus } from "@digital-clinic/database";
import { AppointmentsService } from "./appointments.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";

function makePrismaMock() {
  const tx = {
    appointment: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
  };
  return {
    patient: { findFirst: jest.fn() },
    doctorProfile: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((cb: (tx: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  } as unknown as PrismaService & { __tx: typeof tx };
}

function makeNotificationsMock() {
  return { send: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

describe("AppointmentsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: AppointmentsService;

  const baseDto: CreateAppointmentDto = {
    patientId: "patient-1",
    doctorId: "doctor-1",
    scheduledAt: "2026-08-01T09:00:00.000Z",
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    service = new AppointmentsService(prisma, notifications);
  });

  it("refuses to book a patient that belongs to a different clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({
      id: "doctor-1",
      availabilities: [],
    });
    await expect(service.create("clinic-1", baseDto)).rejects.toThrow(NotFoundException);
    expect(prisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "patient-1", clinicId: "clinic-1" } }),
    );
  });

  it("refuses to book a doctor that belongs to a different clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.create("clinic-1", baseDto)).rejects.toThrow(NotFoundException);
  });

  it("rejects a double-booked slot", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({
      id: "doctor-1",
      availabilities: [],
    });
    prisma.__tx.appointment.findFirst.mockResolvedValue({ id: "existing-appt" });
    await expect(service.create("clinic-1", baseDto)).rejects.toThrow(ConflictException);
    expect(prisma.__tx.appointment.create).not.toHaveBeenCalled();
  });

  it("books successfully and stamps the appointment with the caller's clinicId", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({
      id: "doctor-1",
      availabilities: [],
    });
    prisma.__tx.appointment.findFirst.mockResolvedValue(null);
    prisma.__tx.appointment.create.mockResolvedValue({
      id: "new-appt",
      scheduledAt: new Date("2026-08-01T09:00:00.000Z"),
      patient: { email: "patient@example.com" },
      doctor: { displayName: "Dr. Rao" },
    });

    await service.create("clinic-1", baseDto);

    expect(prisma.__tx.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "APPOINTMENT_CONFIRMATION", recipient: "patient@example.com" }),
    );
  });

  it("stamps the appointment with the branch matching the booked time, for multi-branch clinics", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({
      id: "doctor-1",
      availabilities: [
        {
          dayOfWeek: new Date(baseDto.scheduledAt).getDay(),
          startTime: "09:00",
          endTime: "10:00",
          slotDurationMinutes: 15,
          isActive: true,
          branchId: "branch-downtown",
        },
      ],
    });
    prisma.__tx.appointment.findFirst.mockResolvedValue(null);
    prisma.__tx.appointment.create.mockResolvedValue({
      id: "new-appt",
      scheduledAt: new Date(baseDto.scheduledAt),
      patient: { email: "patient@example.com" },
      doctor: { displayName: "Dr. Rao" },
    });

    await service.create("clinic-1", baseDto);

    expect(prisma.__tx.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: "branch-downtown" } ) }),
    );
  });

  it("refuses to change the status of an appointment outside the caller's clinic", async () => {
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.updateStatus("clinic-1", "appt-from-clinic-2", {
        status: AppointmentStatus.CONFIRMED,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("refuses to reschedule an appointment outside the caller's clinic", async () => {
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.reschedule("clinic-1", "appt-from-clinic-2", {
        scheduledAt: "2026-08-02T09:00:00.000Z",
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});
