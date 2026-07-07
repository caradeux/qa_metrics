import { describe, it, expect } from "vitest";
import { buildAttentionItems, type AttentionAssignment } from "../lib/attention.js";

const NOW = new Date("2026-07-07T12:00:00Z").getTime();
const day = (isoOffsetDays: number) => new Date(NOW - isoOffsetDays * 86400000);

function makeAssignment(over: Partial<AttentionAssignment> & { id: string; storyId: string }): AttentionAssignment {
  const { storyId, ...rest } = over;
  return {
    status: "REGISTERED",
    endDate: null,
    updatedAt: day(1),
    createdAt: day(1),
    statusLogs: [{ changedAt: day(1) }],
    story: { id: storyId, title: `HU ${storyId}`, externalId: storyId },
    tester: { name: "Renato Garcia", project: { id: "p1", name: "Sistema de Notas", client: { name: "Universidad del Desarrollo" } } },
    ...rest,
  } as AttentionAssignment;
}

describe("buildAttentionItems — una alerta por HU (ciclo actual), no por ciclo", () => {
  it("HU multi-ciclo con ambos ciclos devueltos → una sola alerta (ciclo actual)", () => {
    // RM08: ciclo 1 devuelto a dev por error (más antiguo), ciclo 2 devuelto (actual).
    const c1 = makeAssignment({ id: "a-c1", storyId: "RM08", status: "RETURNED_TO_DEV", createdAt: day(30), statusLogs: [{ changedAt: day(30) }] });
    const c2 = makeAssignment({ id: "a-c2", storyId: "RM08", status: "RETURNED_TO_DEV", createdAt: day(2), statusLogs: [{ changedAt: day(2) }] });

    const items = buildAttentionItems([c1, c2], { now: NOW, stuckDays: 14 });

    expect(items).toHaveLength(1);
    expect(items[0].storyId).toBe("RM08");
    expect(items[0].assignmentId).toBe("a-c2"); // el ciclo actual, no el antiguo
    expect(items[0].reasons).toContain("returned");
  });

  it("ciclo actual en PRODUCCIÓN cierra la HU aunque un ciclo previo estuviera devuelto", () => {
    const prev = makeAssignment({ id: "a-prev", storyId: "RM09", status: "RETURNED_TO_DEV", createdAt: day(20) });
    const cur = makeAssignment({ id: "a-cur", storyId: "RM09", status: "PRODUCTION", createdAt: day(1) });

    const items = buildAttentionItems([prev, cur], { now: NOW, stuckDays: 14 });

    expect(items).toHaveLength(0);
  });

  it("un ciclo previo con problema no filtra cuando el ciclo actual está sano", () => {
    const prev = makeAssignment({ id: "a-prev", storyId: "RM10", status: "RETURNED_TO_DEV", createdAt: day(40), statusLogs: [{ changedAt: day(40) }] });
    const cur = makeAssignment({ id: "a-cur", storyId: "RM10", status: "REGISTERED", createdAt: day(1), statusLogs: [{ changedAt: day(1) }] });

    const items = buildAttentionItems([prev, cur], { now: NOW, stuckDays: 14 });

    expect(items).toHaveLength(0);
  });

  it("HU de un solo ciclo devuelto → una alerta con motivo 'returned'", () => {
    const a = makeAssignment({ id: "a1", storyId: "RM11", status: "RETURNED_TO_DEV", createdAt: day(3), statusLogs: [{ changedAt: day(3) }] });

    const items = buildAttentionItems([a], { now: NOW, stuckDays: 14 });

    expect(items).toHaveLength(1);
    expect(items[0].reasons).toEqual(["returned"]);
  });

  it("marca 'stuck' cuando el ciclo actual lleva más de STUCK_DAYS en estado", () => {
    const a = makeAssignment({ id: "a1", storyId: "RM12", status: "TEST_DESIGN", createdAt: day(20), statusLogs: [{ changedAt: day(20) }] });

    const items = buildAttentionItems([a], { now: NOW, stuckDays: 14 });

    expect(items).toHaveLength(1);
    expect(items[0].reasons).toContain("stuck");
    expect(items[0].daysInStatus).toBe(20);
  });

  it("marca 'overdue' cuando el ciclo actual tiene fecha fin vencida", () => {
    const a = makeAssignment({ id: "a1", storyId: "RM13", status: "EXECUTION", createdAt: day(3), endDate: day(1), statusLogs: [{ changedAt: day(3) }] });

    const items = buildAttentionItems([a], { now: NOW, stuckDays: 14 });

    expect(items).toHaveLength(1);
    expect(items[0].reasons).toContain("overdue");
  });
});
