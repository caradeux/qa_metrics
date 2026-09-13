import { prisma } from "@qa-metrics/database";
import type { AutomationProjectReportData, ReportPeriod } from "./types.js";
import { summarizeAutomationProject } from "./automation-report-math.js";

/**
 * Proyectos de automatización del alcance del reporte: los que tuvieron
 * registros de automatización en el periodo o tienen líneas abiertas (activas
 * o en mantenimiento) iniciadas antes del fin del periodo.
 */
export async function buildAutomationProjects(input: {
  scope: Record<string, unknown>;
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
}): Promise<{ projects: AutomationProjectReportData[]; testerUserKeys: string[] }> {
  const { scope, period, periodStart, periodEnd } = input;
  const inPeriod = { date: { gte: periodStart, lte: periodEnd } };

  const loaded = await prisma.project.findMany({
    where: {
      ...scope,
      testLines: {
        some: {
          assignments: {
            some: {
              OR: [
                { records: { some: inPeriod } },
                { status: { in: ["ACTIVE", "MAINTENANCE"] }, startDate: { lte: periodEnd } },
              ],
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      client: { select: { name: true } },
      projectManager: { select: { name: true } },
      testers: {
        select: { id: true, name: true, allocation: true, userId: true },
        orderBy: { allocation: "desc" },
      },
      testLines: {
        select: {
          id: true,
          name: true,
          assignments: {
            select: {
              status: true,
              createdAt: true,
              tester: { select: { name: true } },
              records: {
                where: inPeriod,
                select: {
                  date: true,
                  scriptsCreated: true,
                  scriptsRefactored: true,
                  scriptsFixed: true,
                  execTotal: true,
                  execPassed: true,
                  execFailed: true,
                  notes: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const testerUserKeys = new Set<string>();
  const projects = loaded.map((p) => {
    for (const t of p.testers) testerUserKeys.add(t.userId ?? `anon:${t.id}`);
    const records = p.testLines.flatMap((l) =>
      l.assignments.flatMap((a) => a.records.map((r) => ({ ...r, testLineId: l.id }))),
    );
    return summarizeAutomationProject(
      {
        id: p.id,
        name: p.name,
        clientName: p.client.name,
        projectManagerName: p.projectManager?.name ?? null,
        testers: p.testers.map(({ userId: _userId, ...t }) => t),
        lines: p.testLines.map((l) => ({
          id: l.id,
          name: l.name,
          assignments: l.assignments.map((a) => ({
            status: a.status,
            createdAt: a.createdAt,
            testerName: a.tester.name,
          })),
        })),
      },
      records,
      period,
      periodStart,
      periodEnd,
    );
  });

  return { projects, testerUserKeys: [...testerUserKeys] };
}
