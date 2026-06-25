import { z } from "zod";

// Trata variables de entorno vacías ("") como ausentes (undefined).
// Sin esto, un `ALERT_REPLY_TO=` vacío en .env falla la validación .email()
// y tumba el arranque de la API en un crash-loop.
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z.coerce.boolean().default(process.env.NODE_ENV === "production"),
  COOKIE_DOMAIN: z.string().optional(),

  // Alerts (optional — endpoint responds 503 if missing)
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ALERT_FROM_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  ALERT_REPLY_TO: z.preprocess(emptyToUndefined, z.string().email().optional()),
  INTERNAL_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  APP_URL: z.string().url().default("http://localhost:3000"),
  FLOWPILOT_BASE_URL: z
    .string()
    .url()
    .default("https://wap-asignacion-semanal-horas-qa.azurewebsites.net"),
});

export const env = envSchema.parse(process.env);
