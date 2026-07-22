import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryTransactionType } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { DispensePrescriptionDto } from "./dto/dispense-prescription.dto";

/**
 * Not a separate domain model — dispensing is a workflow over the two that
 * already exist: it writes DISPENSED InventoryTransaction rows (via
 * InventoryService, reusing its stock/branch validation) tagged with
 * `prescriptionId`, then stamps Prescription.dispensedAt. See the schema
 * comments on those two fields.
 */
@Injectable()
export class PharmacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  listPending(clinicId: string) {
    return this.prisma.prescription.findMany({
      where: { clinicId, dispensedAt: null },
      include: { patient: true, doctor: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(clinicId: string, id: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, clinicId },
      include: {
        patient: true,
        doctor: true,
        dispenses: { include: { item: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!prescription) throw new NotFoundException("Prescription not found");
    return prescription;
  }

  async dispense(
    clinicId: string,
    prescriptionId: string,
    performedById: string,
    dto: DispensePrescriptionDto,
  ) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, clinicId },
    });
    if (!prescription) throw new NotFoundException("Prescription not found");
    if (prescription.dispensedAt) {
      throw new BadRequestException("This prescription has already been dispensed");
    }

    // Every line's existence/stock check + write happens inside one
    // transaction (passed through to InventoryService.recordTransaction as
    // its `db` param), so a concurrent dispense against the same item can no
    // longer interleave between "check" and "write" — Postgres serializes
    // the two transactions instead.
    return this.prisma.$transaction(async (tx) => {
      for (const line of dto.items) {
        await this.inventory.recordTransaction(
          clinicId,
          line.inventoryItemId,
          performedById,
          {
            type: InventoryTransactionType.DISPENSED,
            quantity: line.quantity,
            branchId: dto.branchId,
            reason: `Dispensed for prescription ${prescriptionId}`,
          },
          prescriptionId,
          tx,
        );
      }

      return tx.prescription.update({
        where: { id: prescriptionId },
        data: { dispensedAt: new Date() },
      });
    });
  }
}
