import { PrismaClient, Role, ClinicPlan, ClinicStatus } from "../generated/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const owner = await prisma.user.create({
    data: {
      name: "Priya Sharma",
      email: "owner@sunrise-clinic.test",
      passwordHash: hashPassword("Password123!"),
      role: Role.CLINIC_OWNER,
      isEmailVerified: true,
    },
  });

  const clinic = await prisma.clinic.create({
    data: {
      name: "Sunrise Family Clinic",
      slug: "sunrise",
      plan: ClinicPlan.TRIAL,
      status: ClinicStatus.TRIALING,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      ownerId: owner.id,
      profile: {
        create: {
          city: "Bengaluru",
          state: "Karnataka",
          country: "India",
          contactEmail: "hello@sunrise-clinic.test",
          consultationFee: 500,
          languagesSpoken: ["English", "Hindi", "Kannada"],
        },
      },
      website: {
        create: {
          template: "default",
          aboutText: "Sunrise Family Clinic has been serving the community for over 10 years.",
          isPublished: true,
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: owner.id },
    data: { clinicId: clinic.id },
  });

  // A single branch, wired through availability/appointment/invoice below —
  // demonstrates the multi-branch feature works end to end even though this
  // demo clinic only has the one location (branches are opt-in per README §
  // Roadmap; a clinic can also just leave branchId null everywhere).
  const branch = await prisma.branch.create({
    data: {
      clinicId: clinic.id,
      name: "Main Branch",
      addressLine1: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      phone: "+918000000000",
    },
  });

  const doctorUser = await prisma.user.create({
    data: {
      name: "Dr. Anjali Rao",
      email: "dr.rao@sunrise-clinic.test",
      passwordHash: hashPassword("Password123!"),
      role: Role.DOCTOR,
      isEmailVerified: true,
      clinicId: clinic.id,
    },
  });

  const doctor = await prisma.doctorProfile.create({
    data: {
      clinicId: clinic.id,
      userId: doctorUser.id,
      displayName: "Dr. Anjali Rao",
      qualification: "MBBS, MD (General Medicine)",
      specialization: "General Physician",
      experienceYears: 12,
      consultationFee: 500,
      languagesSpoken: ["English", "Hindi"],
    },
  });

  await prisma.doctorAvailability.createMany({
    data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      doctorId: doctor.id,
      branchId: branch.id,
      dayOfWeek,
      startTime: "09:00",
      endTime: "13:00",
      slotDurationMinutes: 15,
    })),
  });

  const receptionist = await prisma.user.create({
    data: {
      name: "Kavya Nair",
      email: "reception@sunrise-clinic.test",
      passwordHash: hashPassword("Password123!"),
      role: Role.RECEPTIONIST,
      isEmailVerified: true,
      clinicId: clinic.id,
    },
  });

  await prisma.user.create({
    data: {
      name: "Meera Iyer",
      email: "accounts@sunrise-clinic.test",
      passwordHash: hashPassword("Password123!"),
      role: Role.ACCOUNTANT,
      isEmailVerified: true,
      clinicId: clinic.id,
    },
  });

  // A Patient Portal login, linked to the walk-in Patient record below via
  // userId — demonstrates the "claimed" case (see the Patient model
  // comment); a portal account with no linked Patient row yet is the
  // "just registered, hasn't visited anywhere" case and needs no seed data.
  const patientUser = await prisma.user.create({
    data: {
      name: "Ramesh Kumar",
      email: "ramesh.patient@example.test",
      phone: "+919999999999",
      passwordHash: hashPassword("Password123!"),
      role: Role.PATIENT,
      isEmailVerified: true,
    },
  });

  const patient = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      userId: patientUser.id,
      name: "Ramesh Kumar",
      phone: "+919999999999",
      email: "ramesh.patient@example.test",
      gender: "male",
      allergies: [],
    },
  });

  const upcomingAppointment = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      patientId: patient.id,
      doctorId: doctor.id,
      branchId: branch.id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "CONFIRMED",
      type: "ONLINE",
      reasonForVisit: "Routine checkup",
    },
  });

  await prisma.prescription.create({
    data: {
      clinicId: clinic.id,
      patientId: patient.id,
      doctorId: doctor.id,
      branchId: branch.id,
      appointmentId: upcomingAppointment.id,
      medicines: [
        {
          name: "Paracetamol",
          dosage: "500mg",
          frequency: "twice daily",
          durationDays: 5,
          instructions: "After food",
        },
      ],
      notes: "Follow up if fever persists beyond 3 days.",
    },
  });

  const paidInvoice = await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patient.id,
      invoiceNumber: 1,
      lineItems: [{ description: "Consultation — General Physician", quantity: 1, unitPrice: 500 }],
      subtotal: 500,
      totalAmount: 500,
      amountPaid: 500,
      status: "PAID",
      createdById: receptionist.id,
    },
  });

  await prisma.payment.create({
    data: {
      clinicId: clinic.id,
      invoiceId: paidInvoice.id,
      amount: 500,
      method: "UPI",
      reference: "UPI-DEMO-0001",
      recordedById: receptionist.id,
    },
  });

  await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patient.id,
      invoiceNumber: 2,
      lineItems: [
        { description: "Consultation — General Physician", quantity: 1, unitPrice: 500 },
        { description: "Blood test panel", quantity: 1, unitPrice: 800 },
      ],
      subtotal: 1300,
      discountAmount: 100,
      totalAmount: 1200,
      amountPaid: 0,
      status: "UNPAID",
      createdById: receptionist.id,
    },
  });

  const paracetamol = await prisma.inventoryItem.create({
    data: {
      clinicId: clinic.id,
      name: "Paracetamol 500mg",
      sku: "MED-PARA-500",
      unit: "tablet",
      category: "Medicine",
      reorderLevel: 50,
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      clinicId: clinic.id,
      itemId: paracetamol.id,
      branchId: branch.id,
      type: "RECEIVED",
      quantity: 200,
      reason: "Initial stock",
      performedById: receptionist.id,
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      clinicId: clinic.id,
      itemId: paracetamol.id,
      branchId: branch.id,
      type: "DISPENSED",
      quantity: -20,
      reason: "Dispensed against prescriptions",
      performedById: receptionist.id,
    },
  });

  // Below its reorderLevel (30) — demonstrates the low-stock indicator.
  const gloves = await prisma.inventoryItem.create({
    data: {
      clinicId: clinic.id,
      name: "Examination Gloves (box of 100)",
      sku: "SUP-GLOVE-100",
      unit: "box",
      category: "Consumable",
      reorderLevel: 30,
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      clinicId: clinic.id,
      itemId: gloves.id,
      branchId: branch.id,
      type: "RECEIVED",
      quantity: 15,
      reason: "Initial stock",
      performedById: receptionist.id,
    },
  });

  console.log("Seeded clinic:", clinic.slug);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
