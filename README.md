# QA Metrics

Sistema web full-stack para el seguimiento de métricas de calidad de software en consultoras QA. Centraliza clientes, proyectos, historias de usuario, ciclos de testing y asignaciones; visualiza KPIs, planificación Gantt y reportes para presentar al cliente.

**Repo**: https://github.com/caradeux/qa_metrics

---

## Features principales

- **Multi-cliente / multi-proyecto** con jerarquía Cliente → Proyecto → HU → Ciclo → Asignación.
- **Workflow QA completo** con 10 estados: `Inicio → Análisis → Diseño → Esperando Ambientación QA → Ejecución → Devuelto a Dev → Espera UAT → UAT → Producción → Detenido`. Cada cambio queda registrado en `AssignmentStatusLog`.
- **Fases planificables por asignación de Ciclo 1** (Análisis / Diseño / Ejecución) con distribución automática de días hábiles.
- **Ciclos de regresión** (Ciclo 2+) con tester preseleccionado del ciclo anterior.
- **Registro diario por HU** — matriz tester × día con 3 métricas (Diseñados, Ejecutados, Bugs) gateada por fechas de asignación, feriados chilenos y días hábiles (L-V).
- **Gantt global** con agrupación tester→HU, línea de hoy, feriados, filtros por cliente/proyecto/tester/estado.
- **Dashboard por cliente** con KPIs (Diseñados, Ejecutados, Defectos, Tasa de Rechazo, Lead Time entre ciclos) + desglose por proyecto y Lead Time por estado (detecta cuellos de botella).
- **Reporte cliente mensual/semanal** con 8 gráficos + tabla de analistas, exportable a PDF vía `window.print()`.
- **RBAC de 4 roles**: `ADMIN`, `QA_LEAD`, `QA_ANALYST`, `CLIENT_PM`. Cada uno con vista filtrada automáticamente.
- **Dedicación compartida** del tester entre proyectos (50% / 100%) con validación de capacidad (opcional sobre-asignación por usuario).
- **Auth con cookies HttpOnly + Secure + SameSite** (access 8h + refresh 7d), refresh transparente.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Monorepo | Turbo 2 |
| Frontend | Next.js 16.2.3 (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4 |
| Backend | Express 5 + TypeScript + tsx watch |
| ORM | Prisma 7 con PostgreSQL |
| Gráficas | Recharts |
| Validación | Zod |
| Auth | JWT + bcrypt + cookies HttpOnly + cookie-parser |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Fechas | date-fns con soporte de feriados CL |

---

## Estructura

```
qa-metrics/
├─ apps/
│  ├─ api/                 # Express API (puerto 4000)
│  │  ├─ src/
│  │  │  ├─ routes/        # Endpoints REST
│  │  │  ├─ middleware/    # auth, logger, permissions
│  │  │  ├─ services/      # metrics, auth, excel, reports
│  │  │  ├─ validators/    # Zod schemas
│  │  │  └─ lib/           # access, cookies, workdays
│  │  └─ __tests__/
│  └─ web/                 # Next.js 16 (puerto 3000)
│     ├─ app/
│     │  ├─ (auth)/login/
│     │  └─ (app)/         # Rutas autenticadas
│     ├─ components/       # dashboard, gantt, records, stories, ui
│     ├─ hooks/            # useAuth, usePermissions, useHolidays
│     ├─ lib/              # api-client
│     └─ e2e/              # Playwright specs
├─ packages/
│  ├─ database/            # Prisma schema + migrations + scripts
│  │  ├─ prisma/
│  │  ├─ scripts/          # export-snapshot, import-snapshot, clean-data
│  │  └─ src/              # holidays-cl-2026
│  ├─ types/
│  └─ utils/               # crypto, week-utils
├─ deploy/                 # COOLIFY.md, docker-compose, snapshots
└─ docs/                   # security-audit, test-run, specs, plans
```

---

## Quick start local

### Requisitos

- Node.js ≥ 22
- PostgreSQL 16
- npm (workspaces)

### Instalación

```bash
git clone https://github.com/caradeux/qa_metrics.git
cd qa_metrics
npm install
```

### Variables de entorno

Crear `apps/api/.env`:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:root@localhost:5432/qa_metrics?schema=public
JWT_SECRET=genera_con_openssl_rand_base64_32
JWT_REFRESH_SECRET=genera_con_openssl_rand_base64_32
ENCRYPTION_KEY=genera_con_openssl_rand_base64_32
CORS_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
```

Y `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Base de datos

```bash
cd packages/database
npx prisma migrate deploy
npx prisma generate
```

Si es un entorno nuevo, poblar con el snapshot incluido (preserva usuarios, clientes y proyectos reales):

```bash
npx tsx scripts/import-snapshot.ts ../../deploy/snapshots/snapshot-latest.json
```

O bien usar el seed básico:

```bash
NODE_ENV=seed npx prisma db seed
```

### Levantar en dev

Desde la raíz:

```bash
npm run dev
```

API en `:4000` y Web en `:3000`.

---

## Usuarios incluidos en el snapshot

Passwords: `QaMetrics2024!` para los de `@qametrics.com`, `Inovabiz.2026` para los de `@inovabiz.com`, custom para Alex.

| Email | Nombre | Rol |
|---|---|---|
| `jcaradeux@inovabiz.com` | Jose Caradeux | ADMIN |
| `admin@qametrics.com` | Carlos Mendez | ADMIN |
| `b.benardis@inovabiz.com` | Braulio Benardis | QA_ANALYST |
| `rgarcia@inovabiz.com` | Renato Garcia | QA_ANALYST |
| `jflores@inovabiz.com` | Jose Flores | QA_ANALYST |
| `demo@demo.cl` | Alex Zuñiga | CLIENT_PM |
| `j.ruz@inovabiz.com` | Juan Ruz | CLIENT_PM |
| `j.collao@inovabiz.com` | Jorge Collao | CLIENT_PM |
| `m.larrondo@inovabiz.com` | Mauricio Larrondo | CLIENT_PM |

---

## Modelo de datos

```
Client ─┬─ Project ─┬─ Tester (userId → User)
        │           │     └─ DailyRecord (por assignmentId, por día)
        │           ├─ UserStory ─┬─ TestCycle
        │           │              └─ TesterAssignment ─┬─ AssignmentPhase (Ciclo 1)
        │           │                                   └─ AssignmentStatusLog
        │           └─ ProjectManager (User con rol CLIENT_PM)
        └─ owner: User con rol ADMIN/QA_LEAD

Role ── Permission (resource × action) — RBAC
Holiday — feriados legales de Chile
```

---

## Despliegue a Coolify

Detalle completo en [`deploy/COOLIFY.md`](deploy/COOLIFY.md). Resumen:

1. **Postgres** en Coolify, anotar `DATABASE_URL`.
2. **API** (`apps/api/Dockerfile`):
   - Env: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGIN=https://web.dominio`, `COOKIE_SECURE=true`.
   - Build: `npx prisma migrate deploy`.
   - (Opcional) cargar snapshot: `npx tsx scripts/import-snapshot.ts deploy/snapshots/snapshot-latest.json`.
3. **Web** (`apps/web/Dockerfile`):
   - Env: `NEXT_PUBLIC_API_URL=https://api.dominio`.
4. **HTTPS obligatorio** — las cookies `Secure` no viajan por HTTP.

---

## Scripts útiles

| Comando | Uso |
|---|---|
| `npm run dev` | Monorepo en dev |
| `npm run build` | Build producción |
| `npm run test` | Tests en todos los paquetes |
| `npm run lint` | Lint global |
| `npx tsx packages/database/scripts/export-snapshot.ts` | Exporta toda la DB a JSON |
| `npx tsx packages/database/scripts/import-snapshot.ts <file>` | Importa snapshot (idempotente, upsert) |
| `npx tsx packages/database/scripts/clean-data.ts` | Limpia data transaccional conservando users/roles |

---

## Seguridad

Auditoría completa en [`docs/security-audit-2026-04-14.md`](docs/security-audit-2026-04-14.md).

### Implementado

- ✅ Passwords bcrypt cost 12.
- ✅ JWT access (8h) + refresh (7d) con rotación en DB.
- ✅ **Cookies HttpOnly + Secure + SameSite=Lax** — sin tokens en `localStorage`.
- ✅ CORS con `origin` fijo y `credentials: true`.
- ✅ RBAC + scope por propiedad (analyst ve solo sus proyectos; client_pm solo los que gestiona).
- ✅ Validación Zod en todos los body/query críticos.
- ✅ Prisma ORM (sin `$queryRaw`).
- ✅ Tokens PAT de Azure DevOps cifrados con AES-256-GCM.
- ✅ Next.js actualizado a 16.2.3 (fix CVE DoS).

### Pendientes antes de producción abierta

- ⚠️ Rate limiting (no hay).
- ⚠️ Helmet / security headers.
- ⚠️ Estrategia de backups automatizados de Postgres.
- ⚠️ Centralizar credenciales de tests + seed determinístico.

---

## Estado de testing

Reporte en [`docs/test-run-2026-04-14.md`](docs/test-run-2026-04-14.md).

- **API vitest**: 8 passed / 10 failed (credenciales hardcoded desactualizadas — fixable).
- **E2E Playwright**: `99-full-smoke.spec.ts` valida rutas por rol. Smoke de analista pasa.
- **Gaps conocidos**: sin tests para Gantt, fases de asignación, reportes, sync ADO.

---

## Roadmap corto plazo

- [ ] Stepper visual de estados (reemplazar combobox de estado inicial).
- [ ] Integración Azure DevOps (pull de HUs y resultados de ejecución).
- [ ] Export PDF del reporte mensual con Puppeteer (hoy vía `window.print()`).
- [ ] Rate limiting + Helmet.
- [ ] Centralizar credenciales en tests y seed determinístico.

---

## Licencia

Propietario. InovaBiz 2026.
