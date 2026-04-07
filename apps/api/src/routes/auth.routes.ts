import { Router, Request, Response, NextFunction } from "express";
import { loginSchema, refreshSchema } from "../validators/auth.validator.js";
import * as authService from "../services/auth.service.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { logger } from "../middleware/logger.js";

const router = Router();

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof authService.AuthError) {
      res.status(401).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    if (error instanceof authService.AuthError) {
      res.status(401).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post(
  "/logout",
  authMiddleware as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }
      await authService.logout(req.user.id);
      res.json({ message: "Sesion cerrada" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
