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

import { computeMissingWorkdays } from "../lib/workdays.js";

describe("computeMissingWorkdays", () => {
  beforeAll(async () => {
    await prisma.holiday.upsert({
      where: { date: new Date(Date.UTC(2026, 4, 1)) },
      update: {},
      create: { date: new Date(Date.UTC(2026, 4, 1)), name: "Día del Trabajo" },
    });
  });

  it("retorna los días hábiles del rango que no están registrados", async () => {
    // Rango: lun 27-abr-2026 al vie 1-may-2026
    // Hábiles: 27,28,29,30 (1-may feriado)
    // Registrados: 28,30
    // Faltantes esperados: 27,29
    const result = await computeMissingWorkdays({
      startDate: new Date(Date.UTC(2026, 3, 27)),
      endDate: new Date(Date.UTC(2026, 4, 1)),
      registeredIso: new Set(["2026-04-28", "2026-04-30"]),
      today: new Date(Date.UTC(2026, 4, 10)),
    });
    expect(result).toEqual(["2026-04-27", "2026-04-29"]);
  });

  it("no evalúa fechas futuras aunque el ciclo termine después", async () => {
    // Rango: lun 27-abr-2026 al vie 8-may-2026; hoy es mié 29-abr
    // Hábiles hasta hoy inclusive: 27,28,29
    // Registrados: 27,28 → faltante: 29
    const result = await computeMissingWorkdays({
      startDate: new Date(Date.UTC(2026, 3, 27)),
      endDate: new Date(Date.UTC(2026, 4, 8)),
      registeredIso: new Set(["2026-04-27", "2026-04-28"]),
      today: new Date(Date.UTC(2026, 3, 29)),
    });
    expect(result).toEqual(["2026-04-29"]);
  });

  it("retorna vacío si el ciclo aún no empieza", async () => {
    const result = await computeMissingWorkdays({
      startDate: new Date(Date.UTC(2026, 4, 10)),
      endDate: new Date(Date.UTC(2026, 4, 15)),
      registeredIso: new Set(),
      today: new Date(Date.UTC(2026, 4, 1)),
    });
    expect(result).toEqual([]);
  });

  it("retorna vacío si startDate es null", async () => {
    const result = await computeMissingWorkdays({
      startDate: null,
      endDate: new Date(Date.UTC(2026, 4, 15)),
      registeredIso: new Set(),
      today: new Date(Date.UTC(2026, 4, 20)),
    });
    expect(result).toEqual([]);
  });

  it("usa hoy como fin cuando endDate es null", async () => {
    const result = await computeMissingWorkdays({
      startDate: new Date(Date.UTC(2026, 3, 27)),
      endDate: null,
      registeredIso: new Set(["2026-04-28"]),
      today: new Date(Date.UTC(2026, 3, 29)),
    });
    expect(result).toEqual(["2026-04-27", "2026-04-29"]);
  });
});
