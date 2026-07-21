import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrescriptionsService } from "./prescriptions.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";

function makePrismaMock() {
  return {
    doctorProfile: { findFirst: jest.fn() },
    patient: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn() },
    prescription: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  } as unknown as PrismaService;
}

function makeNotificationsMock() {
  return { send: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

describe("PrescriptionsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: PrescriptionsService;

  const baseDto: CreatePrescriptionDto = {
    patientId: "patient-1",
    medicines: [{ name: "Paracetamol", dosage: "500mg", frequency: "twice daily", durationDays: 5 }],
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    service = new PrescriptionsService(prisma, notifications);
  });

  it("refuses to write a prescription for a caller with no doctor profile in this clinic", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.create("clinic-1", "user-1", baseDto)).rejects.toThrow(ForbiddenException);
    expect(prisma.prescription.create).not.toHaveBeenCalled();
  });

  it("refuses to prescribe for a patient outside the caller's clinic", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1" });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.create("clinic-1", "user-1", baseDto)).rejects.toThrow(NotFoundException);
  });

  it("refuses to link an appointment from a different clinic", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1" });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.create("clinic-1", "user-1", { ...baseDto, appointmentId: "appt-from-clinic-2" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("refuses a second prescription for the same appointment", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1" });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue({ id: "appt-1" });
    (prisma.prescription.findUnique as jest.Mock).mockResolvedValue({ id: "existing-rx" });
    await expect(
      service.create("clinic-1", "user-1", { ...baseDto, appointmentId: "appt-1" }),
    ).rejects.toThrow(ConflictException);
  });

  it("stamps the new prescription with the caller's clinic and resolved doctorId, and notifies the patient", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1" });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.prescription.create as jest.Mock).mockResolvedValue({
      id: "rx-1",
      patient: { email: "patient@example.com" },
      doctor: { displayName: "Dr. Rao" },
    });

    await service.create("clinic-1", "user-1", baseDto);

    expect(prisma.prescription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clinicId: "clinic-1", doctorId: "doctor-1", patientId: "patient-1" }),
      }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PRESCRIPTION_READY", recipient: "patient@example.com" }),
    );
  });

  it("does not let one clinic read another clinic's prescription", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("clinic-1", "rx-from-clinic-2")).rejects.toThrow(NotFoundException);
  });

  it("scopes list() to the caller's clinic", async () => {
    (prisma.prescription.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1", {});
    expect(prisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
  });
});
