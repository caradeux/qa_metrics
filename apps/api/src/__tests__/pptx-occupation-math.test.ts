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

import { splitProductiveHoursAcrossPhases } from "../lib/pptx/occupation-math.js";
import type { AssignmentPhaseType } from "@qa-metrics/database";

describe("splitProductiveHoursAcrossPhases", () => {
  type Phase = { type: AssignmentPhaseType; projectId: string };

  it("single phase in project P → todas las horas a esa fase", () => {
    const phases: Phase[] = [{ type: "EXECUTION", projectId: "P" }];
    const out = splitProductiveHoursAcrossPhases(8, phases, "P");
    expect(out.projectHours).toBe(8);
    expect(out.byPhase).toEqual({ ANALYSIS: 0, TEST_DESIGN: 0, EXECUTION: 8 });
  });

  it("dos phases en P distintas → reparto proporcional", () => {
    const phases: Phase[] = [
      { type: "TEST_DESIGN", projectId: "P" },
      { type: "EXECUTION", projectId: "P" },
    ];
    const out = splitProductiveHoursAcrossPhases(8, phases, "P");
    expect(out.projectHours).toBe(8);
    expect(out.byPhase.TEST_DESIGN).toBe(4);
    expect(out.byPhase.EXECUTION).toBe(4);
  });

  it("tester con phases en P y en Q → P recibe su proporción", () => {
    const phases: Phase[] = [
      { type: "EXECUTION", projectId: "P" },
      { type: "ANALYSIS", projectId: "Q" },
    ];
    const out = splitProductiveHoursAcrossPhases(8, phases, "P");
    expect(out.projectHours).toBe(4);
    expect(out.byPhase.EXECUTION).toBe(4);
    expect(out.byPhase.ANALYSIS).toBe(0);
  });

  it("tester sin phases activas → 0 horas a P", () => {
    const out = splitProductiveHoursAcrossPhases(8, [], "P");
    expect(out.projectHours).toBe(0);
    expect(out.byPhase).toEqual({ ANALYSIS: 0, TEST_DESIGN: 0, EXECUTION: 0 });
  });

  it("productiveHours=0 → todo cero", () => {
    const phases: Phase[] = [{ type: "EXECUTION", projectId: "P" }];
    const out = splitProductiveHoursAcrossPhases(0, phases, "P");
    expect(out.projectHours).toBe(0);
    expect(out.byPhase.EXECUTION).toBe(0);
  });
});

import { splitTransversalActivityHours } from "../lib/pptx/occupation-math.js";

describe("splitTransversalActivityHours", () => {
  it("activity con assignmentId resuelto a P → 100% a P, 0 a Q", () => {
    const out = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: "P",
      phasesByProject: { P: 1, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "P",
    });
    expect(out).toBe(2);
  });

  it("misma activity vista desde Q → 0", () => {
    const out = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: "P",
      phasesByProject: { P: 1, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "Q",
    });
    expect(out).toBe(0);
  });

  it("activity transversal (sin assignment) con phases P=2, Q=1 → 2/3 a P, 1/3 a Q", () => {
    const outP = splitTransversalActivityHours({
      activityHours: 3,
      assignmentProjectId: null,
      phasesByProject: { P: 2, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "P",
    });
    const outQ = splitTransversalActivityHours({
      activityHours: 3,
      assignmentProjectId: null,
      phasesByProject: { P: 2, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "Q",
    });
    expect(outP).toBeCloseTo(2, 5);
    expect(outQ).toBeCloseTo(1, 5);
  });

  it("transversal y el tester no tiene phases activas → reparto equitativo entre testerProjectIds", () => {
    const outP = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: null,
      phasesByProject: {},
      testerProjectIds: ["P", "Q"],
      targetProjectId: "P",
    });
    expect(outP).toBe(1);
  });

  it("transversal y el tester solo está en P → todo a P", () => {
    const outP = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: null,
      phasesByProject: {},
      testerProjectIds: ["P"],
      targetProjectId: "P",
    });
    expect(outP).toBe(2);
  });
});

import { aggregateOccupationCurve } from "../lib/pptx/occupation-math.js";

