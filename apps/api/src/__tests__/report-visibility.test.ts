import { describe, it, expect } from "vitest";
import { isStoryVisibleInPeriod } from "../lib/pptx/report-visibility.js";
import type { VisibilityAssignment } from "../lib/pptx/report-visibility.js";

const OLD = new Date("2026-06-22");
const NEW = new Date("2026-06-26");

function makeAssignment(overrides: Partial<VisibilityAssignment>): VisibilityAssignment {
  return {
    status: "EXECUTION",
    createdAt: NEW,
    dailyRecords: [],
    productionLogsInPeriod: [],
    ...overrides,
  };
}

describe("isStoryVisibleInPeriod", () => {
  it("1. sin assignments → false", () => {
    expect(isStoryVisibleInPeriod([])).toBe(false);
  });

  it("2. único ciclo EXECUTION (en progreso) → true", () => {
    const assignments = [makeAssignment({ status: "EXECUTION", createdAt: NEW })];
    expect(isStoryVisibleInPeriod(assignments)).toBe(true);
  });

  it("3. único ciclo PRODUCTION sin dailyRecords ni productionLogsInPeriod → false", () => {
    const assignments = [makeAssignment({ status: "PRODUCTION", createdAt: NEW, dailyRecords: [], productionLogsInPeriod: [] })];
    expect(isStoryVisibleInPeriod(assignments)).toBe(false);
  });

  it("4. único ciclo PRODUCTION + productionLogsInPeriod no vacío → true (pasó a prod esta semana)", () => {
    const assignments = [makeAssignment({ status: "PRODUCTION", createdAt: NEW, productionLogsInPeriod: [{}] })];
    expect(isStoryVisibleInPeriod(assignments)).toBe(true);
  });

  it("5. único ciclo PRODUCTION + dailyRecords no vacío → true (actividad en el periodo)", () => {
    const assignments = [makeAssignment({ status: "PRODUCTION", createdAt: NEW, dailyRecords: [{}] })];
    expect(isStoryVisibleInPeriod(assignments)).toBe(true);
  });

  it("6. EL BUG: ciclo viejo UAT + ciclo nuevo PRODUCTION, sin dailyRecords ni productionLogs → false", () => {
    const assignments: VisibilityAssignment[] = [
      makeAssignment({ status: "UAT",        createdAt: OLD, dailyRecords: [], productionLogsInPeriod: [] }),
      makeAssignment({ status: "PRODUCTION", createdAt: NEW, dailyRecords: [], productionLogsInPeriod: [] }),
    ];
    expect(isStoryVisibleInPeriod(assignments)).toBe(false);
  });

  it("7. ciclo viejo UAT + ciclo nuevo PRODUCTION con productionLogsInPeriod → true", () => {
    const assignments: VisibilityAssignment[] = [
      makeAssignment({ status: "UAT",        createdAt: OLD, dailyRecords: [], productionLogsInPeriod: [] }),
      makeAssignment({ status: "PRODUCTION", createdAt: NEW, dailyRecords: [], productionLogsInPeriod: [{}] }),
    ];
    expect(isStoryVisibleInPeriod(assignments)).toBe(true);
  });
});
