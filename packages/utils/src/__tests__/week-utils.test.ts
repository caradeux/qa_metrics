import { describe, it, expect } from "vitest";
import { getMonday, isMonday, getWeeksInRange, formatDateISO, getISOWeekNumber } from "../week-utils.js";

describe("getMonday", () => {
  it("returns the same date if already Monday", () => {
    const monday = new Date("2025-01-06T00:00:00Z"); // Monday
    const result = getMonday(monday);
    expect(result.toISOString().split("T")[0]).toBe("2025-01-06");
  });

  it("returns previous Monday for a Wednesday", () => {
    const wed = new Date("2025-01-08T12:00:00Z"); // Wednesday
    const result = getMonday(wed);
    expect(result.toISOString().split("T")[0]).toBe("2025-01-06");
  });

  it("returns previous Monday for a Sunday", () => {
    const sun = new Date("2025-01-12T12:00:00Z"); // Sunday
    const result = getMonday(sun);
    expect(result.toISOString().split("T")[0]).toBe("2025-01-06");
  });
});

describe("isMonday", () => {
  it("returns true for Monday", () => {
    expect(isMonday(new Date("2025-01-06T00:00:00Z"))).toBe(true);
  });

  it("returns false for Tuesday", () => {
    expect(isMonday(new Date("2025-01-07T00:00:00Z"))).toBe(false);
  });
});

describe("getWeeksInRange", () => {
  it("returns correct number of weeks", () => {
    const start = new Date("2025-01-06T00:00:00Z");
    const end = new Date("2025-01-27T00:00:00Z");
    const weeks = getWeeksInRange(start, end);
    expect(weeks).toHaveLength(4);
    expect(weeks[0].toISOString().split("T")[0]).toBe("2025-01-06");
    expect(weeks[3].toISOString().split("T")[0]).toBe("2025-01-27");
  });

  it("returns single week when start and end are same week", () => {
    const start = new Date("2025-01-06T00:00:00Z");
    const end = new Date("2025-01-10T00:00:00Z");
    const weeks = getWeeksInRange(start, end);
    expect(weeks).toHaveLength(1);
  });
});

describe("formatDateISO", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date("2025-03-15T14:30:00Z");
    expect(formatDateISO(date)).toBe("2025-03-15");
  });
});

describe("getISOWeekNumber", () => {
  it("returns correct week number", () => {
    const date = new Date("2025-01-06T00:00:00Z");
    const weekNum = getISOWeekNumber(date);
    expect(weekNum).toBe(2);
  });
});
