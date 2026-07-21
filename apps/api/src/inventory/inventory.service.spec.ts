import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InventoryTransactionType } from "@digital-clinic/database";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    inventoryItem: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    inventoryTransaction: { findMany: jest.fn(), aggregate: jest.fn(), create: jest.fn() },
    branch: { findFirst: jest.fn() },
  } as unknown as PrismaService;
}

describe("InventoryService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: InventoryService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new InventoryService(prisma);
  });

  it("scopes listItems() to the caller's clinic", async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    await service.listItems("clinic-1", {});
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
  });

  it("computes current stock as the sum of the item's ledger entries", async () => {
    (prisma.inventoryTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 42 },
    });
    const stock = await service.stockFor("item-1");
    expect(stock).toBe(42);
    expect(prisma.inventoryTransaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemId: "item-1", branchId: null } }),
    );
  });

  it("treats no transactions as zero stock, not null", async () => {
    (prisma.inventoryTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: null },
    });
    expect(await service.stockFor("item-1")).toBe(0);
  });

  it("filters listItems(lowStockOnly) using each item's own reorderLevel", async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: "low", reorderLevel: 10 },
      { id: "ok", reorderLevel: 10 },
    ]);
    (prisma.inventoryTransaction.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { quantity: 5 } }) // "low" item: 5 <= 10
      .mockResolvedValueOnce({ _sum: { quantity: 20 } }); // "ok" item: 20 > 10

    const result = await service.listItems("clinic-1", { lowStockOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("low");
  });

  it("refuses to record a transaction against an item outside the caller's clinic", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.recordTransaction("clinic-1", "item-from-clinic-2", "user-1", {
        type: InventoryTransactionType.RECEIVED,
        quantity: 10,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  it("refuses a branch that doesn't belong to the caller's clinic", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: "item-1" });
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.recordTransaction("clinic-1", "item-1", "user-1", {
        type: InventoryTransactionType.RECEIVED,
        quantity: 10,
        branchId: "branch-from-clinic-2",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("refuses a transaction that would take stock negative", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: "item-1" });
    (prisma.inventoryTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 5 },
    });
    await expect(
      service.recordTransaction("clinic-1", "item-1", "user-1", {
        type: InventoryTransactionType.DISPENSED,
        quantity: 10,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  it("applies the correct sign per transaction type", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: "item-1" });
    (prisma.inventoryTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 100 },
    });
    (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: "txn-1" });

    await service.recordTransaction("clinic-1", "item-1", "user-1", {
      type: InventoryTransactionType.DISPENSED,
      quantity: 10,
    });
    expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: -10 }) }),
    );

    await service.recordTransaction("clinic-1", "item-1", "user-1", {
      type: InventoryTransactionType.RECEIVED,
      quantity: 10,
    });
    expect(prisma.inventoryTransaction.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 10 }) }),
    );
  });

  it("rejects a zero-quantity transaction", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: "item-1" });
    await expect(
      service.recordTransaction("clinic-1", "item-1", "user-1", {
        type: InventoryTransactionType.ADJUSTED,
        quantity: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("tracks a branch-scoped pool separately from the branch-less pool for the same item", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: "item-1" });
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: "branch-1" });
    (prisma.inventoryTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 0 },
    });

    await service.recordTransaction("clinic-1", "item-1", "user-1", {
      type: InventoryTransactionType.RECEIVED,
      quantity: 5,
      branchId: "branch-1",
    });

    expect(prisma.inventoryTransaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemId: "item-1", branchId: "branch-1" } }),
    );
  });
});
