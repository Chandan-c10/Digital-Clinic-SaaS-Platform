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
      dayOfWeek,
      startTime: "09:00",
      endTime: "13:00",
      slotDurationMinutes: 15,
    })),
  });

  const patient = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      name: "Ramesh Kumar",
      phone: "+919999999999",
      gender: "male",
      allergies: [],
    },
  });

  await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "CONFIRMED",
      type: "ONLINE",
      reasonForVisit: "Routine checkup",
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
