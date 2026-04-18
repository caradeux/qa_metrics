import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { computeOccupation } from "../lib/occupation.js";
import { prisma } from "@qa-metrics/database";

describe("computeOccupation", () => {
  let testerId: string;
  let categoryId: string;
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: "admin@qametrics.com" } });
    userId = user!.id;
    const tester = await prisma.tester.findFirst({ where: { allocation: 100 } });
    if (!tester) throw new Error("seed required: tester with allocation=100");
    testerId = tester.id;
    const cat = await prisma.activityCategory.findFirst({ where: { name: "Capacitación" } });
    categoryId = cat!.id;
  });

  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { createdById: userId, notes: "test-occupation" } });
  });

  it("sin actividades: capacity = workdays*8*allocation/100, activity=0, ocupación 100% teórica", async () => {
    // Rango: lunes 4-may-2026 al viernes 8-may-2026 (5 días hábiles)
    const from = new Date(Date.UTC(2026, 4, 4));
    const to = new Date(Date.UTC(2026, 4, 8, 23, 59, 59));
    const out = await computeOccupation(testerId, from, to);
    expect(out.workdays).toBe(5);
    expect(out.capacityHours).toBe(40);
    expect(out.activityHours).toBe(0);
    expect(out.productiveHoursEstimate).toBe(40);
    expect(out.occupationPct).toBe(100);
    expect(out.overallocated).toBe(false);
  });

  it("sobrecarga: activityHours > capacityHours → overallocated true", async () => {
    const from = new Date(Date.UTC(2026, 4, 11));
    const to = new Date(Date.UTC(2026, 4, 11, 23, 59, 59));
    // Registrar 10h de actividad en un día de 8h de capacidad
    await prisma.activity.create({
      data: {
        testerId, categoryId, createdById: userId, notes: "test-occupation",
        startAt: new Date(Date.UTC(2026, 4, 11, 8)),
        endAt:   new Date(Date.UTC(2026, 4, 11, 18)),
      },
    });
    const out = await computeOccupation(testerId, from, to);
    expect(out.capacityHours).toBe(8);
    expect(out.activityHours).toBe(10);
    expect(out.productiveHoursEstimate).toBe(0);
    expect(out.overallocated).toBe(true);
    expect(out.occupationPct).toBe(100);
  });

  it("actividad que cruza el límite del rango: solo se cuenta la porción dentro", async () => {
    const from = new Date(Date.UTC(2026, 4, 12, 10));
    const to = new Date(Date.UTC(2026, 4, 12, 14));
    await prisma.activity.create({
      data: {
        testerId, categoryId, createdById: userId, notes: "test-occupation",
        startAt: new Date(Date.UTC(2026, 4, 12, 8)),   // 2h antes del rango
        endAt:   new Date(Date.UTC(2026, 4, 12, 16)),  // 2h después del rango
      },
    });
    const out = await computeOccupation(testerId, from, to);
    // Porción en rango: 10:00-14:00 = 4h
    expect(out.activityHours).toBe(4);
  });
});
