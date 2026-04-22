import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@qa-metrics/database";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
  role: {
    id: string;
    name: string;
    permissions: Array<{ resource: string; action: string }>;
  };
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Cache in-memory de (token → AuthUser) con TTL corto. Corta la query de
// User/Role/Permissions en cada request. Poner AUTH_CACHE_TTL_MS=0 lo apaga.
// Cambios de permisos/roles pueden tardar hasta TTL en reflejarse.
const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 15_000);
const AUTH_CACHE_MAX = 1000;
const authCache = new Map<string, { user: AuthUser; expiresAt: number }>();

function getCachedUser(token: string): AuthUser | undefined {
  if (AUTH_CACHE_TTL_MS <= 0) return undefined;
  const entry = authCache.get(token);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    authCache.delete(token);
    return undefined;
  }
  return entry.user;
}

function setCachedUser(token: string, user: AuthUser) {
  if (AUTH_CACHE_TTL_MS <= 0) return;
  if (authCache.size >= AUTH_CACHE_MAX) {
    // Purga entradas expiradas; si aún está lleno, elimina la más antigua (primera del Map).
    const now = Date.now();
    for (const [k, v] of authCache) {
      if (v.expiresAt < now) authCache.delete(k);
    }
    if (authCache.size >= AUTH_CACHE_MAX) {
      const firstKey = authCache.keys().next().value;
      if (firstKey) authCache.delete(firstKey);
    }
  }
  authCache.set(token, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

export function invalidateAuthCache(token?: string) {
  if (token) authCache.delete(token);
  else authCache.clear();
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const cookieToken = (req as any).cookies?.qa_access as string | undefined;
    const authHeader = req.headers.authorization;
    let token: string | undefined = cookieToken;
    if (!token && authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    if (!token) {
      res.status(401).json({ error: "Token no proporcionado" });
      return;
    }

    const cached = getCachedUser(token);
    if (cached) {
      req.user = cached;
      next();
      return;
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, active: true,
        role: {
          select: {
            id: true, name: true,
            permissions: {
              select: { permission: { select: { resource: true, action: true } } },
            },
          },
        },
      },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: "Usuario no encontrado o inactivo" });
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      active: user.active,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions.map((rp) => rp.permission),
      },
    };

    setCachedUser(token, authUser);
    req.user = authUser;

    next();
  } catch (error) {
    logger.debug({ error }, "Auth middleware error");
    res.status(401).json({ error: "Token invalido o expirado" });
  }
}

export function requirePermission(resource: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const perms = req.user?.role.permissions || [];
    if (!perms.some((p) => p.resource === resource && p.action === action)) {
      res.status(403).json({ error: "Sin permiso para esta accion" });
      return;
    }
    next();
  };
}
