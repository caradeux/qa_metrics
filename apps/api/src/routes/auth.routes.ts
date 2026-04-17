import { Router, Request, Response, NextFunction } from "express";
import { loginSchema } from "../validators/auth.validator.js";
import * as authService from "../services/auth.service.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "../lib/cookies.js";

const router = Router();

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
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
    const refreshToken =
      (req as any).cookies?.[REFRESH_COOKIE] ??
      (req.body && typeof req.body === "object" ? req.body.refreshToken : undefined);
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token requerido" });
      return;
    }
    const result = await authService.refreshAccessToken(refreshToken);
    setAuthCookies(res, result.accessToken);
    res.json({ ok: true });
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
      clearAuthCookies(res);
      res.json({ message: "Sesion cerrada" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/me",
  authMiddleware as any,
  (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  }
);

export default router;
