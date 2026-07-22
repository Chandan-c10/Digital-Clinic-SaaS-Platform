import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryTransactionType, Prisma } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { MAX_PAGE_SIZE } from "../common/pagination.util";
import { CreateInventoryItemDto } from "./dto/create-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-item.dto";
import { CreateInventoryTransactionDto } from "./dto/create-transaction.dto";

/** Either the ambient PrismaService or an interactive-transaction client —
 * lets recordTransaction() participate in a caller's transaction (see
 * PharmacyService.dispense) instead of always committing on its own. */
type Db = PrismaService | Prisma.TransactionClient;

/**
 * Converts a user-facing (always-positive, except for ADJUSTED) quantity
 * into the signed ledger delta — see the doc comment on
 * CreateInventoryTransactionDto and the InventoryTransaction model.
 */
function signedQuantity(type: InventoryTransactionType, quantity: number): number {
  switch (type) {
    case InventoryTransactionType.RECEIVED:
      return Math.abs(quantity);
    case InventoryTransactionType.DISPENSED:
    case InventoryTransactionType.EXPIRED:
    case InventoryTransactionType.DAMAGED:
      return -Math.abs(quantity);
    case InventoryTransactionType.ADJUSTED:
      return quantity;
  }
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(clinicId: string, filters: { category?: string; lowStockOnly?: boolean }) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { clinicId, ...(filters.category && { category: filters.category }) },
      orderBy: { name: "asc" },
      take: MAX_PAGE_SIZE, // QA/security audit, TC-FUNC-01 / TC-PERF-01
    });

    const withStock = await Promise.all(
      items.map(async (item) => ({
        ...item,
        currentStock: await this.stockFor(item.id),
      })),
    );

    return filters.lowStockOnly
      ? withStock.filter((item) => item.currentStock <= item.reorderLevel)
      : withStock;
  }

  async findOne(clinicId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, clinicId } });
    if (!item) throw new NotFoundException("Inventory item not found");

    const [currentStock, transactions] = await Promise.all([
      this.stockFor(id),
      this.prisma.inventoryTransaction.findMany({
        where: { itemId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return { ...item, currentStock, transactions };
  }

  createItem(clinicId: string, dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({ data: { clinicId, ...dto } });
  }

  async updateItem(clinicId: string, id: string, dto: UpdateInventoryItemDto) {
    await this.assertItemInClinic(clinicId, id);
    return this.prisma.inventoryItem.update({ where: { id }, data: dto });
  }

  /**
   * Current stock for an item, in the exact scope requested (`branchId`
   * given vs. omitted). A branch-scoped pool and the "no particular branch"
   * pool for the same item are tracked *separately*, not merged — same
   * additive convention as `branchId` everywhere else in this schema (null
   * is its own distinct scope, not "any branch"). See the model comment on
   * InventoryTransaction for why: it keeps "would this transaction go
   * negative" unambiguous without needing every clinic to have adopted
   * branches consistently across its whole transaction history.
   */
  async stockFor(itemId: string, branchId?: string | null, db: Db = this.prisma): Promise<number> {
    const result = await db.inventoryTransaction.aggregate({
      where: { itemId, branchId: branchId ?? null },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  /**
   * `prescriptionId` is not part of the public DTO (a staff member manually
   * recording a transaction via /inventory shouldn't set it) — it's an
   * internal param only PharmacyService passes, linking a DISPENSED
   * transaction back to the prescription it was dispensed against.
   *
   * `db` defaults to the ambient PrismaService but accepts an interactive
   * transaction client so callers dispensing multiple lines (PharmacyService)
   * can make every line's stock check + write atomic — see the doc comment
   * on `Db` above.
   */
  async recordTransaction(
    clinicId: string,
    itemId: string,
    performedById: string,
    dto: CreateInventoryTransactionDto,
    prescriptionId?: string,
    db: Db = this.prisma,
  ) {
    const item = await db.inventoryItem.findFirst({ where: { id: itemId, clinicId } });
    if (!item) throw new NotFoundException("Inventory item not found");

    if (dto.quantity === 0) {
      throw new BadRequestException("Quantity must not be zero");
    }

    if (dto.branchId) {
      const branch = await db.branch.findFirst({
        where: { id: dto.branchId, clinicId },
      });
      if (!branch) throw new BadRequestException("Branch does not belong to this clinic");
    }

    const delta = signedQuantity(dto.type, dto.quantity);
    const currentStock = await this.stockFor(itemId, dto.branchId, db);
    if (currentStock + delta < 0) {
      throw new BadRequestException(
        `This would take stock negative (current: ${currentStock}, change: ${delta})`,
      );
    }

    return db.inventoryTransaction.create({
      data: {
        clinicId,
        itemId,
        branchId: dto.branchId,
        type: dto.type,
        quantity: delta,
        reason: dto.reason,
        performedById,
        prescriptionId,
      },
    });
  }

  private async assertItemInClinic(clinicId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, clinicId } });
    if (!item) throw new NotFoundException("Inventory item not found");
    return item;
  }
}
