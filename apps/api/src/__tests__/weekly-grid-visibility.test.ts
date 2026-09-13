import { describe, it, expect } from "vitest";
import { isVisibleInWeeklyGrid } from "../lib/weekly-grid-visibility.js";

const today = new Date("2026-09-13T00:00:00Z").getTime();
const daysAgo = (n: number) => new Date(today - n * 86_400_000);
const base = { hasRecordsInWeek: false, lastProductionAt: null, lastOnHoldAt: null };
const analyst = { isAnalyst: true, todayMs: today };
const lead = { isAnalyst: false, todayMs: today };

describe("isVisibleInWeeklyGrid", () => {
  it("estados en curso, devueltos y UAT siempre se muestran", () => {
    for (const status of ["REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY", "EXECUTION", "RETURNED_TO_DEV", "UAT"]) {
      expect(isVisibleInWeeklyGrid({ ...base, status }, lead)).toBe(true);
    }
  });

  it("HU detenida sin registros sigue visible 7 días para cargar lo trabajado antes de detenerla", () => {
    // Caso real: HU 22131 detenida el 10-09 sin haber guardado los diseños.
    expect(isVisibleInWeeklyGrid({ ...base, status: "ON_HOLD", lastOnHoldAt: daysAgo(3) }, analyst)).toBe(true);
    expect(isVisibleInWeeklyGrid({ ...base, status: "ON_HOLD", lastOnHoldAt: daysAgo(7) }, lead)).toBe(true);
  });

  it("HU detenida hace más de 7 días y sin registros ya no se muestra", () => {
    expect(isVisibleInWeeklyGrid({ ...base, status: "ON_HOLD", lastOnHoldAt: daysAgo(8) }, analyst)).toBe(false);
    expect(isVisibleInWeeklyGrid({ ...base, status: "ON_HOLD", lastOnHoldAt: null }, analyst)).toBe(false);
  });

  it("con registros en la semana se muestra en cualquier estado", () => {
    expect(isVisibleInWeeklyGrid({ ...base, status: "ON_HOLD", hasRecordsInWeek: true, lastOnHoldAt: daysAgo(40) }, lead)).toBe(true);
    expect(isVisibleInWeeklyGrid({ ...base, status: "PRODUCTION", hasRecordsInWeek: true }, lead)).toBe(true);
  });

  it("Producción mantiene la regla previa: 7 días y solo para QA_ANALYST", () => {
    expect(isVisibleInWeeklyGrid({ ...base, status: "PRODUCTION", lastProductionAt: daysAgo(2) }, analyst)).toBe(true);
    expect(isVisibleInWeeklyGrid({ ...base, status: "PRODUCTION", lastProductionAt: daysAgo(2) }, lead)).toBe(false);
    expect(isVisibleInWeeklyGrid({ ...base, status: "PRODUCTION", lastProductionAt: daysAgo(9) }, analyst)).toBe(false);
  });
});
