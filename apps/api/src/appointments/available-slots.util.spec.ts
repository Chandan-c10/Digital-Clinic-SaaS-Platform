import { computeAvailableSlots, resolveBranchForTime } from "./available-slots.util";

describe("computeAvailableSlots", () => {
  // A Wednesday far enough in the future that "already past" never trips the test.
  const future = new Date();
  future.setDate(future.getDate() + 30);
  future.setHours(0, 0, 0, 0);
  while (future.getDay() !== 3) future.setDate(future.getDate() + 1);

  const wednesdayAvailability = [
    { dayOfWeek: 3, startTime: "09:00", endTime: "09:30", slotDurationMinutes: 15, isActive: true },
  ];

  it("returns 15-minute slots across the availability window", () => {
    const slots = computeAvailableSlots(future, wednesdayAvailability, new Set());
    expect(slots).toHaveLength(2);
    expect(new Date(slots[0]).getHours()).toBe(9);
    expect(new Date(slots[0]).getMinutes()).toBe(0);
    expect(new Date(slots[1]).getMinutes()).toBe(15);
  });

  it("excludes a slot that's already booked", () => {
    const nineAm = new Date(future);
    nineAm.setHours(9, 0, 0, 0);
    const slots = computeAvailableSlots(future, wednesdayAvailability, new Set([nineAm.toISOString()]));
    expect(slots).toHaveLength(1);
    expect(new Date(slots[0]).getMinutes()).toBe(15);
  });

  it("ignores availability windows for other days of the week", () => {
    const tuesdayOnly = [
      { dayOfWeek: 2, startTime: "09:00", endTime: "10:00", slotDurationMinutes: 15, isActive: true },
    ];
    expect(computeAvailableSlots(future, tuesdayOnly, new Set())).toEqual([]);
  });

  it("ignores an inactive availability window", () => {
    const inactive = [
      { dayOfWeek: 3, startTime: "09:00", endTime: "10:00", slotDurationMinutes: 15, isActive: false },
    ];
    expect(computeAvailableSlots(future, inactive, new Set())).toEqual([]);
  });

  it("never returns a slot in the past", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const slots = computeAvailableSlots(
      yesterday,
      [{ dayOfWeek: yesterday.getDay(), startTime: "09:00", endTime: "10:00", slotDurationMinutes: 15, isActive: true }],
      new Set(),
    );
    expect(slots).toEqual([]);
  });
});

describe("resolveBranchForTime", () => {
  const wednesday = new Date();
  wednesday.setDate(wednesday.getDate() + 30);
  while (wednesday.getDay() !== 3) wednesday.setDate(wednesday.getDate() + 1);

  it("returns the branchId of the availability window containing the time", () => {
    const nineFifteen = new Date(wednesday);
    nineFifteen.setHours(9, 15, 0, 0);
    const result = resolveBranchForTime(nineFifteen, [
      {
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "10:00",
        slotDurationMinutes: 15,
        isActive: true,
        branchId: "branch-downtown",
      },
    ]);
    expect(result).toBe("branch-downtown");
  });

  it("returns null when no window has a branchId (single-branch clinic)", () => {
    const nineFifteen = new Date(wednesday);
    nineFifteen.setHours(9, 15, 0, 0);
    const result = resolveBranchForTime(nineFifteen, [
      { dayOfWeek: 3, startTime: "09:00", endTime: "10:00", slotDurationMinutes: 15, isActive: true },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when the time doesn't fall inside any window", () => {
    const elevenPm = new Date(wednesday);
    elevenPm.setHours(23, 0, 0, 0);
    const result = resolveBranchForTime(elevenPm, [
      {
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "10:00",
        slotDurationMinutes: 15,
        isActive: true,
        branchId: "branch-downtown",
      },
    ]);
    expect(result).toBeNull();
  });
});
