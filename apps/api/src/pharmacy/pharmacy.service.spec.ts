import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PharmacyService } from "./pharmacy.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";

function makePrismaMock() {
  const tx = {
    prescription: { update: jest.fn() },
  };
  const mock = {
    prescription: { findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn((cb: (tx: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  };
  return mock as unknown as PrismaService & { __tx: typeof tx };
}

function makeInventoryMock() {
  return {
    stockFor: jest.fn().mockResolvedValue(100),
    recordTransaction: jest.fn().mockResolvedValue({ id: "txn-1" }),
  } as unknown as InventoryService;
}

describe("PharmacyService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let inventory: ReturnType<typeof makeInventoryMock>;
  let service: PharmacyService;

  const baseDto = { items: [{ inventoryItemId: "item-1", quantity: 10 }] };

  beforeEach(() => {
    prisma = makePrismaMock();
    inventory = makeInventoryMock();
    service = new PharmacyService(prisma, inventory);
  });

  it("scopes listPending() to the caller's clinic and unfulfilled prescriptions", async () => {
    (prisma.prescription.findMany as jest.Mock).mockResolvedValue([]);
    await service.listPending("clinic-1");
    expect(prisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1", dispensedAt: null } }),
    );
  });

  it("refuses to dispense a prescription outside the caller's clinic", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.dispense("clinic-1", "rx-from-clinic-2", "user-1", baseDto),
    ).rejects.toThrow(NotFoundException);
    expect(inventory.recordTransaction).not.toHaveBeenCalled();
  });

  it("refuses to dispense an already-dispensed prescription", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue({
      id: "rx-1",
      dispensedAt: new Date(),
    });
    await expect(service.dispense("clinic-1", "rx-1", "user-1", baseDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("refuses an unknown inventory item before marking the prescription dispensed", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue({ id: "rx-1", dispensedAt: null });
    (inventory.recordTransaction as jest.Mock).mockRejectedValue(
      new NotFoundException("Inventory item not found"),
    );
    await expect(service.dispense("clinic-1", "rx-1", "user-1", baseDto)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.__tx.prescription.update).not.toHaveBeenCalled();
  });

  it("refuses to dispense more than is in stock", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue({ id: "rx-1", dispensedAt: null });
    (inventory.recordTransaction as jest.Mock).mockRejectedValue(
      new BadRequestException("This would take stock negative"),
    );
    await expect(service.dispense("clinic-1", "rx-1", "user-1", baseDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.__tx.prescription.update).not.toHaveBeenCalled();
  });

  it("records a DISPENSED transaction tagged with the prescriptionId and marks it dispensed", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue({ id: "rx-1", dispensedAt: null });
    (prisma.__tx.prescription.update as jest.Mock).mockResolvedValue({
      id: "rx-1",
      dispensedAt: new Date(),
    });

    await service.dispense("clinic-1", "rx-1", "user-1", baseDto);

    expect(inventory.recordTransaction).toHaveBeenCalledWith(
      "clinic-1",
      "item-1",
      "user-1",
      expect.objectContaining({ type: "DISPENSED", quantity: 10 }),
      "rx-1",
      prisma.__tx,
    );
    expect(prisma.__tx.prescription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rx-1" }, data: { dispensedAt: expect.any(Date) } }),
    );
  });

  it("shares one transaction across every line, so a mid-loop failure leaves nothing dispensed", async () => {
    const dto = {
      items: [
        { inventoryItemId: "item-1", quantity: 10 },
        { inventoryItemId: "item-2", quantity: 999 }, // fails stock check
      ],
    };
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue({ id: "rx-1", dispensedAt: null });
    (inventory.recordTransaction as jest.Mock)
      .mockResolvedValueOnce({ id: "txn-1" })
      .mockRejectedValueOnce(new BadRequestException("This would take stock negative"));

    await expect(service.dispense("clinic-1", "rx-1", "user-1", dto)).rejects.toThrow(
      BadRequestException,
    );

    // Both lines went through the same transaction client, and because the
    // second line failed, the prescription is never stamped dispensed —
    // proving the write isn't left half-applied.
    expect(inventory.recordTransaction).toHaveBeenNthCalledWith(
      1,
      "clinic-1",
      "item-1",
      "user-1",
      expect.objectContaining({ quantity: 10 }),
      "rx-1",
      prisma.__tx,
    );
    expect(inventory.recordTransaction).toHaveBeenNthCalledWith(
      2,
      "clinic-1",
      "item-2",
      "user-1",
      expect.objectContaining({ quantity: 999 }),
      "rx-1",
      prisma.__tx,
    );
    expect(prisma.__tx.prescription.update).not.toHaveBeenCalled();
  });
});
