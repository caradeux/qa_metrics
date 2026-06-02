import { describe, it, expect } from "vitest";
import {
  aggregateAutomationDailyToWeekly,
  passRate,
  type AutomationDailyLike,
} from "../services/automation-metrics.service.js";

describe("automation-metrics.service", () => {
  it("buckets daily records into ISO weeks (Mon start) and sums all six counters", () => {
    const records: AutomationDailyLike[] = [
      { date: new Date("2026-04-06"), scriptsCreated: 2, scriptsRefactored: 1, scriptsFixed: 0, execTotal: 10, execPassed: 9, execFailed: 1 },
      { date: new Date("2026-04-08"), scriptsCreated: 1, scriptsRefactored: 0, scriptsFixed: 2, execTotal: 5, execPassed: 4, execFailed: 1 },
      { date: new Date("2026-04-13"), scriptsCreated: 3, scriptsRefactored: 2, scriptsFixed: 1, execTotal: 8, execPassed: 8, execFailed: 0 },
    ];
    const weeks = aggregateAutomationDailyToWeekly(records);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].scriptsCreated).toBe(3);
    expect(weeks[0].scriptsFixed).toBe(2);
    expect(weeks[0].execTotal).toBe(15);
    expect(weeks[0].execPassed).toBe(13);
    expect(weeks[1].scriptsRefactored).toBe(2);
    expect(weeks[0].weekStart.getTime()).toBeLessThan(weeks[1].weekStart.getTime());
  });

  it("passRate returns passed/total as a 0..1 fraction, and 0 when total is 0", () => {
    expect(passRate({ execTotal: 10, execPassed: 8 })).toBe(0.8);
    expect(passRate({ execTotal: 0, execPassed: 0 })).toBe(0);
  });
});
