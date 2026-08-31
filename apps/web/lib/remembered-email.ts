/**
 * Recuerda SOLO el correo del ultimo inicio de sesion.
 *
 * La contrasena nunca se persiste. Guardarla en `localStorage` la deja al
 * alcance de cualquier XSS y de quien use el equipo, y ninguna ofuscacion en
 * el cliente lo evita: la clave viajaria en el mismo bundle. De recordar la
 * contrasena se encarga el gestor del navegador (cifrado por el sistema
 * operativo y ligado al origen), que se activa gracias a los atributos
 * `name` / `autoComplete` del formulario de login.
 */

const STORAGE_KEY = "qaMetricsRememberedEmail";

/** Clave usada por la primera version, que guardaba solo el correo. */
const LEGACY_EMAIL_KEY = "rememberedEmail";

/** Clave de la version insegura que tambien guardaba la contrasena ofuscada. */
export const LEGACY_CREDENTIALS_KEY = "qaMetricsRememberedCredentials";

/** Subconjunto de `Storage` que necesitamos (facilita los tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Lee el correo recordado, migrando la clave legacy y purgando cualquier
 * contrasena que hubiera dejado la version anterior.
 */
export function loadRememberedEmail(storage: StorageLike | null | undefined): string | null {
  if (!storage) return null;
  try {
    storage.removeItem(LEGACY_CREDENTIALS_KEY);

    const stored = storage.getItem(STORAGE_KEY)?.trim();
    if (stored) {
      storage.removeItem(LEGACY_EMAIL_KEY);
      return stored;
    }

    const legacy = storage.getItem(LEGACY_EMAIL_KEY)?.trim();
    if (!legacy) return null;

    storage.setItem(STORAGE_KEY, legacy);
    storage.removeItem(LEGACY_EMAIL_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function saveRememberedEmail(
  storage: StorageLike | null | undefined,
  email: string
): void {
  if (!storage) return;
  const normalized = email.trim();
  if (!normalized) {
    clearRememberedEmail(storage);
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, normalized);
    storage.removeItem(LEGACY_EMAIL_KEY);
    storage.removeItem(LEGACY_CREDENTIALS_KEY);
  } catch {
    // Modo privado o cuota llena: recordar es opcional, no rompemos el login.
  }
}

export function clearRememberedEmail(storage: StorageLike | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(LEGACY_EMAIL_KEY);
    storage.removeItem(LEGACY_CREDENTIALS_KEY);
  } catch {
    // Ver comentario en saveRememberedEmail.
  }
}

/** `localStorage` cuando existe (cliente); `null` en SSR o si esta bloqueado. */
export function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
