import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z.coerce.boolean().default(process.env.NODE_ENV === "production"),
});

export const env = envSchema.parse(process.env);
