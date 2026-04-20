# Granularidad de reportes (Ocupación y Conglomerado HU) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar `Ocupación` y `Conglomerado por HU` en recursos RBAC propios (`reports-occupation`, `reports-stories`), preservando acceso existente vía script idempotente.

**Architecture:** Dos recursos nuevos se agregan a la matriz de permisos. Los endpoints `/reports/occupation` y `/reports/story-breakdown` cambian su `requirePermission`. El frontend lista los nuevos recursos en la UI de roles y gatilla el sidebar por cada recurso independiente. Un script one-off migra roles existentes que ya tenían `reports:read`. El gating dual de Ocupación (`reports:read && activities:read`) se reemplaza por un único permiso dedicado.

**Tech Stack:** Express 5 + TypeScript (`requirePermission` middleware), Prisma 7 (upserts idempotentes), Next.js 16 + React 19 (matriz de permisos y Sidebar), PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-04-20-granularidad-reportes-design.md`

**Nota sobre testing:** Por decisión del spec, no se agregan tests automatizados para los guards (líneas declarativas, verificación tautológica). Cada tarea termina con verificación manual vía `curl` o browser en dev.

---

### Task 1: Cambiar guards en endpoints de backend

**Files:**
- Modify: `apps/api/src/routes/reports.routes.ts:840` (endpoint `/occupation`)
- Modify: `apps/api/src/routes/reports.routes.ts:894` (endpoint `/story-breakdown`)

- [ ] **Step 1: Modificar guard de `/occupation`**

En `apps/api/src/routes/reports.routes.ts` línea 840, cambiar:

```ts
  "/occupation",
  requirePermission("reports", "read") as any,
```

por:

```ts
  "/occupation",
  requirePermission("reports-occupation", "read") as any,
```

- [ ] **Step 2: Modificar guard de `/story-breakdown`**

En el mismo archivo, línea 894, cambiar:

```ts
  "/story-breakdown",
  requirePermission("reports", "read") as any,
```

por:

```ts
  "/story-breakdown",
  requirePermission("reports-stories", "read") as any,
```

- [ ] **Step 3: Verificar compilación TypeScript**

Run: `cd apps/api && npx tsc --noEmit`
Expected: sin errores de tipos (el string `"reports-occupation"` / `"reports-stories"` es aceptado porque `requirePermission` tipa `resource: string`).

- [ ] **Step 4: Verificar comportamiento en dev**

Requiere haber ejecutado antes Task 2 y Task 3 (seed o script aplicado) para que los permisos existan en la BD local. Si la BD local fue sembrada en fresh con el seed actualizado, el admin ya tendrá los permisos.

Temporalmente (solo para esta verificación, antes de continuar), aplicar Tasks 2 y 3 en paralelo o posponer este step hasta el final. Alternativa: correr manualmente en un prisma script:
```ts
await prisma.permission.createMany({ data: [
  { resource: "reports-occupation", action: "read" },
  { resource: "reports-stories", action: "read" },
], skipDuplicates: true });
```

Luego, con servidor dev corriendo, verificar:
```bash
# Login como admin primero para obtener cookie
curl -s http://localhost:4000/api/reports/story-breakdown?projectId=<id> \
  -b cookies.txt | head -c 200
```
Expected: JSON válido (200) si el rol ADMIN tiene `reports-stories:read` asignado; 403 si no.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/reports.routes.ts
git commit -m "feat(api): split reports guards into reports-occupation and reports-stories"
```

---

### Task 2: Actualizar seed con recursos y roles

**Files:**
- Modify: `packages/database/prisma/seed.ts` (array `resources` línea 90-100 + arrays de roles)

- [ ] **Step 1: Agregar los 2 recursos nuevos al array `resources`**

En `packages/database/prisma/seed.ts` línea 90-100, cambiar:

