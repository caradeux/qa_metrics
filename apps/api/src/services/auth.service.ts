import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@qa-metrics/database";
import { env } from "../config/env.js";
import { logger } from "../middleware/logger.js";

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "8h" });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  });

  if (!user || !user.active) throw new AuthError("Credenciales invalidas");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AuthError("Credenciales invalidas");

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  const hashedRefresh = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashedRefresh },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions.map((rp) => ({
          resource: rp.permission.resource,
          action: rp.permission.action,
        })),
      },
    },
  };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, active: true, refreshToken: true },
    });

    if (!user || !user.active) throw new AuthError("Usuario no encontrado o inactivo");

    if (user.refreshToken) {
      const valid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!valid) throw new AuthError("Refresh token invalido");
    }

    const accessToken = generateAccessToken(user.id);
    return { accessToken };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Refresh token invalido o expirado");
  }
}

export async function logout(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
