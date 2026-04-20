# Granularidad de permisos en reportes — Ocupación y Conglomerado HU

**Fecha**: 2026-04-20
**Estado**: Diseño aprobado, pendiente de plan de implementación.

## Contexto

Hoy el recurso `reports` en la matriz RBAC controla como bloque las 4 pantallas de `/reports/*`:

- `/reports/client` — Por cliente
- `/reports/testers` — Por tester
- `/reports/stories` — Conglomerado por HU
- `/reports/occupation` — Ocupación

Un admin que quiere dar acceso a "Por cliente" pero no a "Ocupación" no puede expresarlo — `reports:read` es todo o nada. Adicionalmente, el sidebar gatilla "Ocupación" con `can("reports","read") && can("activities","read")` como workaround, lo cual es confuso.

## Objetivo

Separar los dos reportes nombrados por el usuario (`Ocupación`, `Conglomerado por HU`) en recursos propios dentro de la matriz de permisos, manteniendo el resto sin cambios.

## Alcance (decidido)

- **Incluye**: crear los recursos `reports-occupation` y `reports-stories`; conservar `reports` para "Por cliente" y "Por tester"; migrar roles existentes en prod; limpiar el gating dual de Ocupación.
- **No incluye**: separar "Por cliente"/"Por tester" en recursos propios; granularidad por dashboard; tests unitarios de los guards; refactorizar la UI de la matriz.

## Diseño

### Modelo de datos RBAC

Se agregan dos recursos nuevos siguiendo la convención de guión existente (`story-status`, `activity-categories`):

| Resource key | Label UI (RESOURCE_LABELS) | Ruta UI | Endpoint backend |
|---|---|---|---|
| `reports-occupation` | "Reporte de Ocupación" | `/reports/occupation` | `GET /reports/occupation` |
| `reports-stories` | "Reporte Conglomerado HU" | `/reports/stories` | `GET /reports/story-breakdown` |

El recurso `reports` se conserva sin cambios; sigue gobernando `/reports/client` y `/reports/testers`.

Cada recurso nuevo tiene las 4 acciones estándar (`create/read/update/delete`) por consistencia con el resto de la matriz, aunque solo `read` produce efecto real (los reportes son solo lectura).

### Cambios backend (`apps/api/src/routes`)

| Archivo | Endpoint | `requirePermission` antes | `requirePermission` después |
|---|---|---|---|
| `reports.routes.ts` | `GET /reports/story-breakdown` | `reports:read` | `reports-stories:read` |
| `metrics.routes.ts` | `GET /reports/occupation` | `reports:read` | `reports-occupation:read` |

(Si durante implementación se detecta que uno de los endpoints vive en otro archivo, se ajusta sin afectar el diseño.)

### Cambios en el seed (`packages/database/prisma/seed.ts`)

1. **Array `resources`** (línea ~90): agregar `"reports-occupation"` y `"reports-stories"`. El doble loop existente genera automáticamente 8 permisos nuevos (2 recursos × 4 acciones).

2. **Asignación a roles del sistema**:
   - `ADMIN`: ya recibe todos los permisos por el loop genérico. Sin cambios.
   - `QA_LEAD`: agregar los 2 recursos al array `leadResources` (quedan con las 4 acciones cada uno).
   - `QA_ANALYST`: agregar `reports-occupation` y `reports-stories` al array `analystReadResources` (solo `read`).
   - `CLIENT_PM`: agregar los 2 recursos al array `clientPmResources` (solo `read`).

El seed es idempotente y sigue bloqueado en `NODE_ENV=production`.

### Script de migración one-off (`packages/database/scripts/split-reports-permissions.ts`)

Para cada rol que hoy tenga `reports:read` en BD, asegurar que también tenga `reports-occupation:read` y `reports-stories:read` (upsert idempotente). Patrón: mismo estilo que `add-client-pm-role.ts` o equivalentes en `scripts/`. Se corre post-deploy en prod via Coolify exec.

El script **solo agrega** permisos, nunca revoca. Se puede correr múltiples veces sin efecto acumulativo.

### Cambios frontend (`apps/web`)

**`lib/permissions.ts`**: agregar al array `RESOURCES` y al mapa `RESOURCE_LABELS`, justo después de `"reports"` para que las 3 filas aparezcan contiguas en la matriz:

```ts
"reports-occupation",   // "Reporte de Ocupación"
"reports-stories",      // "Reporte Conglomerado HU"
```

