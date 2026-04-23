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
