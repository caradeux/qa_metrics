import { prisma } from "@qa-metrics/database";
import type { AuthRequest } from "../middleware/auth.js";

export function isClientPm(req: AuthRequest): boolean {
  return req.user?.role?.name === "CLIENT_PM";
}

export function isAnalyst(req: AuthRequest): boolean {
  return req.user?.role?.name === "QA_ANALYST";
}

export async function clientPmProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { projectManagerId: userId },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export async function analystProjectIds(userId: string): Promise<string[]> {
  const testers = await prisma.tester.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return [...new Set(testers.map((t) => t.projectId))];
}

/**
 * Devuelve un filtro Prisma `where` para Project que respeta el scope del usuario.
 * - ADMIN/QA_LEAD: proyectos donde su userId es el dueño del Client.
 * - QA_ANALYST: proyectos donde tiene un Tester vinculado.
 * - CLIENT_PM: proyectos donde es projectManager.
 */
export async function projectScopeFilter(req: AuthRequest): Promise<any> {
  if (isClientPm(req)) return { projectManagerId: req.user!.id };
  if (isAnalyst(req)) {
    return { testers: { some: { userId: req.user!.id } } };
  }
  return { client: { userId: req.user!.id } };
}
