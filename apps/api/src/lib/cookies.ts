import type { Response } from "express";
import { env } from "../config/env.js";

const ACCESS_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7d

export const ACCESS_COOKIE = "qa_access";
export const REFRESH_COOKIE = "qa_refresh";

export function setAuthCookies(res: Response, accessToken: string, refreshToken?: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_MS,
  });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: REFRESH_MAX_AGE_MS,
    });
  }
}

export function clearAuthCookies(res: Response) {
  res.cookie(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookie(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
  });
}
