# Asociación analista↔cliente, especialidades y asignación sin tope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir asignar analistas de QA sin que el % de ocupación lo bloquee, asociar cada analista a uno o varios clientes (filtro estricto al asignar), y registrar especialidades informativas que consolidan `isAutomation`.

**Architecture:** Relación M2M implícita de Prisma `User.assignedClients ↔ Client.analysts` (distinta del dueño `Client.userId`). Array de enum Postgres `Specialty` en `User`. El backend deja de filtrar/bloquear por capacidad y agrega validación estricta de asociación al crear testers. El frontend gestiona clientes y especialidades en la ficha del usuario y filtra los dropdowns de asignación por cliente.

**Tech Stack:** Prisma + PostgreSQL, Express 5 (TypeScript/tsx), Vitest (tests de integración contra server corriendo), Next.js 16 (App Router, React 19).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-06-25-asociacion-analista-cliente-especialidades-design.md`.
- Enum de especialidades: exactamente `QA_MANUAL`, `QA_AUTOMATION`, `PERFORMANCE`.
- `specialties` es la fuente de verdad; al guardar usuario se setea `isAutomation = specialties.includes("QA_AUTOMATION")`.
- Filtro por cliente **estricto**: el backend rechaza con `400` asignar un analista no asociado al cliente del proyecto.
- El % de ocupación es **solo informativo**: nunca oculta ni bloquea (ni en el GET de usuarios ni en el POST de testers).
- La vista propia del analista **no se modifica** (ya está acotada a sus proyectos).
- Tests de integración requieren: Postgres dev arriba (`docker-compose.dev.yml`), `apps/api` corriendo en `http://localhost:4000`, y DB sembrada (`npm run db:seed` en `packages/database`). Password de login en tests: `QaMetrics2024!`.

---

### Task 1: Schema Prisma — enum Specialty, campo specialties, M2M AnalystClients, migración + backfill + seed

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (modelo `User` ~líneas 39-60, modelo `Client` ~líneas 62-71)
- Create: `packages/database/prisma/migrations/<timestamp>_analyst_client_specialties/migration.sql` (generado por Prisma; se le agrega el backfill)
- Modify: `packages/database/prisma/seed.ts` (asociar un analista a un cliente + especialidad, para tests deterministas)

**Interfaces:**
- Produces: enum `Specialty { QA_MANUAL | QA_AUTOMATION | PERFORMANCE }`; `User.specialties: Specialty[]`; relación `User.assignedClients: Client[]` ↔ `Client.analysts: User[]` (relación `"AnalystClients"`). Estos nombres los consumen las Tasks 2-6.

- [ ] **Step 1: Agregar el enum y los campos al schema**

En `packages/database/prisma/schema.prisma`, agregar el enum cerca de los otros enums (o al final del archivo):

```prisma
enum Specialty {
  QA_MANUAL
  QA_AUTOMATION
  PERFORMANCE
}
```

En el modelo `User`, agregar (junto a `isAutomation`):

```prisma
  specialties     Specialty[] @default([])
  assignedClients Client[]    @relation("AnalystClients")
```

En el modelo `Client`, agregar (debajo de `projects Project[]`):

```prisma
  analysts  User[]    @relation("AnalystClients")
```

- [ ] **Step 2: Generar la migración**

Run: `cd packages/database && npx prisma migrate dev --name analyst_client_specialties --create-only`
Expected: crea la carpeta de migración con `migration.sql` (no la aplica todavía por `--create-only`).

- [ ] **Step 3: Agregar el backfill al final del migration.sql generado**

Abrir el `migration.sql` recién creado y agregar al final:

```sql
-- Backfill: los analistas marcados como automatización reciben la especialidad QA_AUTOMATION
UPDATE "User" SET "specialties" = ARRAY['QA_AUTOMATION']::"Specialty"[] WHERE "isAutomation" = true;
```

