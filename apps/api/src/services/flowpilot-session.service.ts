import { prisma } from "@qa-metrics/database";
import { env } from "../config/env.js";
import { FlowpilotClient } from "../lib/flowpilot/client.js";
import type { FlowpilotSession } from "../lib/flowpilot/types.js";
import { getDecryptedPassword } from "./flowpilot-credential.service.js";

const SETTING_ID = "singleton";

export class FlowpilotNoCredentialError extends Error {}

// URL base efectiva: la configurada en BD (editable por admin) o, si no existe,
// el fallback FLOWPILOT_BASE_URL del entorno.
export async function getBaseUrl(): Promise<string> {
  const s = await prisma.flowpilotSetting.findUnique({ where: { id: SETTING_ID } });
  return s?.baseUrl?.trim() || env.FLOWPILOT_BASE_URL;
}

export async function setBaseUrl(baseUrl: string): Promise<void> {
  await prisma.flowpilotSetting.upsert({
    where: { id: SETTING_ID },
    create: { id: SETTING_ID, baseUrl },
    update: { baseUrl },
  });
}

export const ENV_BASE_URL = env.FLOWPILOT_BASE_URL;

// Construye un cliente apuntando a la URL efectiva actual.
export async function buildClient(): Promise<FlowpilotClient> {
  return new FlowpilotClient(await getBaseUrl());
}

// Inicia sesión en FlowPilot en nombre del usuario (credencial cifrada) y
// devuelve el cliente + la sesión (mismo host, consistentes entre sí).
export async function getSession(
  userId: string,
): Promise<{ client: FlowpilotClient; session: FlowpilotSession }> {
  const client = await buildClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const password = await getDecryptedPassword(userId);
  if (!user || !password) {
    throw new FlowpilotNoCredentialError("El usuario no tiene credencial de FlowPilot. Inicia sesión en qa_metrics para capturarla.");
  }
  const session = await client.login(user.email, password);
  return { client, session };
}
