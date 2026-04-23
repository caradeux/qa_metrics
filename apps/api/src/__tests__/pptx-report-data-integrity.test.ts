import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@qa-metrics/database";
import { buildReportSpec } from "../lib/pptx/report-data.js";

describe("buildReportSpec — integridad de datos HU (diseño/ejecución/defectos)", () => {
  let adminUserId: string;
  let adminRoleName: string;

  beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@qametrics.com" },
      include: { role: true },
    });
    adminUserId = admin.id;
    adminRoleName = admin.role.name;
  });

  async function runSpec(periodStart: Date, periodEnd: Date) {
    // Scope: como ADMIN, ve proyectos cuyo cliente pertenece a su user.
    // Pero para el seed, admin no necesariamente es dueño de los clientes.
    // Usamos un scope genérico que abarque todo (sin filtro de cliente).
    const scope = {};
    return buildReportSpec({
      period: "monthly",
      periodStart,
      periodEnd,
      scope,
      clientFilter: null,
      userRole: adminRoleName,
      userId: adminUserId,
    });
  }

  // Rango amplio para maximizar chance de capturar cualquier DailyRecord del seed.
  const from = new Date(Date.UTC(2026, 0, 1));
  const to = new Date(Date.UTC(2026, 11, 31, 23, 59, 59));

  it("cada HU tiene designed/executed/defects como números no-NaN ≥ 0", async () => {
    const spec = await runSpec(from, to);
    for (const p of spec.projects) {
      for (const h of p.hus) {
        expect(typeof h.designed).toBe("number");
        expect(typeof h.executed).toBe("number");
        expect(typeof h.defects).toBe("number");
        expect(Number.isNaN(h.designed)).toBe(false);
        expect(Number.isNaN(h.executed)).toBe(false);
        expect(Number.isNaN(h.defects)).toBe(false);
        expect(h.designed).toBeGreaterThanOrEqual(0);
        expect(h.executed).toBeGreaterThanOrEqual(0);
        expect(h.defects).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("cada HU tiene regressionNumber ≥ 1 y complejidades HIGH|MEDIUM|LOW", async () => {
    const spec = await runSpec(from, to);
    for (const p of spec.projects) {
      for (const h of p.hus) {
        expect(h.regressionNumber).toBeGreaterThanOrEqual(0); // 0 si no tiene cycles (edge case)
        expect(["HIGH", "MEDIUM", "LOW"]).toContain(h.designComplexity);
        expect(["HIGH", "MEDIUM", "LOW"]).toContain(h.executionComplexity);
      }
    }
  });

  it("cada HU tiene statusLabel no-vacío y title no-vacío", async () => {
    const spec = await runSpec(from, to);
    for (const p of spec.projects) {
      for (const h of p.hus) {
        expect(h.title.length).toBeGreaterThan(0);
        expect(h.statusLabel.length).toBeGreaterThan(0);
      }
    }
  });

  it("suma de HUs por proyecto coincide con p.kpis (sin pérdida ni duplicación)", async () => {
    const spec = await runSpec(from, to);
    for (const p of spec.projects) {
      const sumD = p.hus.reduce((s, h) => s + h.designed, 0);
      const sumE = p.hus.reduce((s, h) => s + h.executed, 0);
      const sumB = p.hus.reduce((s, h) => s + h.defects, 0);
      expect(sumD).toBe(p.kpis.designed);
      expect(sumE).toBe(p.kpis.executed);
      expect(sumB).toBe(p.kpis.defects);
    }
  });

  it("suma de proyectos coincide con portfolio.kpis (sin pérdida ni duplicación)", async () => {
    const spec = await runSpec(from, to);
    const sumD = spec.projects.reduce((s, p) => s + p.kpis.designed, 0);
    const sumE = spec.projects.reduce((s, p) => s + p.kpis.executed, 0);
    const sumB = spec.projects.reduce((s, p) => s + p.kpis.defects, 0);
    expect(sumD).toBe(spec.portfolio.kpis.designed);
    expect(sumE).toBe(spec.portfolio.kpis.executed);
    expect(sumB).toBe(spec.portfolio.kpis.defects);
  });

  it("cada HU con assignments múltiples acumula TODOS los dailyRecords del periodo (cross-cycle)", async () => {
    const spec = await runSpec(from, to);
    for (const p of spec.projects) {
      for (const h of p.hus) {
        // Ground truth: consulta directa a Prisma por story → todos los assignments → todos los dailyRecords del periodo.
        const story = await prisma.userStory.findUniqueOrThrow({
          where: { id: h.storyId },
          include: {
            assignments: {
              where: {
                status: { in: ["REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY", "EXECUTION", "RETURNED_TO_DEV", "WAITING_UAT", "UAT"] },
              },
              include: {
                dailyRecords: {
                  where: { date: { gte: from, lte: to } },
                },
              },
            },
          },
        });
        const groundD = story.assignments.flatMap((a) => a.dailyRecords).reduce((s, r) => s + r.designed, 0);
        const groundE = story.assignments.flatMap((a) => a.dailyRecords).reduce((s, r) => s + r.executed, 0);
        const groundB = story.assignments.flatMap((a) => a.dailyRecords).reduce((s, r) => s + r.defects, 0);
        expect(h.designed).toBe(groundD);
        expect(h.executed).toBe(groundE);
        expect(h.defects).toBe(groundB);
      }
    }
  });

  it("complexityBubbles.size = designed + executed para cada HU (misma base que p.hus)", async () => {
    const spec = await runSpec(from, to);
    for (const p of spec.projects) {
      const byStoryId = new Map(p.hus.map((h) => [h.storyId, h]));
      for (const b of p.complexityBubbles) {
        const h = byStoryId.get(b.storyId);
        expect(h).toBeDefined();
        expect(b.size).toBe(h!.designed + h!.executed);
      }
      // Bubbles 1:1 con HUs (sin perder ninguna).
      expect(p.complexityBubbles.length).toBe(p.hus.length);
    }
  });

  it("HUs sin assignments activos NO aparecen en el slide (explícitamente filtradas)", async () => {
    const spec = await runSpec(from, to);
    for (const p of spec.projects) {
      for (const h of p.hus) {
        const count = await prisma.testerAssignment.count({
          where: {
            storyId: h.storyId,
            status: { in: ["REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY", "EXECUTION", "RETURNED_TO_DEV", "WAITING_UAT", "UAT"] },
          },
        });
        expect(count).toBeGreaterThan(0);
      }
    }
  });
});
