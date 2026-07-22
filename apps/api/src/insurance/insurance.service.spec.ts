import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InsuranceClaimStatus, PaymentMethod } from "@digital-clinic/database";
import { InsuranceService } from "./insurance.service";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";

function decimal(n: number) {
  return { toNumber: () => n } as unknown as number & { toNumber(): number };
}

function makePrismaMock() {
  return {
    insuranceProvider: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    insurancePolicy: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    insuranceClaim: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    patient: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
  } as unknown as PrismaService;
}

function makeBillingMock() {
  return { recordPayment: jest.fn().mockResolvedValue({ id: "invoice-1" }) } as unknown as BillingService;
}

describe("InsuranceService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let billing: ReturnType<typeof makeBillingMock>;
  let service: InsuranceService;

  beforeEach(() => {
    prisma = makePrismaMock();
    billing = makeBillingMock();
    service = new InsuranceService(prisma, billing);
  });

  it("scopes listProviders()/listPolicies() to the caller's clinic", async () => {
    (prisma.insuranceProvider.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.insurancePolicy.findMany as jest.Mock).mockResolvedValue([]);
    await service.listProviders("clinic-1");
    await service.listPolicies("clinic-1");
    expect(prisma.insuranceProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1" } }),
    );
    expect(prisma.insurancePolicy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1" } }),
    );
  });

  it("refuses to create a policy for a patient outside the caller's clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.createPolicy("clinic-1", {
        patientId: "patient-from-clinic-2",
        providerId: "provider-1",
        policyNumber: "P123",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("refuses to file a claim against an invoice from a different clinic", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.fileClaim("clinic-1", "user-1", {
        invoiceId: "invoice-from-clinic-2",
        policyId: "policy-1",
        claimedAmount: 100,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("refuses a claim where the policy belongs to a different patient than the invoice", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: "invoice-1",
      patientId: "patient-A",
      totalAmount: decimal(1000),
    });
    (prisma.insurancePolicy.findFirst as jest.Mock).mockResolvedValue({
      id: "policy-1",
      patientId: "patient-B",
    });
    await expect(
      service.fileClaim("clinic-1", "user-1", {
        invoiceId: "invoice-1",
        policyId: "policy-1",
        claimedAmount: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("refuses a claim larger than the invoice total", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: "invoice-1",
      patientId: "patient-A",
      totalAmount: decimal(100),
    });
    (prisma.insurancePolicy.findFirst as jest.Mock).mockResolvedValue({
      id: "policy-1",
      patientId: "patient-A",
    });
    await expect(
      service.fileClaim("clinic-1", "user-1", {
        invoiceId: "invoice-1",
        policyId: "policy-1",
        claimedAmount: 500,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("refuses to respond to an already-paid claim", async () => {
    (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue({
      id: "claim-1",
      status: InsuranceClaimStatus.PAID,
      policy: { provider: { name: "Acme Health" } },
    });
    await expect(
      service.respondToClaim("clinic-1", "claim-1", "user-1", {
        status: InsuranceClaimStatus.PAID,
        approvedAmount: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("requires an approvedAmount for a non-rejected response", async () => {
    (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue({
      id: "claim-1",
      status: InsuranceClaimStatus.SUBMITTED,
      policy: { provider: { name: "Acme Health" } },
    });
    await expect(
      service.respondToClaim("clinic-1", "claim-1", "user-1", {
        status: InsuranceClaimStatus.APPROVED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("marking a claim PAID calls BillingService.recordPayment with method INSURANCE, reusing its balance logic", async () => {
    (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue({
      id: "claim-1",
      invoiceId: "invoice-1",
      status: InsuranceClaimStatus.APPROVED,
      notes: null,
      policy: { provider: { name: "Acme Health" } },
    });
    (prisma.insuranceClaim.update as jest.Mock).mockResolvedValue({ id: "claim-1", status: "PAID" });

    await service.respondToClaim("clinic-1", "claim-1", "user-1", {
      status: InsuranceClaimStatus.PAID,
      approvedAmount: 800,
    });

    expect(billing.recordPayment).toHaveBeenCalledWith(
      "clinic-1",
      "invoice-1",
      "user-1",
      expect.objectContaining({ amount: 800, method: PaymentMethod.INSURANCE }),
    );
  });

  it("rejecting a claim does not touch billing", async () => {
    (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue({
      id: "claim-1",
      invoiceId: "invoice-1",
      status: InsuranceClaimStatus.SUBMITTED,
      notes: null,
      policy: { provider: { name: "Acme Health" } },
    });
    (prisma.insuranceClaim.update as jest.Mock).mockResolvedValue({ id: "claim-1", status: "REJECTED" });

    await service.respondToClaim("clinic-1", "claim-1", "user-1", {
      status: InsuranceClaimStatus.REJECTED,
    });

    expect(billing.recordPayment).not.toHaveBeenCalled();
  });
});