- [ ] **Step 4: Aplicar la migración y regenerar el client**

Run: `cd packages/database && npx prisma migrate dev` then `npx prisma generate`
Expected: la migración aplica sin error y `@qa-metrics/database` expone `Specialty` y las nuevas relaciones.

- [ ] **Step 5: Sembrar datos de asociación para tests**

En `packages/database/prisma/seed.ts`, después de que existan los clientes y los analistas (buscar `ensureClient` y el upsert de `ana.garcia@qametrics.com`), asociar `ana.garcia` al primer cliente sembrado y darle especialidad `QA_MANUAL`. Ejemplo (ajustar al nombre real del primer cliente del seed):

```ts
// Asociar Ana Garcia a un cliente concreto para tests del filtro estricto
const primerCliente = await prisma.client.findFirst({ orderBy: { name: "asc" } });
if (primerCliente) {
  await prisma.user.update({
    where: { email: "ana.garcia@qametrics.com" },
    data: {
      specialties: ["QA_MANUAL"],
      assignedClients: { set: [{ id: primerCliente.id }] },
    },
  });
}
```

- [ ] **Step 6: Re-sembrar y verificar**

Run: `cd packages/database && npm run db:seed`
Expected: termina sin error. Verificar con:
Run: `cd packages/database && npx prisma studio` (opcional) o un one-liner:
`node --env-file=../../apps/api/.env -e "import('@qa-metrics/database').then(async({prisma})=>{const u=await prisma.user.findUnique({where:{email:'ana.garcia@qametrics.com'},include:{assignedClients:true}});console.log(u.specialties,u.assignedClients.map(c=>c.name));process.exit(0)})"`
Expected: imprime `[ 'QA_MANUAL' ] [ '<nombre cliente>' ]`.

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations packages/database/prisma/seed.ts
git commit -m "feat(db): Specialty enum, specialties y M2M analista-cliente + backfill"
```

---

### Task 2: Backend GET /api/users — incluir asociaciones/especialidades, filtro ?clientId, quitar filtro por capacidad

**Files:**
- Modify: `apps/api/src/routes/users.routes.ts:13-58` (handler `GET /`)
- Test: `apps/api/src/__tests__/users-list.test.ts` (crear)

**Interfaces:**
- Consumes: relaciones de Task 1.
- Produces: `GET /api/users` devuelve por usuario `{ ...user, specialties: Specialty[], assignedClients: {id,name}[], allocationUsed: number, allocationAvailable: number }`. Acepta `?role=` y `?clientId=`. Nunca excluye por capacidad.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/src/__tests__/users-list.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("GET /api/users — asociaciones y filtro por cliente", () => {
  it("incluye specialties y assignedClients", async () => {
    const token = await loginAs("admin@qametrics.com");
    const res = await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const users = await res.json();
    const ana = users.find((u: any) => u.email === "ana.garcia@qametrics.com");
    expect(ana).toBeTruthy();
    expect(Array.isArray(ana.specialties)).toBe(true);
    expect(ana.specialties).toContain("QA_MANUAL");
    expect(Array.isArray(ana.assignedClients)).toBe(true);
    expect(ana.assignedClients.length).toBeGreaterThan(0);
  });

  it("?clientId filtra solo analistas asociados a ese cliente", async () => {
    const token = await loginAs("admin@qametrics.com");
    const all = await (await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const ana = all.find((u: any) => u.email === "ana.garcia@qametrics.com");
    const clientId = ana.assignedClients[0].id;
    const res = await fetch(`${API_URL}/api/users?role=QA_ANALYST&clientId=${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const filtered = await res.json();
    expect(filtered.every((u: any) => u.assignedClients.some((c: any) => c.id === clientId))).toBe(true);
    expect(filtered.find((u: any) => u.email === "ana.garcia@qametrics.com")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd apps/api && npx vitest run src/__tests__/users-list.test.ts`
Expected: FAIL (la respuesta no tiene `specialties`/`assignedClients`, y `?clientId` no filtra).

- [ ] **Step 3: Implementar el cambio en el handler GET /**

Reemplazar el cuerpo del handler `GET /` (`apps/api/src/routes/users.routes.ts:13-58`) por:

```ts
router.get("/", requirePermission("users", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const roleFilter = req.query.role as string | undefined;
    const clientId = req.query.clientId as string | undefined;
    const where: any = {};
    if (roleFilter) where.role = { name: roleFilter };
    if (clientId) where.assignedClients = { some: { id: clientId } };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        allowOverallocation: true,
        isAutomation: true,
        specialties: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
        assignedClients: { select: { id: true, name: true } },
        testers: {
          select: {
            allocation: true,
            assignments: {
              where: { status: { in: [...ACTIVE_STATUSES] } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const result = users.map(u => {
      const used = u.testers.reduce(
        (sum, t) => sum + (t.assignments.length > 0 ? t.allocation : 0),
        0
      );
      const available = u.allowOverallocation ? 100 : Math.max(0, 100 - used);
      const { testers, ...rest } = u;
      return { ...rest, allocationUsed: used, allocationAvailable: available };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});
```

Nota: se eliminó por completo el manejo de `minCapacity` y el `.filter(...)`. La capacidad se sigue devolviendo como info.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd apps/api && npx vitest run src/__tests__/users-list.test.ts`
Expected: PASS (ambos tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/users.routes.ts apps/api/src/__tests__/users-list.test.ts
git commit -m "feat(api): GET /users incluye asociaciones/especialidades y filtro ?clientId; sin filtro por capacidad"
```

---

### Task 3: Backend POST/PUT /api/users — persistir specialties (sync isAutomation) y set de assignedClients

**Files:**
- Modify: `apps/api/src/validators/user.validator.ts` (ambos schemas)
- Modify: `apps/api/src/routes/users.routes.ts` (handlers `POST /` y `PUT /:id`)
- Test: `apps/api/src/__tests__/users-update.test.ts` (crear)

**Interfaces:**
- Consumes: enum `Specialty` de `@qa-metrics/database`.
- Produces: `PUT /api/users/:id` acepta `{ specialties?: Specialty[], clientIds?: string[] }`. Setea `isAutomation` derivado y reemplaza la asociación de clientes.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/src/__tests__/users-update.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getUserByEmail(token: string, email: string) {
  const users = await (await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  return users.find((u: any) => u.email === email);
}

describe("PUT /api/users/:id — especialidades y clientes", () => {
  it("guardar QA_AUTOMATION setea isAutomation=true", async () => {
    const token = await loginAs("admin@qametrics.com");
    const luis = await getUserByEmail(token, "luis.torres@qametrics.com");
    const res = await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ specialties: ["QA_AUTOMATION", "PERFORMANCE"] }),
    });
    expect(res.status).toBe(200);
    const updated = await getUserByEmail(token, "luis.torres@qametrics.com");
    expect(updated.specialties).toContain("QA_AUTOMATION");
    expect(updated.isAutomation).toBe(true);
  });

  it("clientIds reemplaza la asociación de clientes", async () => {
    const token = await loginAs("admin@qametrics.com");
    const clients = await (await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const targetClientId = clients[0].id;
    const luis = await getUserByEmail(token, "luis.torres@qametrics.com");
    const res = await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: [targetClientId] }),
    });
    expect(res.status).toBe(200);
    const updated = await getUserByEmail(token, "luis.torres@qametrics.com");
    expect(updated.assignedClients.map((c: any) => c.id)).toEqual([targetClientId]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd apps/api && npx vitest run src/__tests__/users-update.test.ts`
Expected: FAIL (los campos no se persisten).

- [ ] **Step 3: Actualizar el validador**

Reemplazar `apps/api/src/validators/user.validator.ts` por:

```ts
import { z } from "zod";

const specialtyEnum = z.enum(["QA_MANUAL", "QA_AUTOMATION", "PERFORMANCE"]);

export const createUserSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(8, "Password debe tener al menos 8 caracteres"),
  name: z.string().min(1, "Nombre requerido").max(200),
  roleId: z.string().min(1, "Rol requerido"),
  specialties: z.array(specialtyEnum).optional(),
  clientIds: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email("Email invalido").optional(),
  password: z.string().min(8, "Password debe tener al menos 8 caracteres").optional(),
  name: z.string().min(1).max(200).optional(),
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  specialties: z.array(specialtyEnum).optional(),
  clientIds: z.array(z.string()).optional(),
});
```

- [ ] **Step 4: Persistir en POST y PUT**

En `apps/api/src/routes/users.routes.ts`, en el handler `POST /`, dentro del `prisma.user.create({ data: { ... } })`, agregar (después de `roleId: data.roleId,`):

```ts
        specialties: data.specialties ?? [],
        isAutomation: (data.specialties ?? []).includes("QA_AUTOMATION"),
        ...(data.clientIds ? { assignedClients: { connect: data.clientIds.map(id => ({ id })) } } : {}),
```

(Quitar la línea previa `isAutomation: data.isAutomation ?? false,`.)

En el handler `PUT /:id`, reemplazar la construcción de `updateData` y el `update` por:

```ts
    const updateData: Record<string, any> = { ...data };
    delete updateData.clientIds;
    delete updateData.specialties;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }
    if (data.specialties !== undefined) {
      updateData.specialties = data.specialties;
      updateData.isAutomation = data.specialties.includes("QA_AUTOMATION");
    }
    if (data.clientIds !== undefined) {
      updateData.assignedClients = { set: data.clientIds.map(id => ({ id })) };
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, name: true, active: true,
        isAutomation: true, specialties: true, createdAt: true,
        role: { select: { id: true, name: true } },
        assignedClients: { select: { id: true, name: true } },
      },
    });
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `cd apps/api && npx vitest run src/__tests__/users-update.test.ts`
Expected: PASS (ambos tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/validators/user.validator.ts apps/api/src/routes/users.routes.ts apps/api/src/__tests__/users-update.test.ts
git commit -m "feat(api): POST/PUT /users guarda especialidades (sync isAutomation) y asociación de clientes"
```

---

### Task 4: Backend POST /api/testers — quitar bloqueo por capacidad y validar asociación estricta

**Files:**
- Modify: `apps/api/src/routes/testers.routes.ts:114-181` (handler `POST /`)
- Test: `apps/api/src/__tests__/testers-create-association.test.ts` (crear)

**Interfaces:**
- Consumes: relación `assignedClients` de Task 1; `Project.clientId`.
- Produces: `POST /api/testers` ya no devuelve `409` por capacidad; devuelve `400` "El analista no está asociado a este cliente" si el `userId` no está asociado al cliente del proyecto.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/src/__tests__/testers-create-association.test.ts`. El admin crea un proyecto en un cliente al que `luis.torres` NO está asociado y verifica el rechazo; luego asocia y verifica el éxito. (Usa endpoints existentes de clients/projects.)

```ts
import { describe, it, expect } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getUser(token: string, email: string) {
  const users = await (await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  return users.find((u: any) => u.email === email);
}

describe("POST /api/testers — asociación estricta y sin tope de capacidad", () => {
  it("rechaza 400 si el analista no está asociado al cliente", async () => {
    const token = await loginAs("admin@qametrics.com");
    const clients = await (await fetch(`${API_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } })).json();
    // cliente al que luis NO está asociado: tomar uno y asegurarse de desasociarlo
    const luis = await getUser(token, "luis.torres@qametrics.com");
    const targetClient = clients[0];
    await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: [] }),
    });
    const projects = await (await fetch(`${API_URL}/api/projects?clientId=${targetClient.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const projectId = projects[0].id;
    const res = await fetch(`${API_URL}/api/testers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Luis Torres", projectId, userId: luis.id, allocation: 100 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/asociado/i);
  });

  it("permite asignar aunque el analista ya esté al 100% (sin tope) si está asociado", async () => {
    const token = await loginAs("admin@qametrics.com");
    const clients = await (await fetch(`${API_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const targetClient = clients[0];
    const luis = await getUser(token, "luis.torres@qametrics.com");
    await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: [targetClient.id] }),
    });
    const projects = await (await fetch(`${API_URL}/api/projects?clientId=${targetClient.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    // elegir un proyecto donde luis no sea aún tester
    const projectId = projects[projects.length - 1].id;
    const res = await fetch(`${API_URL}/api/testers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Luis Torres", projectId, userId: luis.id, allocation: 100 }),
    });
    // 201 creado, o 409 solo si "ya está asignado a este proyecto" (no por capacidad)
    if (res.status === 409) {
      const body = await res.json();
      expect(body.error).toMatch(/ya está asignado/i);
    } else {
      expect(res.status).toBe(201);
    }
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd apps/api && npx vitest run src/__tests__/testers-create-association.test.ts`
Expected: FAIL — el primer test no recibe 400 (no hay validación de asociación); el segundo puede fallar con 409 por capacidad.

- [ ] **Step 3: Modificar el handler POST de testers**

En `apps/api/src/routes/testers.routes.ts`, dentro del bloque `if (data.userId) { ... }` (líneas ~128-163):

1. Reemplazar el `include` de la búsqueda del user para traer la asociación al cliente del proyecto. Cambiar el `prisma.user.findUnique` por:

```ts
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        include: {
          role: true,
          assignedClients: { where: { id: project.clientId }, select: { id: true } },
          testers: { select: { projectId: true } },
        },
      });
```

2. Después de las validaciones de existencia/rol y de "ya asignado a este proyecto", **agregar** la validación de asociación estricta y **eliminar** el bloque de capacidad (`if (!user.allowOverallocation) { ... 409 ... }`). El bloque resultante queda:

```ts
      if (!user) { res.status(400).json({ error: "Usuario no encontrado" }); return; }
      if (user.role.name !== "QA_ANALYST") { res.status(400).json({ error: "El usuario debe tener rol QA_ANALYST" }); return; }
      if (user.testers.some(t => t.projectId === data.projectId)) {
        res.status(409).json({ error: "Ese usuario ya está asignado a este proyecto" });
        return;
      }
      if (user.assignedClients.length === 0) {
        res.status(400).json({ error: "El analista no está asociado a este cliente" });
        return;
      }
```

(Notar que `requestedAllocation` se sigue usando para `prisma.tester.create`, pero ya no se valida contra un tope.)

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd apps/api && npx vitest run src/__tests__/testers-create-association.test.ts`
Expected: PASS (ambos tests).

- [ ] **Step 5: Correr toda la suite de la API para no romper nada**

Run: `cd apps/api && npx vitest run`
Expected: PASS (revisar especialmente cualquier test previo que esperara el 409 por capacidad; si existe, actualizarlo a la nueva conducta).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/testers.routes.ts apps/api/src/__tests__/testers-create-association.test.ts
git commit -m "feat(api): testers POST valida asociación estricta y elimina tope por capacidad"
```

---

### Task 5: Frontend — ficha de Usuario: multi-select de clientes + checks de especialidades

**Files:**
- Modify: `apps/web/app/(app)/users/[id]/edit/page.tsx`
- Modify: `apps/web/app/(app)/users/new/page.tsx`

**Interfaces:**
- Consumes: `GET /api/users` (devuelve `specialties`, `assignedClients`), `GET /api/clients`, `PUT/POST /api/users` (aceptan `specialties`, `clientIds`).

- [ ] **Step 1: Editar la ficha de edición de usuario**

En `apps/web/app/(app)/users/[id]/edit/page.tsx`:

1. Ampliar la interfaz `User` y agregar tipos:

```ts
interface ClientOpt { id: string; name: string }
type Specialty = "QA_MANUAL" | "QA_AUTOMATION" | "PERFORMANCE";
const SPECIALTIES: { value: Specialty; label: string }[] = [
  { value: "QA_MANUAL", label: "QA Manual" },
  { value: "QA_AUTOMATION", label: "QA Automatizado" },
  { value: "PERFORMANCE", label: "Performance" },
];
interface User { id: string; email: string; name: string; role: Role | string | null; specialties?: Specialty[]; assignedClients?: ClientOpt[] }
```

2. Reemplazar el estado `isAutomation` por estado de especialidades y clientes:

```ts
const [specialties, setSpecialties] = useState<Specialty[]>([]);
const [clients, setClients] = useState<ClientOpt[]>([]);
const [clientIds, setClientIds] = useState<string[]>([]);
```

3. En el `useEffect`, añadir `apiClient<ClientOpt[]>("/api/clients")` al `Promise.all`, y al encontrar el usuario:

```ts
setSpecialties(u.specialties ?? []);
setClientIds((u.assignedClients ?? []).map((c) => c.id));
```

4. En `handleSubmit`, cambiar el body del PUT a:

```ts
body: JSON.stringify({
  name, email, roleId,
  ...(roleName === "QA_ANALYST" ? { specialties, clientIds } : { specialties: [], clientIds: [] }),
}),
```

5. Reemplazar el bloque del checkbox `isAutomation` (solo visible para `QA_ANALYST`) por un bloque de checkboxes de especialidades y un multi-select de clientes:

```tsx
{roleName === "QA_ANALYST" && (
  <>
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Especialidades</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {SPECIALTIES.map((s) => {
          const active = specialties.includes(s.value);
          return (
            <label key={s.value} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${active ? "border-[#2E5FA3] bg-[#2E5FA3]/5" : "border-gray-200"}`}>
              <input type="checkbox" checked={active} className="h-4 w-4 accent-[#1F3864]"
                onChange={(e) => setSpecialties((prev) => e.target.checked ? [...prev, s.value] : prev.filter((x) => x !== s.value))} />
              <span className="text-sm text-foreground">{s.label}</span>
            </label>
          );
        })}
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Clientes asociados</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-auto p-1">
        {clients.map((c) => {
          const active = clientIds.includes(c.id);
          return (
            <label key={c.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${active ? "border-[#2E5FA3] bg-[#2E5FA3]/5" : "border-gray-200"}`}>
              <input type="checkbox" checked={active} className="h-4 w-4 accent-[#1F3864]"
                onChange={(e) => setClientIds((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))} />
              <span className="text-sm text-foreground">{c.name}</span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 mt-1">El analista solo podrá ser asignado a proyectos de los clientes seleccionados.</p>
    </div>
  </>
)}
```

- [ ] **Step 2: Aplicar el mismo bloque en la ficha de creación**

Replicar los cambios equivalentes en `apps/web/app/(app)/users/new/page.tsx` (estado de `specialties`/`clientIds`, carga de `/api/clients`, bloque de checkboxes para rol `QA_ANALYST`, y `specialties`/`clientIds` en el body del POST).

- [ ] **Step 3: Verificar build/typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores de tipos.

- [ ] **Step 4: Verificación manual**

Con `apps/api` y `apps/web` corriendo: editar un analista, marcar especialidades y clientes, guardar; reabrir la ficha y confirmar que quedaron persistidos.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/users/\[id\]/edit/page.tsx apps/web/app/\(app\)/users/new/page.tsx
git commit -m "feat(web): ficha de usuario con especialidades y clientes asociados"
```

---

### Task 6: Frontend — filtrar asignación por cliente y mostrar etiquetas de especialidad

**Files:**
- Modify: `apps/web/app/(app)/projects/page.tsx:53` (asignación rápida)
- Modify: `apps/web/app/(app)/projects/[id]/testers/new/page.tsx` (carga de analistas)

**Interfaces:**
- Consumes: `GET /api/users?role=QA_ANALYST&clientId=<id>`; `Project.client.id`.

- [ ] **Step 1: Asignación rápida filtra por cliente del proyecto**

En `apps/web/app/(app)/projects/page.tsx`, en `openQuick` (línea ~53), reemplazar:

```ts
apiClient<AnalystOpt[]>(`/api/users?role=QA_ANALYST&minCapacity=50`).then(setAnalysts).catch(() => setAnalysts([]));
```

por:

```ts
apiClient<AnalystOpt[]>(`/api/users?role=QA_ANALYST&clientId=${project.client.id}`).then(setAnalysts).catch(() => setAnalysts([]));
```

(El objeto `project` ya está disponible en `openQuick`; `project.client.id` existe en la interfaz `Project`.)

- [ ] **Step 2: Nuevo Tester filtra por el cliente del proyecto**

En `apps/web/app/(app)/projects/[id]/testers/new/page.tsx`, la página hoy solo tiene `projectId`. Obtener el proyecto para conocer su cliente y filtrar:

```ts
useEffect(() => {
  apiClient<{ client: { id: string } }>(`/api/projects/${projectId}`)
    .then((p) =>
      apiClient<AnalystUser[]>(`/api/users?role=QA_ANALYST&clientId=${p.client.id}`)
        .then(setAnalysts)
    )
    .catch(() => setAnalysts([]));
}, [projectId]);
```

(Reemplaza el `useEffect` actual que llama a `/api/users?role=QA_ANALYST` sin filtro.)

- [ ] **Step 3: Mostrar especialidades como etiquetas (informativo)**

En el dropdown/listado de analistas de ambas páginas, si el analista trae `specialties`, mostrarlas como texto corto junto al nombre. Ejemplo mínimo en la opción del `<select>` de `testers/new`:

```tsx
{a.name} ({a.email}){a.specialties?.length ? ` · ${a.specialties.join(", ")}` : ""}{overflow}
```

(Agregar `specialties?: string[]` a la interfaz `AnalystUser`/`AnalystOpt` correspondiente.)

- [ ] **Step 4: Verificar typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Con todo corriendo: en `/projects`, abrir asignación rápida de un proyecto del cliente X → solo aparecen analistas asociados a X, incluidos los que están al 100%. Asignar uno al 100% → se crea sin bloqueo. Intentar (vía la página) un proyecto de otro cliente → no aparece el analista no asociado.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(app\)/projects/page.tsx apps/web/app/\(app\)/projects/\[id\]/testers/new/page.tsx
git commit -m "feat(web): asignación filtra analistas por cliente y muestra especialidades"
```

---

## Self-Review

- **Cobertura del spec:** modelo de datos (Task 1), GET con asociaciones/especialidades + sin filtro de capacidad (Task 2), POST/PUT persistencia + sync isAutomation (Task 3), regla estricta + sin tope en testers (Task 4), ficha de usuario (Task 5), filtros de asignación + tags (Task 6). El bloqueo por capacidad del POST de testers —no contemplado explícitamente en el spec original— se cubre en Task 4 (coherente con "el % no bloquea").
- **Sin placeholders:** cada paso trae código o comando concreto.
- **Consistencia de tipos:** `Specialty` con valores `QA_MANUAL|QA_AUTOMATION|PERFORMANCE` en DB, validador y frontend; `assignedClients: {id,name}[]` y `clientIds: string[]` consistentes entre Tasks 2/3/5/6.
- **Prerrequisito de tests:** ver Global Constraints (DB dev arriba, API corriendo, seed aplicado).