```ts
  const resources = [
    "users", "roles", "clients", "projects",
    "stories", "story-status", "cycles", "testers",
    "assignments", "phases",
    "records",
    "activities",
    "activity-categories",
    "dashboard", "gantt", "reports",
    "audit",
    "holidays",
  ];
```

por:

```ts
  const resources = [
    "users", "roles", "clients", "projects",
    "stories", "story-status", "cycles", "testers",
    "assignments", "phases",
    "records",
    "activities",
    "activity-categories",
    "dashboard", "gantt",
    "reports", "reports-occupation", "reports-stories",
    "audit",
    "holidays",
  ];
```

- [ ] **Step 2: Agregar recursos a `leadResources` (QA_LEAD)**

En la misma `seed.ts`, localizar el array `leadResources` (~línea 116):

```ts
const leadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "activities", "activity-categories", "reports"];
```

Cambiar a:

```ts
const leadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "activities", "activity-categories", "reports", "reports-occupation", "reports-stories"];
```

- [ ] **Step 3: Agregar recursos a `analystReadResources` (QA_ANALYST)**

Localizar el array `analystReadResources` (~línea 133):

```ts
const analystReadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "dashboard", "gantt", "reports", "audit", "holidays"];
```

Cambiar a:

```ts
const analystReadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "dashboard", "gantt", "reports", "reports-occupation", "reports-stories", "audit", "holidays"];
```

- [ ] **Step 4: Agregar recursos a `clientPmResources` (CLIENT_PM)**

Localizar el array `clientPmResources` (~línea 151):

```ts
const clientPmResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "activities", "activity-categories", "dashboard", "gantt", "reports"];
```

Cambiar a:

```ts
const clientPmResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "activities", "activity-categories", "dashboard", "gantt", "reports", "reports-occupation", "reports-stories"];
```

- [ ] **Step 5: Re-correr el seed en dev**

Run:
```bash
cd packages/database
npx prisma db seed
```
Expected: salida incluye "Categorías de actividad aseguradas" y termina sin errores. Los upserts son idempotentes; no se duplican filas.

- [ ] **Step 6: Verificar que los permisos quedaron asociados**

Run (en `packages/database` con el cliente Prisma disponible):
```bash
npx prisma studio
```
Abrir tabla `Permission` y filtrar por `resource = "reports-occupation"`. Expected: 4 filas (create/read/update/delete).

Abrir tabla `RolePermission` y cruzar: el rol ADMIN debe tener linked las 4, QA_LEAD las 4, QA_ANALYST solo `read`, CLIENT_PM solo `read`.

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat(seed): add reports-occupation and reports-stories RBAC resources"
```

---

### Task 3: Script one-off de migración para roles existentes

**Files:**
- Create: `packages/database/scripts/split-reports-permissions.ts`

- [ ] **Step 1: Crear el archivo del script**

Crear `packages/database/scripts/split-reports-permissions.ts` con el siguiente contenido completo:

```ts
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

// Split de reports en reports-occupation y reports-stories (2026-04-20).
// A todo rol que hoy tenga reports:read le damos también reports-occupation:read
// y reports-stories:read para preservar acceso.
const NEW_RESOURCES = ["reports-occupation", "reports-stories"] as const;
const ACTIONS = ["create", "read", "update", "delete"] as const;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function upsertPermission(resource: string, action: string) {
  return prisma.permission.upsert({
    where: { resource_action: { resource, action } },
    create: { resource, action },
    update: {},
  });
}

async function linkRolePermission(roleId: string, permissionId: string) {
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    create: { roleId, permissionId },
    update: {},
  });
}

