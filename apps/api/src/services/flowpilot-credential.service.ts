import { encrypt, decrypt } from "@qa-metrics/utils";
import { prisma } from "@qa-metrics/database";

export function encryptPassword(plain: string): string {
  return encrypt(plain);
}
export function decryptPassword(enc: string): string {
  return decrypt(enc);
}

// Roles que cargan horas en FlowPilot (capturan credencial al login).
const HOUR_LOGGING_ROLES = new Set(["QA_ANALYST"]);

export async function captureCredentialOnLogin(
  userId: string, roleName: string, plainPassword: string,
): Promise<void> {
  if (!HOUR_LOGGING_ROLES.has(roleName)) return;
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
