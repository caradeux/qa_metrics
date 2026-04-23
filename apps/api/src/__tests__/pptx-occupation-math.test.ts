import { describe, it, expect } from "vitest";
import { dailyCapacityHours } from "../lib/pptx/occupation-math.js";

describe("dailyCapacityHours", () => {
  it("L-V con allocation=100 → 8h", () => {
    const monday = new Date(Date.UTC(2026, 3, 13)); // lunes 13-abr-2026
    expect(dailyCapacityHours(monday, 100, new Set())).toBe(8);
  });

  it("sábado → 0h aunque allocation=100", () => {
    const saturday = new Date(Date.UTC(2026, 3, 18));
    expect(dailyCapacityHours(saturday, 100, new Set())).toBe(0);
  });

  it("allocation=50 en día hábil → 4h", () => {
    const monday = new Date(Date.UTC(2026, 3, 13));
    expect(dailyCapacityHours(monday, 50, new Set())).toBe(4);
  });

  it("día hábil pero feriado → 0h", () => {
    const firstMay = new Date(Date.UTC(2026, 4, 1));
    const holidays = new Set([firstMay.getTime()]);
    expect(dailyCapacityHours(firstMay, 100, holidays)).toBe(0);
  });
});
