import { describe, it, expect } from "vitest";
import { isLatestCycleExcluded } from "../lib/alert-visibility.js";

const EXCLUDED = ["ON_HOLD", "PRODUCTION", "UAT"];
const older = new Date("2026-06-01T00:00:00Z");
const newer = new Date("2026-06-20T00:00:00Z");

describe("isLatestCycleExcluded — suprimir HUs cuyo último ciclo está cerrado", () => {
  it("sin assignments → false", () => {
    expect(isLatestCycleExcluded([], EXCLUDED)).toBe(false);
  });

  it("un ciclo activo (EXECUTION) → false (debe alertar)", () => {
    expect(isLatestCycleExcluded([{ status: "EXECUTION", createdAt: newer }], EXCLUDED)).toBe(false);
  });

  it("un ciclo en PRODUCTION → true (no alertar)", () => {
    expect(isLatestCycleExcluded([{ status: "PRODUCTION", createdAt: newer }], EXCLUDED)).toBe(true);
  });

  it("EL BUG: ciclo viejo RETURNED_TO_DEV + ciclo nuevo PRODUCTION → true (no alertar)", () => {
    const assignments = [
      { status: "RETURNED_TO_DEV", createdAt: older },
      { status: "PRODUCTION", createdAt: newer },
    ];
    expect(isLatestCycleExcluded(assignments, EXCLUDED)).toBe(true);
  });

  it("ciclo viejo PRODUCTION + ciclo nuevo EXECUTION (reabierto) → false (sí alertar)", () => {
    const assignments = [
      { status: "PRODUCTION", createdAt: older },
      { status: "EXECUTION", createdAt: newer },
    ];
    expect(isLatestCycleExcluded(assignments, EXCLUDED)).toBe(false);
  });

  it("último ciclo en UAT → true (no alertar)", () => {
    expect(isLatestCycleExcluded([{ status: "UAT", createdAt: newer }], EXCLUDED)).toBe(true);
  });
});
