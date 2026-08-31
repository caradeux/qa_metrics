import { describe, test, expect } from "vitest";
import {
  LEGACY_CREDENTIALS_KEY,
  clearRememberedEmail,
  loadRememberedEmail,
  saveRememberedEmail,
  type StorageLike,
} from "../remembered-email";

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe("saveRememberedEmail / loadRememberedEmail", () => {
  test("recuerda el correo entre sesiones", () => {
    // Arrange
    const storage = fakeStorage();

    // Act
    saveRememberedEmail(storage, "admin@qametrics.com");

    // Assert
    expect(loadRememberedEmail(storage)).toBe("admin@qametrics.com");
  });

  test("normaliza espacios alrededor del correo", () => {
    const storage = fakeStorage();
    saveRememberedEmail(storage, "  admin@qametrics.com  ");
    expect(loadRememberedEmail(storage)).toBe("admin@qametrics.com");
  });

  test("un correo vacio borra lo recordado en vez de guardar basura", () => {
    // Arrange
    const storage = fakeStorage();
    saveRememberedEmail(storage, "admin@qametrics.com");

    // Act
    saveRememberedEmail(storage, "   ");

    // Assert
    expect(loadRememberedEmail(storage)).toBeNull();
  });

  test("devuelve null cuando no hay nada guardado", () => {
    expect(loadRememberedEmail(fakeStorage())).toBeNull();
  });

  test("devuelve null cuando no hay storage disponible (SSR)", () => {
    expect(loadRememberedEmail(null)).toBeNull();
  });
});

describe("migracion de formatos anteriores", () => {
  test("migra la clave legacy que solo guardaba el correo", () => {
    // Arrange
    const storage = fakeStorage({ rememberedEmail: "viejo@qametrics.com" });

    // Act
    const loaded = loadRememberedEmail(storage);

    // Assert
    expect(loaded).toBe("viejo@qametrics.com");
    expect(storage.data.rememberedEmail).toBeUndefined();
  });

  test("elimina el blob antiguo que incluia la contrasena", () => {
    // Arrange: valor dejado por la version insegura de esta utilidad
    const storage = fakeStorage({ [LEGACY_CREDENTIALS_KEY]: "eyJwYXNzd29yZCI6ICJzZWNyZXRhIn0=" });

    // Act
    loadRememberedEmail(storage);

    // Assert
    expect(storage.data[LEGACY_CREDENTIALS_KEY]).toBeUndefined();
  });
});

describe("clearRememberedEmail", () => {
  test("no deja ninguna clave detras", () => {
    // Arrange
    const storage = fakeStorage({
      rememberedEmail: "viejo@qametrics.com",
      [LEGACY_CREDENTIALS_KEY]: "loQueSea",
    });
    saveRememberedEmail(storage, "admin@qametrics.com");

    // Act
    clearRememberedEmail(storage);

    // Assert
    expect(loadRememberedEmail(storage)).toBeNull();
    expect(Object.keys(storage.data)).toHaveLength(0);
  });
});

describe("resiliencia del storage", () => {
  test("no lanza cuando setItem falla (modo privado / cuota llena)", () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(() => saveRememberedEmail(storage, "a@b.com")).not.toThrow();
  });

  test("no lanza cuando getItem falla", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadRememberedEmail(storage)).toBeNull();
  });
});
