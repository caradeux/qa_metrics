import { describe, test, expect } from "vitest";
import {
  REFRESH_DAYS,
  REFRESH_REMEMBER_DAYS,
  refreshMaxAgeMs,
  refreshTtl,
} from "../lib/session-ttl.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("duracion de la sesion de refresh", () => {
  test("sin 'mantener sesion iniciada' dura una semana", () => {
    expect(refreshMaxAgeMs(false)).toBe(7 * DAY_MS);
    expect(refreshTtl(false)).toBe("7d");
  });

  test("con 'mantener sesion iniciada' dura 90 dias", () => {
    expect(refreshMaxAgeMs(true)).toBe(90 * DAY_MS);
    expect(refreshTtl(true)).toBe("90d");
  });

  test("marcar la opcion siempre alarga, nunca acorta la sesion", () => {
    expect(refreshMaxAgeMs(true)).toBeGreaterThan(refreshMaxAgeMs(false));
  });
});

describe("cookie y token expiran juntos", () => {
  // Si el maxAge de la cookie y el expiresIn del JWT se desincronizan, el
  // usuario sufre deslogueos que no se explican por nada visible.
  test.each([
    ["sesion normal", false, REFRESH_DAYS],
    ["sesion recordada", true, REFRESH_REMEMBER_DAYS],
  ])("%s: %s dias en cookie y en token", (_caso, rememberMe, dias) => {
    expect(refreshMaxAgeMs(rememberMe as boolean)).toBe((dias as number) * DAY_MS);
    expect(refreshTtl(rememberMe as boolean)).toBe(`${dias}d`);
  });
});
