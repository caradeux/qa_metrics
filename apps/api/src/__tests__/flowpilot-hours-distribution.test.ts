import { describe, it, expect } from "vitest";
import { distributeHours, roundToStep } from "../lib/flowpilot/hours-distribution.js";

describe("roundToStep", () => {
  it("redondea a 0.5", () => {
    expect(roundToStep(1.66, 0.5)).toBe(1.5);
    expect(roundToStep(1.75, 0.5)).toBe(2);
    expect(roundToStep(0.24, 0.5)).toBe(0);
  });
});

describe("distributeHours", () => {
  it("lista vacía → mapa vacío", () => {
    expect(distributeHours([], 6).size).toBe(0);
  });
  it("total 0 → todos 0", () => {
    const out = distributeHours([{ key: "a", weight: 1 }, { key: "b", weight: 1 }], 0);
    expect(out.get("a")).toBe(0);
    expect(out.get("b")).toBe(0);
  });
  it("pesos iguales reparten parejo", () => {
    const out = distributeHours([{ key: "a", weight: 1 }, { key: "b", weight: 1 }], 6);
    expect(out.get("a")).toBe(3);
    expect(out.get("b")).toBe(3);
  });
  it("pondera por peso (2:1 de 6 → 4 y 2)", () => {
    const out = distributeHours([{ key: "a", weight: 2 }, { key: "b", weight: 1 }], 6);
    expect(out.get("a")).toBe(4);
    expect(out.get("b")).toBe(2);
  });
  it("peso total 0 → reparte parejo", () => {
    const out = distributeHours([{ key: "a", weight: 0 }, { key: "b", weight: 0 }], 5);
    expect(out.get("a")! + out.get("b")!).toBe(5);
  });
  it("cuadra el total tras redondear a 0.5 (3 items de 5h)", () => {
    const out = distributeHours([{ key: "a", weight: 1 }, { key: "b", weight: 1 }, { key: "c", weight: 1 }], 5);
    const sum = [...out.values()].reduce((s, n) => s + n, 0);
    expect(sum).toBe(5);
    for (const v of out.values()) expect(v % 0.5).toBe(0);
  });
});