async function main() {
  // 1. Asegurar que los 8 permisos nuevos existen como filas en Permission
  const perms: Record<string, { id: string }> = {};
  for (const resource of NEW_RESOURCES) {
    for (const action of ACTIONS) {
      perms[`${resource}:${action}`] = await upsertPermission(resource, action);
    }
  }
  console.log(`OK: ${NEW_RESOURCES.length * ACTIONS.length} filas Permission aseguradas.`);

  // 2. Encontrar todos los roles que hoy tengan reports:read
  const reportsReadPerm = await prisma.permission.findUnique({
    where: { resource_action: { resource: "reports", action: "read" } },
  });
  if (!reportsReadPerm) {
    console.log("No existe reports:read como fila Permission — nada que migrar.");
    return;
  }

  const rolesWithReportsRead = await prisma.rolePermission.findMany({
    where: { permissionId: reportsReadPerm.id },
    select: { roleId: true },
  });

  // 3. A cada uno agregar reports-occupation:read y reports-stories:read (idempotente)
  for (const { roleId } of rolesWithReportsRead) {
    await linkRolePermission(roleId, perms["reports-occupation:read"].id);
    await linkRolePermission(roleId, perms["reports-stories:read"].id);
  }

  console.log(
    `OK: ${rolesWithReportsRead.length} rol(es) con reports:read extendidos a reports-occupation:read + reports-stories:read.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ejecutar el script en dev**

Run:
```bash
cd packages/database
tsx scripts/split-reports-permissions.ts
```
Expected:
```
OK: 8 filas Permission aseguradas.
OK: N rol(es) con reports:read extendidos a reports-occupation:read + reports-stories:read.
```

- [ ] **Step 3: Ejecutar el script una segunda vez (verificar idempotencia)**

Run: `tsx scripts/split-reports-permissions.ts` nuevamente.
Expected: misma salida, sin errores, sin duplicados. Prisma Studio confirma que no se agregaron filas nuevas.

- [ ] **Step 4: Commit**

```bash
git add packages/database/scripts/split-reports-permissions.ts
git commit -m "feat(scripts): migrate existing roles with reports:read to new split resources"
```

---

### Task 4: Agregar recursos al frontend (matriz de permisos)

**Files:**
- Modify: `apps/web/lib/permissions.ts` (array `RESOURCES` + mapa `RESOURCE_LABELS`)

- [ ] **Step 1: Agregar los 2 recursos al array `RESOURCES`**

En `apps/web/lib/permissions.ts`, cambiar el array (líneas 1-20):

```ts
export const RESOURCES = [
  "users",
  "roles",
  "clients",
  "projects",
  "stories",
  "story-status",
  "cycles",
  "testers",
  "assignments",
  "phases",
  "records",
  "dashboard",
  "gantt",
  "reports",
  "audit",
  "holidays",
  "activities",
  "activity-categories",
] as const;
```

a:

```ts
export const RESOURCES = [
  "users",
  "roles",
  "clients",
  "projects",
  "stories",
  "story-status",
  "cycles",
  "testers",
  "assignments",
  "phases",
  "records",
  "dashboard",
  "gantt",
  "reports",
  "reports-occupation",
  "reports-stories",
  "audit",
  "holidays",
  "activities",
  "activity-categories",
] as const;
```

- [ ] **Step 2: Agregar labels al mapa `RESOURCE_LABELS`**

En el mismo archivo, cambiar el mapa `RESOURCE_LABELS` (líneas 27-46):

```ts
export const RESOURCE_LABELS: Record<Resource, string> = {
  users: "Usuarios",
  roles: "Roles",
  clients: "Clientes",
  projects: "Proyectos",
  stories: "Historias de Usuario",
  "story-status": "Cambio de Estado HU",
  cycles: "Ciclos",
  testers: "Testers",
  assignments: "Asignaciones",
  phases: "Fases de Ejecución",
  records: "Registros Diarios",
  dashboard: "Dashboard",
  gantt: "Planificación (Gantt)",
  reports: "Reportes",
  audit: "Auditoría de fechas",
  holidays: "Feriados",
  activities: "Actividades",
  "activity-categories": "Categorías de actividad",
};
```

a:

```ts
export const RESOURCE_LABELS: Record<Resource, string> = {
  users: "Usuarios",
  roles: "Roles",
  clients: "Clientes",
  projects: "Proyectos",
  stories: "Historias de Usuario",
  "story-status": "Cambio de Estado HU",
  cycles: "Ciclos",
  testers: "Testers",
  assignments: "Asignaciones",
  phases: "Fases de Ejecución",
  records: "Registros Diarios",
  dashboard: "Dashboard",
  gantt: "Planificación (Gantt)",
  reports: "Reportes",
  "reports-occupation": "Reporte de Ocupación",
  "reports-stories": "Reporte Conglomerado HU",
  audit: "Auditoría de fechas",
  holidays: "Feriados",
  activities: "Actividades",
  "activity-categories": "Categorías de actividad",
};
```

- [ ] **Step 3: Verificar tipo-check del frontend**

Run:
```bash
cd apps/web
npx tsc --noEmit
```
Expected: sin errores. Si hubiese, podría ser porque `Resource` se derivó de `RESOURCES` y el mapa requiere ambas claves nuevas (las agregamos en Step 2, así que debe compilar).

- [ ] **Step 4: Verificar visualmente en dev**

Levantar dev server (`npm run dev` desde raíz del monorepo), login como admin, navegar a `/settings/roles/<id_de_cualquier_rol>/edit`.
Expected: la matriz muestra 20 filas (antes 18). Dos filas nuevas visibles: "Reporte de Ocupación" y "Reporte Conglomerado HU", con 4 checkboxes cada una. Contador inferior dice "N de 80 permisos seleccionados" (antes 72).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/permissions.ts
git commit -m "feat(web): add reports-occupation and reports-stories to permissions matrix"
```

---

### Task 5: Actualizar gating del sidebar

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx:150-164`

- [ ] **Step 1: Reemplazar el bloque de reportes**

En `apps/web/components/layout/Sidebar.tsx`, reemplazar las líneas 150-164:

```tsx
    if (can("reports", "read")) {
      const reportItems: NavItem[] = [
        { label: "Por cliente", href: "/reports/client", icon: iconReport },
        { label: "Por tester", href: "/reports/testers", icon: iconUsers },
        { label: "Conglomerado por HU", href: "/reports/stories", icon: iconReport },
      ];
      if (can("activities", "read")) {
        reportItems.push({ label: "Ocupación", href: "/reports/occupation", icon: iconChartBar });
      }
      sections.push({
        key: "reportes",
        title: "Reportes",
        items: reportItems,
      });
    }
```

por:

```tsx
    if (can("reports", "read") || can("reports-occupation", "read") || can("reports-stories", "read")) {
      const reportItems: NavItem[] = [];
      if (can("reports", "read")) {
        reportItems.push({ label: "Por cliente", href: "/reports/client", icon: iconReport });
        reportItems.push({ label: "Por tester", href: "/reports/testers", icon: iconUsers });
      }
      if (can("reports-stories", "read")) {
        reportItems.push({ label: "Conglomerado por HU", href: "/reports/stories", icon: iconReport });
      }
      if (can("reports-occupation", "read")) {
        reportItems.push({ label: "Ocupación", href: "/reports/occupation", icon: iconChartBar });
      }
      if (reportItems.length > 0) {
        sections.push({
          key: "reportes",
          title: "Reportes",
          items: reportItems,
        });
      }
    }
```

- [ ] **Step 2: Verificar tipo-check**

Run:
```bash
cd apps/web
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 3: Verificar comportamiento en dev — caso ADMIN**

Login como `admin@qametrics.com`. En el sidebar debe aparecer la sección "Reportes" con los 4 ítems: Por cliente, Por tester, Conglomerado por HU, Ocupación. Hacer clic en cada uno y confirmar que la pantalla carga (ninguna 403).

- [ ] **Step 4: Verificar comportamiento — revocar `reports-stories:read`**

Como admin, entrar a `/settings/roles/<rol_ADMIN>/edit`, desmarcar solo `reports-stories:read`, guardar. Recargar sidebar (logout/login o hard refresh).
Expected: "Conglomerado por HU" desaparece del sidebar. "Por cliente", "Por tester" y "Ocupación" siguen visibles. Intentar acceder directamente a `/reports/stories` por URL: el endpoint `/api/reports/story-breakdown` responde 403 y la página muestra su estado de error.

Restaurar el permiso antes de continuar.

- [ ] **Step 5: Verificar comportamiento — rol sin `activities:read` pero con `reports-occupation:read`**

Con un rol custom o temporalmente en QA_LEAD: desmarcar `activities:read`, mantener `reports-occupation:read`.
Expected (post-cambio): "Ocupación" sigue visible en el sidebar. (Comportamiento pre-cambio: desaparecía por el `&& can("activities", "read")` eliminado.)

Restaurar el permiso antes de continuar.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx
git commit -m "feat(web): gate Ocupación and Conglomerado HU with dedicated permissions"
```

---

### Task 6: Deploy y verificación en producción

**Files:** ninguno (solo ejecución).

- [ ] **Step 1: Merge de la rama a `main`**

Crear PR con los 5 commits, revisión, merge. Coolify detecta el cambio y despliega automáticamente `apps/api` y `apps/web`.

- [ ] **Step 2: Ejecutar script de migración en producción**

Una vez desplegado, entrar al contenedor de `apps/api` en Coolify (o ejecutar remote con `docker exec`) y correr:

```bash
cd /app/packages/database
tsx scripts/split-reports-permissions.ts
```

Expected:
```
OK: 8 filas Permission aseguradas.
OK: N rol(es) con reports:read extendidos a reports-occupation:read + reports-stories:read.
```

- [ ] **Step 3: Verificar en browser — matriz actualizada**

Navegar a `https://qametrics.cl/settings/roles/<ADMIN_id>/edit`. Expected: 20 filas en matriz, 80 permisos totales, "Reporte de Ocupación" y "Reporte Conglomerado HU" con todas las acciones marcadas.

- [ ] **Step 4: Verificar en browser — QA_ANALYST conserva acceso**

Login como `ana.garcia@qametrics.com`. Expected: "Conglomerado por HU" y "Ocupación" siguen visibles en sidebar. Ambas páginas cargan datos.

- [ ] **Step 5: Verificación de regresión — revocar uno y confirmar aislamiento**

Como admin en prod, en un rol de prueba (por ejemplo el `cmnyub2oi0002cop3o5ipfaas` que está siendo editado), desmarcar `reports-stories:read` y guardar. Con un usuario asignado a ese rol, verificar que "Conglomerado por HU" desaparece y "Por cliente" sigue accesible.

Restaurar el permiso.

---

## Self-review

**Cobertura del spec**:
- Modelo de datos RBAC (Sección diseño) → Task 2 + Task 3 crean los Permission rows.
- Backend guards → Task 1.
- Seed → Task 2.
- Migración one-off → Task 3.
- Frontend permissions.ts → Task 4.
- Sidebar gating (sin `&& activities:read`) → Task 5.
- Plan deploy y verificación → Task 6.
- Riesgos (rol sin `reports:read`, ventana sin script, revocar aislado, CLIENT_PM) → cubiertos por Task 6 steps 3-5.

**Placeholders**: ninguno. Todos los paths, líneas y bloques de código están concretos.

**Consistencia de tipos**: `reports-occupation` y `reports-stories` (guión, no dot) se usan de forma idéntica en tareas 1, 2, 3, 4, 5. Labels "Reporte de Ocupación" / "Reporte Conglomerado HU" consistentes.

**Observación Task 1 Step 4**: la verificación manual del backend depende de que los permisos existan en BD. Se aclara la alternativa (prisma script temporal o posponer al final). Esto es una dependencia real del mundo físico, no un gap del plan.