describe("aggregateOccupationCurve (integración de formulas §5.1)", () => {
  it("proyecto con 1 tester, 5 días L-V, fase EXECUTION todo el tiempo, sin activities → banda EXECUTION=40h, resto=0", () => {
    const from = new Date(Date.UTC(2026, 3, 13)); // lunes
    const to = new Date(Date.UTC(2026, 3, 17, 23, 59, 59)); // viernes
    const out = aggregateOccupationCurve({
      projectId: "P",
      from,
      to,
      bucketing: "daily",
      testers: [{ id: "T1", allocation: 100, projectIdsActive: ["P"] }],
      phaseSegments: [
        { testerId: "T1", projectId: "P", type: "EXECUTION", start: from, end: to },
      ],
      activities: [],
      holidaysMs: new Set(),
    });
    expect(out.buckets).toHaveLength(5);
    const byLabel = Object.fromEntries(out.bands.map((b) => [b.label, b.values.reduce((s, v) => s + v, 0)]));
    expect(byLabel["Ejecución"]).toBeCloseTo(40, 5);
    expect(byLabel["Reunión con usuario"]).toBe(0);
    expect(byLabel["Productivas no imputadas"]).toBe(0);
  });

  it("proyecto con 1 tester, 1 día, 2h reunión con usuario + fase EXECUTION → EXECUTION=6h, reunión=2h", () => {
    const mon = new Date(Date.UTC(2026, 3, 13));
    const end = new Date(Date.UTC(2026, 3, 13, 23, 59, 59));
    const out = aggregateOccupationCurve({
      projectId: "P",
      from: mon,
      to: end,
      bucketing: "daily",
      testers: [{ id: "T1", allocation: 100, projectIdsActive: ["P"] }],
      phaseSegments: [
        { testerId: "T1", projectId: "P", type: "EXECUTION", start: mon, end },
      ],
      activities: [
        {
          testerId: "T1",
          categoryName: "Reunión con usuario",
          assignmentProjectId: "P",
          start: new Date(Date.UTC(2026, 3, 13, 9)),
          end: new Date(Date.UTC(2026, 3, 13, 11)),
        },
      ],
      holidaysMs: new Set(),
    });
    const totals = Object.fromEntries(out.bands.map((b) => [b.label, b.values.reduce((s, v) => s + v, 0)]));
    expect(totals["Ejecución"]).toBeCloseTo(6, 5);
    expect(totals["Reunión con usuario"]).toBeCloseTo(2, 5);
  });

  it("sin phases activas pero con productiveHours → banda 'Productivas no imputadas'", () => {
    const mon = new Date(Date.UTC(2026, 3, 13));
    const end = new Date(Date.UTC(2026, 3, 13, 23, 59, 59));
    const out = aggregateOccupationCurve({
      projectId: "P",
      from: mon,
      to: end,
      bucketing: "daily",
      testers: [{ id: "T1", allocation: 100, projectIdsActive: ["P"] }],
      phaseSegments: [],
      activities: [],
      holidaysMs: new Set(),
    });
    const totals = Object.fromEntries(out.bands.map((b) => [b.label, b.values.reduce((s, v) => s + v, 0)]));
    expect(totals["Productivas no imputadas"]).toBeCloseTo(8, 5);
    expect(totals["Ejecución"]).toBe(0);
  });

  it("capacityHours por bucket refleja la capacidad total del proyecto", () => {
    const mon = new Date(Date.UTC(2026, 3, 13));
    const fri = new Date(Date.UTC(2026, 3, 17, 23, 59, 59));
    const out = aggregateOccupationCurve({
      projectId: "P",
      from: mon,
      to: fri,
      bucketing: "daily",
      testers: [
        { id: "T1", allocation: 100, projectIdsActive: ["P"] },
        { id: "T2", allocation: 50, projectIdsActive: ["P"] },
      ],
      phaseSegments: [],
      activities: [],
      holidaysMs: new Set(),
    });
    // Cada día: capacity = 8h + 4h = 12h
    expect(out.buckets.every((b) => b.capacityHours === 12)).toBe(true);
  });
});
