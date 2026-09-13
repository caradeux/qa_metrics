// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClientMonthlyReport } from "../ClientMonthlyReport";

// Recharts necesita medidas reales; en jsdom basta con que no rompa.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

afterEach(cleanup);

const labels = ["Agosto", "Septiembre"];
const zeros = { labels, values: [0, 0] };
const manual = {
  designedTotal: { labels, values: [5, 10] },
  designedByProject: [],
  designedAverage: zeros,
  executedTotal: { labels, values: [4, 8] },
  executedByProject: [],
  executedAverage: zeros,
  defectsTotal: { labels, values: [1, 2] },
  defectsByProject: [],
  analysts: [],
};
const automation = {
  hasProjects: true,
  totals: {
    scriptsCreated: [0, 67],
    scriptsRefactored: [0, 119],
    scriptsFixed: [0, 0],
    execTotal: [0, 186],
    execPassed: [0, 173],
    execFailed: [0, 13],
  },
  passRatePct: [0, 93],
  scriptsByProject: [{ project: "Automatizacion", values: [0, 186] }],
  execByProject: [{ project: "Automatizacion", values: [0, 186] }],
};
function renderReport(data: Record<string, unknown>) {
  render(
    <ClientMonthlyReport
      data={{ client: { id: "c1", name: "Autofin" }, labels, ...manual, ...data } as any}
      mode="monthly"
      months={6}
      weeks={8}
      onChangeMode={vi.fn()}
      onChangeMonths={vi.fn()}
      onChangeWeeks={vi.fn()}
    />
  );
}

describe("ClientMonthlyReport", () => {
  it("proyecto de automatizacion: muestra solo la seccion de automatizacion", () => {
    renderReport({ hasManual: false, automation });
    expect(screen.getByText("Automatización")).toBeTruthy();
    expect(screen.getByText("Scripts trabajados")).toBeTruthy();
    expect(screen.getByText("67 creados · 119 refact. · 0 corregidos")).toBeTruthy();
    expect(screen.getByText("173 pasados")).toBeTruthy();
    expect(screen.queryByText("Diseño de Casos")).toBeNull();
  });

  it("proyecto manual: mantiene el reporte actual sin automatizacion", () => {
    renderReport({ hasManual: true, automation: { ...automation, hasProjects: false } });
    expect(screen.getByText("Diseño de Casos")).toBeTruthy();
    expect(screen.queryByText("Automatización")).toBeNull();
  });

  it("respuesta antigua sin campos nuevos: sigue mostrando el reporte manual", () => {
    renderReport({});
    expect(screen.getByText("Diseño de Casos")).toBeTruthy();
    expect(screen.queryByText("Automatización")).toBeNull();
  });

  it("cliente con proyectos manuales y de automatizacion: muestra ambas secciones", () => {
    renderReport({ hasManual: true, automation });
    expect(screen.getByText("Diseño de Casos")).toBeTruthy();
    expect(screen.getByText("Automatización")).toBeTruthy();
    expect(screen.queryByLabelText("Proyecto")).toBeNull();
  });
});
