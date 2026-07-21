import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryTransactionType } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInventoryItemDto } from "./dto/create-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-item.dto";
import { CreateInventoryTransactionDto } from "./dto/create-transaction.dto";

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
  async stockFor(itemId: string, branchId?: string | null): Promise<number> {
    const result = await this.prisma.inventoryTransaction.aggregate({
      where: { itemId, branchId: branchId ?? null },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  async recordTransaction(
    clinicId: string,
    itemId: string,
    performedById: string,
    dto: CreateInventoryTransactionDto,
  ) {
    await this.assertItemInClinic(clinicId, itemId);

    if (dto.quantity === 0) {
      throw new BadRequestException("Quantity must not be zero");
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, clinicId },
      });
      if (!branch) throw new BadRequestException("Branch does not belong to this clinic");
    }

    const delta = signedQuantity(dto.type, dto.quantity);
    const currentStock = await this.stockFor(itemId, dto.branchId);
    if (currentStock + delta < 0) {
      throw new BadRequestException(
        `This would take stock negative (current: ${currentStock}, change: ${delta})`,
      );
    }

    return this.prisma.inventoryTransaction.create({
      data: {
        clinicId,
        itemId,
        branchId: dto.branchId,
        type: dto.type,
        quantity: delta,
        reason: dto.reason,
        performedById,
      },
    });
  }

  private async assertItemInClinic(clinicId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, clinicId } });
    if (!item) throw new NotFoundException("Inventory item not found");
    return item;
  }
}
