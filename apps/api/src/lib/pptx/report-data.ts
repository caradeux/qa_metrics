import { prisma } from "@qa-metrics/database";
import type { AuthRequest } from "../../middleware/auth.js";
import { isClientPm, isAnalyst, clientPmProjectIds, analystProjectIds } from "../access.js";

const ACTIVE_OR_UAT = [
  "REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY",
  "EXECUTION", "RETURNED_TO_DEV", "WAITING_UAT", "UAT",
] as const;

export async function buildProjectScope(
  req: AuthRequest,
  clientIdFilter?: string,
): Promise<Record<string, unknown>> {
  const scope: Record<string, unknown> = {};
  if (isClientPm(req)) {
    scope.id = { in: await clientPmProjectIds(req.user!.id) };
  } else if (isAnalyst(req)) {
    scope.id = { in: await analystProjectIds(req.user!.id) };
  } else {
    scope.client = { userId: req.user!.id };
  }
  if (clientIdFilter) scope.clientId = clientIdFilter;
  return scope;
}

export async function loadScopedProjects(
  scope: Record<string, unknown>,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.project.findMany({
    where: {
      ...scope,
      stories: { some: { assignments: { some: { status: { in: [...ACTIVE_OR_UAT] } } } } },
    },
    select: {
      id: true,
      name: true,
      client: { select: { id: true, name: true } },
      projectManager: { select: { name: true } },
      testers: {
        select: { id: true, name: true, allocation: true, userId: true },
        orderBy: { allocation: "desc" },
      },
      stories: {
        select: {
          id: true,
          externalId: true,
          title: true,
          designComplexity: true,
          executionComplexity: true,
          cycles: { select: { id: true } },
          assignments: {
            where: { status: { in: [...ACTIVE_OR_UAT] } },
            select: {
              id: true,
              status: true,
              testerId: true,
              phases: {
                select: { phase: true, startDate: true, endDate: true },
              },
              dailyRecords: {
                where: { date: { gte: periodStart, lte: periodEnd } },
                select: { date: true, designed: true, executed: true, defects: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export type LoadedProject = Awaited<ReturnType<typeof loadScopedProjects>>[number];
