import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import {
  aggregateAutomationByPeriod,
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

describe("aggregateAutomationByPeriod", () => {
  const rec = (date: string, projectId: string, over: Partial<AutomationDailyLike>) => ({
    date: new Date(date),
    projectId,
    scriptsCreated: 0,
    scriptsRefactored: 0,
    scriptsFixed: 0,
    execTotal: 0,
    execPassed: 0,
    execFailed: 0,
    ...over,
  });
  const projects = [
    { id: "p1", name: "Trinidad" },
    { id: "p2", name: "Otro" },
  ];

  it("suma por periodo y proyecto, calcula pass rate e ignora periodos fuera del reporte", () => {
    const report = aggregateAutomationByPeriod(
      [
        rec("2026-09-01", "p1", { scriptsCreated: 17 }),
        rec("2026-09-04", "p1", { scriptsCreated: 16, execTotal: 67, execPassed: 67 }),
        rec("2026-09-10", "p1", { scriptsRefactored: 39, execTotal: 119, execPassed: 106, execFailed: 13 }),
        rec("2026-10-01", "p2", { scriptsFixed: 5, execTotal: 10, execPassed: 5, execFailed: 5 }),
        rec("2026-05-01", "p1", { scriptsCreated: 99 }),
      ],
      ["2026-09", "2026-10"],
      projects,
      (d) => format(d, "yyyy-MM")
    );

    expect(report.totals.scriptsCreated).toEqual([33, 0]);
    expect(report.totals.scriptsRefactored).toEqual([39, 0]);
    expect(report.totals.execTotal).toEqual([186, 10]);
    expect(report.totals.execFailed).toEqual([13, 5]);
    expect(report.passRatePct).toEqual([93, 50]);
    expect(report.scriptsByProject).toEqual([
      { project: "Trinidad", values: [72, 0] },
      { project: "Otro", values: [0, 5] },
    ]);
    expect(report.execByProject).toEqual([
      { project: "Trinidad", values: [186, 0] },
      { project: "Otro", values: [0, 10] },
    ]);
  });

  it("usa el dia calendario de columnas @db.Date (medianoche UTC) al asignar el periodo", () => {
    // 2026-09-01T00:00Z en zonas UTC-N es 31 de agosto local; debe contar en septiembre.
    const report = aggregateAutomationByPeriod(
      [rec("2026-09-01", "p1", { scriptsCreated: 1 })],
      ["2026-08", "2026-09"],
      projects,
      (d) => format(d, "yyyy-MM")
    );
    expect(report.totals.scriptsCreated).toEqual([0, 1]);
  });
});
