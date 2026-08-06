import { describe, test, expect } from "vitest";
import { buildAssignmentPayloads } from "../assignment-payloads";

const base = {
  storyId: "story-1",
  cycleId: "cycle-3",
  status: "WAITING_QA_DEPLOY",
  notes: null,
  phases: [],
  startDate: "2026-08-04",
  endDate: "2026-08-07",
};

describe("buildAssignmentPayloads", () => {
  test("crea una asignacion por cada analista seleccionado", () => {
    // Arrange
    const args = { ...base, testerIds: ["tester-renato", "tester-ana"] };

    // Act
    const payloads = buildAssignmentPayloads(args);

    // Assert
    expect(payloads).toHaveLength(2);
    expect(payloads.map((p) => p.testerId)).toEqual(["tester-renato", "tester-ana"]);
    expect(payloads.every((p) => p.storyId === "story-1" && p.cycleId === "cycle-3")).toBe(true);
  });

  test("mantiene un solo payload cuando hay un unico analista", () => {
    const payloads = buildAssignmentPayloads({ ...base, testerIds: ["tester-renato"] });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      testerId: "tester-renato",
      storyId: "story-1",
      cycleId: "cycle-3",
      status: "WAITING_QA_DEPLOY",
      notes: null,
    });
  });

  test("devuelve lista vacia cuando no hay analistas seleccionados", () => {
    expect(buildAssignmentPayloads({ ...base, testerIds: [] })).toEqual([]);
  });

  test("deduplica analistas repetidos para no chocar con el unique (testerId, storyId, cycleId)", () => {
    const payloads = buildAssignmentPayloads({
      ...base,
      testerIds: ["tester-renato", "tester-ana", "tester-renato"],
    });

    expect(payloads.map((p) => p.testerId)).toEqual(["tester-renato", "tester-ana"]);
  });

  test("sin fases, envia startDate/endDate en ISO para cada analista", () => {
    const payloads = buildAssignmentPayloads({ ...base, testerIds: ["t1", "t2"] });

    for (const p of payloads) {
      expect(p.startDate).toBe("2026-08-04T00:00:00.000Z");
      expect(p.endDate).toBe("2026-08-07T00:00:00.000Z");
      expect(p.phases).toBeUndefined();
    }
  });

  test("sin fases y sin fecha de termino, endDate viaja como null", () => {
    const payloads = buildAssignmentPayloads({ ...base, testerIds: ["t1"], endDate: "" });

    expect(payloads[0].endDate).toBeNull();
  });

  test("con fases, cada analista recibe su propio plan de fases y no fechas sueltas", () => {
    const phases = [
      { phase: "ANALYSIS", startDate: "2026-08-04", endDate: "2026-08-05" },
      { phase: "TEST_DESIGN", startDate: "2026-08-06", endDate: "2026-08-07" },
    ];

    const payloads = buildAssignmentPayloads({ ...base, testerIds: ["t1", "t2"], phases });

    expect(payloads).toHaveLength(2);
    for (const p of payloads) {
      expect(p.phases).toEqual(phases);
      expect(p.startDate).toBeUndefined();
      expect(p.endDate).toBeUndefined();
    }
  });

  test("las fases de un analista no comparten referencia con las de otro", () => {
    const phases = [{ phase: "ANALYSIS", startDate: "2026-08-04", endDate: "2026-08-05" }];

    const payloads = buildAssignmentPayloads({ ...base, testerIds: ["t1", "t2"], phases });

    expect(payloads[0].phases).not.toBe(payloads[1].phases);
  });
});
