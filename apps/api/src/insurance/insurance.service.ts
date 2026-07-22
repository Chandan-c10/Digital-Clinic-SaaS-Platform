import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InsuranceClaimStatus, PaymentMethod } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { MAX_PAGE_SIZE } from "../common/pagination.util";
import { CreateInsuranceProviderDto } from "./dto/create-provider.dto";
import { CreateInsurancePolicyDto } from "./dto/create-policy.dto";
import { FileInsuranceClaimDto } from "./dto/file-claim.dto";
import { RespondInsuranceClaimDto } from "./dto/respond-claim.dto";

@Injectable()
export class InsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  listProviders(clinicId: string) {
    return this.prisma.insuranceProvider.findMany({
      where: { clinicId },
      orderBy: { name: "asc" },
      take: MAX_PAGE_SIZE, // QA/security audit, TC-FUNC-01 / TC-PERF-01
    });
  }

  createProvider(clinicId: string, dto: CreateInsuranceProviderDto) {
    return this.prisma.insuranceProvider.create({ data: { clinicId, ...dto } });
  }

  listPolicies(clinicId: string, patientId?: string) {
    return this.prisma.insurancePolicy.findMany({
      where: { clinicId, ...(patientId && { patientId }) },
      include: { provider: true, patient: true },
      orderBy: { createdAt: "desc" },
      take: MAX_PAGE_SIZE, // QA/security audit, TC-FUNC-01 / TC-PERF-01
    });
  }

  async createPolicy(clinicId: string, dto: CreateInsurancePolicyDto) {
    const [patient, provider] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } }),
      this.prisma.insuranceProvider.findFirst({ where: { id: dto.providerId, clinicId } }),
    ]);
    if (!patient) throw new NotFoundException("Patient not found");
    if (!provider) throw new NotFoundException("Insurance provider not found");

    return this.prisma.insurancePolicy.create({
      data: { clinicId, ...dto },
      include: { provider: true },
    });
  }

  listClaims(clinicId: string, filters: { invoiceId?: string; policyId?: string }) {
    return this.prisma.insuranceClaim.findMany({
      where: { clinicId, ...filters },
      include: { policy: { include: { provider: true } }, invoice: true },
      orderBy: { submittedAt: "desc" },
      take: MAX_PAGE_SIZE, // QA/security audit, TC-FUNC-01 / TC-PERF-01
    });
  }

  async findClaim(clinicId: string, id: string) {
    const claim = await this.prisma.insuranceClaim.findFirst({
      where: { id, clinicId },
      include: { policy: { include: { provider: true, patient: true } }, invoice: true },
    });
    if (!claim) throw new NotFoundException("Insurance claim not found");
    return claim;
  }

  async fileClaim(clinicId: string, submittedById: string, dto: FileInsuranceClaimDto) {
    const [invoice, policy] = await Promise.all([
      this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, clinicId } }),
      this.prisma.insurancePolicy.findFirst({ where: { id: dto.policyId, clinicId } }),
    ]);
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (!policy) throw new NotFoundException("Insurance policy not found");
    if (policy.patientId !== invoice.patientId) {
      throw new BadRequestException("This policy doesn't belong to the invoice's patient");
    }
    if (dto.claimedAmount > invoice.totalAmount.toNumber()) {
      throw new BadRequestException("Claimed amount cannot exceed the invoice total");
    }

    return this.prisma.insuranceClaim.create({
      data: {
        clinicId,
        invoiceId: dto.invoiceId,
        policyId: dto.policyId,
        claimedAmount: dto.claimedAmount,
        notes: dto.notes,
        submittedById,
      },
      include: { policy: { include: { provider: true } } },
    });
  }

  /**
   * Reaching PAID doesn't move money by itself — it calls the existing
   * BillingService.recordPayment (method: INSURANCE), reusing Billing's
   * balance/status-transition logic (and its own remaining-balance check)
   * rather than duplicating "apply this to the invoice" here.
   */
  async respondToClaim(
    clinicId: string,
    id: string,
    respondedById: string,
    dto: RespondInsuranceClaimDto,
  ) {
    const claim = await this.findClaim(clinicId, id);
    if (claim.status === InsuranceClaimStatus.PAID) {
      throw new BadRequestException("This claim has already been paid");
    }

    const needsAmount = dto.status !== InsuranceClaimStatus.REJECTED;
    if (needsAmount && !dto.approvedAmount) {
      throw new BadRequestException("approvedAmount is required for this status");
    }

    const updated = await this.prisma.insuranceClaim.update({
      where: { id },
      data: {
        status: dto.status,
        approvedAmount: needsAmount ? dto.approvedAmount : undefined,
        notes: dto.notes ?? claim.notes,
        respondedAt: new Date(),
      },
    });

    if (dto.status === InsuranceClaimStatus.PAID && dto.approvedAmount) {
      await this.billing.recordPayment(clinicId, claim.invoiceId, respondedById, {
        amount: dto.approvedAmount,
        method: PaymentMethod.INSURANCE,
        reference: `Insurance claim ${id} (${claim.policy.provider.name})`,
      });
    }

    return updated;
  }
}