**`components/layout/Sidebar.tsx` (bloque de reportes, ~líneas 150-164)**:

```ts
if (can("reports", "read") || can("reports-occupation", "read") || can("reports-stories", "read")) {
  const reportItems: NavItem[] = [];
  if (can("reports", "read")) {
    reportItems.push({ label: "Por cliente",  href: "/reports/client",  icon: iconReport });
    reportItems.push({ label: "Por tester",   href: "/reports/testers", icon: iconUsers });
  }
  if (can("reports-stories", "read")) {
    reportItems.push({ label: "Conglomerado por HU", href: "/reports/stories", icon: iconReport });
  }
  if (can("reports-occupation", "read")) {
    reportItems.push({ label: "Ocupación", href: "/reports/occupation", icon: iconChartBar });
  }
  if (reportItems.length > 0) sections.push({ key: "reportes", title: "Reportes", items: reportItems });
}
```

Se elimina el `&& can("activities", "read")` del gating de Ocupación (decisión: si el admin otorgó `reports-occupation:read`, ya expresó la intención; exigir `activities:read` adicional sería redundante).

**Páginas de reporte (`/reports/stories/page.tsx`, `/reports/occupation/page.tsx`)**: si hacen chequeo cliente con `usePermissions`, actualizar al nuevo recurso correspondiente. Verificar durante implementación.

## Plan de deploy

1. **Release única** que incluya: backend (cambio de guards), frontend (RESOURCES + Sidebar), seed (array actualizado), script de migración. Razón: desplegar por separado genera ventanas donde el botón aparece sin endpoint o el endpoint rechaza sin UI.

2. **Post-deploy en prod (Coolify)**: ejecutar `tsx packages/database/scripts/split-reports-permissions.ts`. Idempotente, seguro de re-correr.

3. **Verificación browser en qametrics.cl**:
   - `/settings/roles/<ADMIN>/edit`: confirmar 2 filas nuevas con todas las acciones marcadas.
   - `/settings/roles/<QA_ANALYST>/edit`: confirmar `reports-occupation:read` y `reports-stories:read` marcados.
   - Login como `ana.garcia@qametrics.com`: confirmar que "Ocupación" y "Conglomerado por HU" siguen visibles en el sidebar.
   - Probar revocar `reports-stories:read` a un rol custom y confirmar desaparición selectiva sin afectar "Por cliente".

**Rollback**: el script no tiene contrapartida destructiva. Si algo falla, se revierte el deploy — los permisos nuevos quedan huérfanos en BD pero no rompen nada (código viejo no los consulta).

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Rol custom sin `reports:read` pierde sub-reportes. | Aceptado: si el admin no le dio acceso, no le damos sub-reportes sin su consentimiento. |
| Ventana < 1 min entre deploy y ejecución del script donde un rol tiene `reports:read` pero no los nuevos. | Correr el script inmediatamente post-deploy. Alternativa considerada: integrarlo al entrypoint de `apps/api`. |
| Revocar `reports-occupation:read` afecta sidebar pero no otros módulos. | Sin impacto: el recurso `activities` es independiente y sigue cubriendo `/settings/activity-categories` y mutaciones propias del tester. |
| CLIENT_PM del seed recibe los 2 recursos nuevos y "ve más". | Sin regresión: hoy ya ve esos reportes vía `reports:read`. Post-cambio sigue viéndolos. |

## Invariantes respetados

- Nunca se escribe en Azure DevOps.
- Seed idempotente y bloqueado en producción.
- Modalidad de proyecto intacta.
- Tokens ADO intactos (no se tocan).
- `CLIENT_PM` sigue estrictamente read-only dentro de su scope.

## Testing

No se agregan tests automatizados para este cambio. Los guards de Express son líneas declarativas (`requirePermission("X","read")`); un test unitario verificaría el literal del string, lo cual es tautológico. La verificación real es el paso 3 del plan de deploy (browser en prod).

## Decisiones registradas (trazabilidad)

- **Alcance de granularidad**: opción C — solo Ocupación y Conglomerado, no los 4 reportes.
- **Migración**: opción A — script que extiende `reports:read` → agrega los nuevos.
- **Gating de Ocupación**: opción A — solo `reports-occupation:read`, se elimina el `&& activities:read`.
- **Naming**: convención `reports-<sub>` con guión, consistente con `story-status` y `activity-categories`.
