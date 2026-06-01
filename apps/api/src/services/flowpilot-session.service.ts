import { prisma } from "@qa-metrics/database";
import { env } from "../config/env.js";
import { FlowpilotClient } from "../lib/flowpilot/client.js";
import type { FlowpilotSession } from "../lib/flowpilot/types.js";
import { getDecryptedPassword } from "./flowpilot-credential.service.js";

export const flowpilotClient = new FlowpilotClient(env.FLOWPILOT_BASE_URL);

export class FlowpilotNoCredentialError extends Error {}

// Inicia sesión en FlowPilot en nombre del usuario, usando su credencial cifrada.
export async function getSession(userId: string): Promise<FlowpilotSession> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const password = await getDecryptedPassword(userId);
  if (!user || !password) {
    throw new FlowpilotNoCredentialError("El usuario no tiene credencial de FlowPilot. Inicia sesión en qa_metrics para capturarla.");
  }
  return flowpilotClient.login(user.email, password);
}
