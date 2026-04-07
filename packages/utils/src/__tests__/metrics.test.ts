import { describe, it, expect } from "vitest";
import {
  calculateKPIs,
  aggregateWeeklyTrend,
  aggregateCaseTypes,
  aggregateDefects,
  aggregateTesterSummary,
} from "../metrics.js";

function makeRecord(overrides: Partial<Record<string, any>> = {}) {
  return {
    weekStart: "2025-01-06",
    designedTotal: 10,
    designedFunctional: 4,
    designedRegression: 3,
    designedSmoke: 2,
    designedExploratory: 1,
    executedTotal: 8,
    executedFunctional: 3,
    executedRegression: 3,
    executedSmoke: 1,
    executedExploratory: 1,
    defectsCritical: 1,
    defectsHigh: 2,
    defectsMedium: 3,
    defectsLow: 1,
    testerId: "tester-1",
    tester: { name: "Alice" },
    ...overrides,
  };
}

describe("calculateKPIs", () => {
  it("returns correct totals for a single record", () => {
    const kpis = calculateKPIs([makeRecord()]);
    expect(kpis.totalDesigned).toBe(10);
    expect(kpis.totalExecuted).toBe(8);
    expect(kpis.totalDefects).toBe(7);
    expect(kpis.executionRatio).toBe(80);
  });

  it("returns zero ratio for empty array", () => {
    const kpis = calculateKPIs([]);
    expect(kpis.totalDesigned).toBe(0);
    expect(kpis.executionRatio).toBe(0);
  });

  it("sums across multiple records", () => {
    const kpis = calculateKPIs([makeRecord(), makeRecord({ designedTotal: 20, executedTotal: 10 })]);
    expect(kpis.totalDesigned).toBe(30);
    expect(kpis.totalExecuted).toBe(18);
  });
});

describe("aggregateWeeklyTrend", () => {
  it("groups by weekStart and sorts", () => {
    const records = [
      makeRecord({ weekStart: "2025-01-13" }),
      makeRecord({ weekStart: "2025-01-06" }),
      makeRecord({ weekStart: "2025-01-06" }),
    ];
    const trend = aggregateWeeklyTrend(records);
    expect(trend).toHaveLength(2);
    expect(trend[0].weekStart).toBe("2025-01-06");
    expect(trend[0].designed).toBe(20);
    expect(trend[1].weekStart).toBe("2025-01-13");
  });
});

describe("aggregateCaseTypes", () => {
  it("sums case types correctly", () => {
    const result = aggregateCaseTypes([makeRecord(), makeRecord()]);
    expect(result.functional.designed).toBe(8);
    expect(result.regression.executed).toBe(6);
    expect(result.smoke.designed).toBe(4);
    expect(result.exploratory.executed).toBe(2);
  });
});

describe("aggregateDefects", () => {
  it("sums defect severities", () => {
    const result = aggregateDefects([makeRecord()]);
    expect(result.critical).toBe(1);
    expect(result.high).toBe(2);
    expect(result.medium).toBe(3);
    expect(result.low).toBe(1);
  });
});

describe("aggregateTesterSummary", () => {
  it("groups by tester and calculates ratio", () => {
    const records = [
      makeRecord({ testerId: "t1", tester: { name: "Alice" } }),
      makeRecord({ testerId: "t1", tester: { name: "Alice" } }),
      makeRecord({ testerId: "t2", tester: { name: "Bob" }, designedTotal: 5, executedTotal: 5 }),
    ];
    const summary = aggregateTesterSummary(records);
    expect(summary).toHaveLength(2);
    const alice = summary.find((s) => s.testerId === "t1")!;
    expect(alice.designed).toBe(20);
    expect(alice.ratio).toBe(80);
    const bob = summary.find((s) => s.testerId === "t2")!;
    expect(bob.ratio).toBe(100);
  });
});
