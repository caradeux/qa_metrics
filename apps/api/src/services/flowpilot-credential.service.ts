import { encrypt, decrypt } from "@qa-metrics/utils";
import { prisma } from "@qa-metrics/database";

export function encryptPassword(plain: string): string {
  return encrypt(plain);
}
export function decryptPassword(enc: string): string {
  return decrypt(enc);
}

// Roles que cargan/gestionan horas en FlowPilot (capturan credencial al login).
// ADMIN/QA_LEAD la necesitan para usar el proxy de catálogos en la homologación.
const FLOWPILOT_CAPTURE_ROLES = new Set(["QA_ANALYST", "QA_LEAD", "ADMIN"]);

export async function captureCredentialOnLogin(
  userId: string, roleName: string, plainPassword: string,
): Promise<void> {
  if (!FLOWPILOT_CAPTURE_ROLES.has(roleName)) return;
  const passwordEnc = encrypt(plainPassword);
  await prisma.flowpilotCredential.upsert({
    where: { userId },
    create: { userId, passwordEnc },
    update: { passwordEnc },
  });
}

// Guarda/actualiza explícitamente la credencial FlowPilot de un usuario
// (flujo "Conectar con FlowPilot", independiente del login de qa_metrics).
export async function setCredential(userId: string, plainPassword: string): Promise<void> {
  const passwordEnc = encrypt(plainPassword);
  await prisma.flowpilotCredential.upsert({
    where: { userId },
    create: { userId, passwordEnc },
    update: { passwordEnc },
  });
}

export async function getDecryptedPassword(userId: string): Promise<string | null> {
  const cred = await prisma.flowpilotCredential.findUnique({ where: { userId } });
  return cred ? decrypt(cred.passwordEnc) : null;
}
