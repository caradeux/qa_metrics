import { describe, it, expect } from "vitest";
import { aggregateDailyToWeekly } from "../services/metrics.service.js";

describe("aggregateDailyToWeekly", () => {
  it("suma registros del L-V en un bucket con weekStart=lunes", () => {
    const result = aggregateDailyToWeekly([
      { date: new Date("2026-04-13T12:00:00"), designed: 2, executed: 1, defects: 0 },
      { date: new Date("2026-04-15T12:00:00"), designed: 3, executed: 2, defects: 1 },
      { date: new Date("2026-04-17T12:00:00"), designed: 1, executed: 4, defects: 0 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].designed).toBe(6);
    expect(result[0].executed).toBe(7);
    expect(result[0].defects).toBe(1);
  });

  it("separa en buckets distintos semanas distintas", () => {
    const result = aggregateDailyToWeekly([
      { date: new Date("2026-04-17T12:00:00"), designed: 1, executed: 1, defects: 0 },
      { date: new Date("2026-04-20T12:00:00"), designed: 2, executed: 2, defects: 0 },
    ]);
    expect(result).toHaveLength(2);
  });
});
