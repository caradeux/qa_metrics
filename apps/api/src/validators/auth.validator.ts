import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Password requerido"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token requerido"),
});
