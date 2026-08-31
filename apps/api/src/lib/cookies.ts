import type { Response } from "express";
import { env } from "../config/env.js";
import { ACCESS_MAX_AGE_MS, refreshMaxAgeMs } from "./session-ttl.js";

export const ACCESS_COOKIE = "qa_access";
export const REFRESH_COOKIE = "qa_refresh";

/**
 * `rememberMe` viene de la casilla "Mantener sesion iniciada" del login y solo
 * alarga la cookie de refresh; el access sigue durando 8h en ambos casos.
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string,
  rememberMe = false
) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    path: "/",
    maxAge: ACCESS_MAX_AGE_MS,
  });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: refreshMaxAgeMs(rememberMe),
    });
  }
}

export function clearAuthCookies(res: Response) {
  res.cookie(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    path: "/",
    maxAge: 0,
  });
  res.cookie(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    path: "/api/auth",
    maxAge: 0,
  });
}
