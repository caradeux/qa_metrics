import { prisma } from "@qa-metrics/database";
import type { AuthRequest } from "../middleware/auth.js";

export function isClientPm(req: AuthRequest): boolean {
  return req.user?.role?.name === "CLIENT_PM";
}

export async function clientPmProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { projectManagerId: userId },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}
