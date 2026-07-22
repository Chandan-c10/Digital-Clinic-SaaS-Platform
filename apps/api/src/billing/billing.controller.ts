import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { InvoiceStatus, Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { BillingService } from "./billing.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { streamInvoicePdf } from "./invoice-pdf";

const BILLING_ROLES = [Role.CLINIC_OWNER, Role.RECEPTIONIST, Role.ACCOUNTANT];
const BILLING_READ_ROLES = [...BILLING_ROLES, Role.DOCTOR];

@Controller("billing/invoices")
@UseGuards(TenantGuard)
@Roles(...BILLING_ROLES)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(...BILLING_READ_ROLES)
  list(
    @CurrentUser() user: RequestUser,
    @Query("patientId") patientId?: string,
    @Query("status") status?: InvoiceStatus,
  ) {
    return this.billingService.list(user.clinicId!, { patientId, status });
  }

  @Get(":id")
  @Roles(...BILLING_READ_ROLES)
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.billingService.findOne(user.clinicId!, id);
  }

  @Get(":id/pdf")
  @Roles(...BILLING_READ_ROLES)
  async downloadPdf(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const invoice = await this.billingService.findOne(user.clinicId!, id);
    streamInvoicePdf(res, {
      invoiceNumber: invoice.invoiceNumber,
      clinicName: invoice.clinic.name,
      patientName: invoice.patient.name,
      lineItems: invoice.lineItems as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>,
      subtotal: invoice.subtotal.toNumber(),
      discountAmount: invoice.discountAmount.toNumber(),
      taxAmount: invoice.taxAmount.toNumber(),
      totalAmount: invoice.totalAmount.toNumber(),
      amountPaid: invoice.amountPaid.toNumber(),
      currency: invoice.currency,
      status: invoice.status,
      createdAt: invoice.createdAt,
    });
  }

  // QA/security audit, TC-SEC-08 — see the identical comment on
  // PatientsController.create.
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto) {
    return this.billingService.create(user.clinicId!, user.userId, dto);
  }

  @Post(":id/payments")
  recordPayment(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billingService.recordPayment(user.clinicId!, id, user.userId, dto);
  }

  @Patch(":id/cancel")
  @Roles(Role.CLINIC_OWNER, Role.ACCOUNTANT)
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.billingService.cancel(user.clinicId!, id);
  }
}
