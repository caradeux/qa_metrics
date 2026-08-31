/**
 * Duracion de la sesion segun si el usuario marco "Mantener sesion iniciada".
 *
 * Vive aparte de `cookies.ts` para poder testearse sin cargar la config de
 * entorno, y para que el TTL del JWT y el `maxAge` de la cookie se definan en
 * un solo lugar: si se desincronizan, el navegador conserva una cookie con un
 * token ya expirado (o al reves) y el usuario ve deslogueos aleatorios.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const ACCESS_MAX_AGE_MS = 8 * HOUR_MS;

/** Sesion normal: una semana. */
export const REFRESH_DAYS = 7 as const;
/** Sesion con "mantener iniciada": un trimestre. */
export const REFRESH_REMEMBER_DAYS = 90 as const;

/** `maxAge` de la cookie de refresh, en milisegundos. */
export function refreshMaxAgeMs(rememberMe: boolean): number {
  return (rememberMe ? REFRESH_REMEMBER_DAYS : REFRESH_DAYS) * DAY_MS;
}

/**
 * `expiresIn` del JWT de refresh. El tipo es literal porque `jsonwebtoken`
 * rechaza un `string` generico en esa opcion.
 */
export type RefreshTtl = `${typeof REFRESH_DAYS}d` | `${typeof REFRESH_REMEMBER_DAYS}d`;

export function refreshTtl(rememberMe: boolean): RefreshTtl {
  return rememberMe ? `${REFRESH_REMEMBER_DAYS}d` : `${REFRESH_DAYS}d`;
}
