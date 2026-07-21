import { ConflictException, NotFoundException } from "@nestjs/common";
import { PatientPortalService } from "./patient-portal.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

function makePrismaMock() {
  const tx = {
    appointment: { findFirst: jest.fn(), create: jest.fn() },
  };
  return {
    user: { findUnique: jest.fn() },
    appointment: { findMany: jest.fn() },
    prescription: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() },
    clinic: { findMany: jest.fn(), findFirst: jest.fn() },
    doctorProfile: { findMany: jest.fn(), findFirst: jest.fn() },
    patient: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((cb: (tx: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  } as unknown as PrismaService & { __tx: typeof tx };
}

function makeNotificationsMock() {
  return { send: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

describe("PatientPortalService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: PatientPortalService;

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    service = new PatientPortalService(prisma, notifications);
  });

  it("scopes every 'my records' query to the caller's own userId, across all clinics", async () => {
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.prescription.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

    await service.myAppointments("user-1");
    await service.myPrescriptions("user-1");
    await service.myInvoices("user-1");

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patient: { userId: "user-1" } } }),
    );
    expect(prisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patient: { userId: "user-1" } } }),
    );
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patient: { userId: "user-1" } } }),
    );
  });

  it("refuses to book at a clinic with no published website", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", email: "p@example.com" });
    (prisma.clinic.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.bookAppointment("user-1", {
        clinicId: "clinic-1",
        doctorId: "doctor-1",
        scheduledAt: "2026-08-01T09:00:00.000Z",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("reuses an existing per-clinic Patient row instead of creating a duplicate", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      name: "Ramesh",
      email: "p@example.com",
      phone: null,
    });
    (prisma.clinic.findFirst as jest.Mock).mockResolvedValue({ id: "clinic-1" });
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1", availabilities: [] });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "existing-patient" });
    prisma.__tx.appointment.findFirst.mockResolvedValue(null);
    prisma.__tx.appointment.create.mockResolvedValue({
      id: "appt-1",
      scheduledAt: new Date("2026-08-01T09:00:00.000Z"),
      doctor: { displayName: "Dr. Rao" },
      clinic: { name: "Sunrise Clinic" },
    });

    await service.bookAppointment("user-1", {
      clinicId: "clinic-1",
      doctorId: "doctor-1",
      scheduledAt: "2026-08-01T09:00:00.000Z",
    });

    expect(prisma.patient.create).not.toHaveBeenCalled();
    expect(prisma.__tx.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ patientId: "existing-patient" }) }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "p@example.com", type: "APPOINTMENT_CONFIRMATION" }),
    );
  });

  it("creates a new per-clinic Patient row on a patient's first visit to a clinic", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      name: "Ramesh",
      email: "p@example.com",
      phone: "+919999999999",
    });
    (prisma.clinic.findFirst as jest.Mock).mockResolvedValue({ id: "clinic-1" });
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1", availabilities: [] });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.patient.create as jest.Mock).mockResolvedValue({ id: "new-patient" });
    prisma.__tx.appointment.findFirst.mockResolvedValue(null);
    prisma.__tx.appointment.create.mockResolvedValue({
      id: "appt-1",
      scheduledAt: new Date("2026-08-01T09:00:00.000Z"),
      doctor: { displayName: "Dr. Rao" },
      clinic: { name: "Sunrise Clinic" },
    });

    await service.bookAppointment("user-1", {
      clinicId: "clinic-1",
      doctorId: "doctor-1",
      scheduledAt: "2026-08-01T09:00:00.000Z",
    });

    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clinicId: "clinic-1", userId: "user-1" }) }),
    );
  });

  it("rejects a double-booked slot", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", email: "p@example.com" });
    (prisma.clinic.findFirst as jest.Mock).mockResolvedValue({ id: "clinic-1" });
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1", availabilities: [] });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "existing-patient" });
    prisma.__tx.appointment.findFirst.mockResolvedValue({ id: "already-booked" });

    await expect(
      service.bookAppointment("user-1", {
        clinicId: "clinic-1",
        doctorId: "doctor-1",
        scheduledAt: "2026-08-01T09:00:00.000Z",
      }),
    ).rejects.toThrow(ConflictException);
  });
});
