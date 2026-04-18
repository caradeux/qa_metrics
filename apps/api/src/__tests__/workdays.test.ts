import { describe, it, expect, beforeAll } from "vitest";
import { workdaysInRange } from "../lib/workdays.js";
import { prisma } from "@qa-metrics/database";

describe("workdaysInRange", () => {
  beforeAll(async () => {
    // Asegurar feriado conocido: 1-may-2026
    await prisma.holiday.upsert({
      where: { date: new Date(Date.UTC(2026, 4, 1)) },
      update: {},
      create: { date: new Date(Date.UTC(2026, 4, 1)), name: "Día del Trabajo" },
    });
  });

  it("cuenta solo días hábiles lunes-viernes sin feriados", async () => {
    // Rango: lunes 27-abr-2026 al domingo 3-may-2026
    // Días hábiles esperados: 27,28,29,30 (1-may es feriado) → 4 días
    const from = new Date(Date.UTC(2026, 3, 27));
    const to = new Date(Date.UTC(2026, 4, 3));
    const result = await workdaysInRange(from, to);
    expect(result.length).toBe(4);
  });

  it("retorna vacío si solo abarca fin de semana", async () => {
    const from = new Date(Date.UTC(2026, 3, 25)); // sábado
    const to = new Date(Date.UTC(2026, 3, 26));   // domingo
    const result = await workdaysInRange(from, to);
    expect(result.length).toBe(0);
  });

  it("retorna vacío si from > to", async () => {
    const from = new Date(Date.UTC(2026, 4, 10));
    const to = new Date(Date.UTC(2026, 4, 5));
    const result = await workdaysInRange(from, to);
    expect(result.length).toBe(0);
  });
});
