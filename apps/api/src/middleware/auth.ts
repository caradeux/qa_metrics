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

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token no proporcionado" });
      return;
    }

    const token = authHeader.substring(7);
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

    req.user = {
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
