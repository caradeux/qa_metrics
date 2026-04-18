import { describe, it, expect } from "vitest";
import { previousWorkday } from "../lib/daily-alerts.js";

describe("previousWorkday", () => {
  it("returns Friday when called on Monday with no holidays", () => {
    // Mon 2026-04-13
    const result = previousWorkday(new Date("2026-04-13T09:00:00-03:00"), []);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-10"); // Fri
  });

  it("returns previous day when Tue->Mon", () => {
    const result = previousWorkday(new Date("2026-04-14T09:00:00-03:00"), []);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-13");
  });

  it("skips Chilean holidays", () => {
    const holidays = [new Date("2026-05-01")]; // Día del Trabajo
    // Mon 2026-05-04 -> Fri May 1 is holiday -> Thu Apr 30
    const result = previousWorkday(new Date("2026-05-04T09:00:00-03:00"), holidays);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("skips weekends and consecutive holidays", () => {
    // Mon 2026-09-21 after two holidays Fri Sep 18 + Sat Sep 19 + Sun + ...
    const holidays = [new Date("2026-09-18"), new Date("2026-09-19")];
    const result = previousWorkday(new Date("2026-09-21T09:00:00-03:00"), holidays);
    expect(result.toISOString().slice(0, 10)).toBe("2026-09-17"); // Thu
  });
});
