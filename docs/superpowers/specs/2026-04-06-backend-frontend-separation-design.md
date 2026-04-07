i# Spec: Separacion Backend/Frontend - QA Metrics

**Fecha:** 2026-04-06
**Estado:** Aprobado
**Autor:** Claude + Jose Caradeux

---

## Contexto

QA Metrics es un monolito Next.js 16 con API Routes, Prisma 7 y PostgreSQL. Se necesita separar backend de frontend para:
- Escalar a 20-100 usuarios concurrentes
- Soportar multi-rol (equipo QA + clientes externos con vista limitada)
- Deploy en nube (AWS/Azure/GCP) con escalamiento independiente
- Permisos dinamicos configurables por el administrador

## Arquitectura: Turborepo Monorepo

```
qa-metrics/
├── apps/
│   ├── web/          ← Next.js (solo frontend, SSR/CSR)
│   └── api/          ← Express + Prisma (backend REST)
├── packages/
│   ├── database/     ← Prisma schema + client (compartido)
│   ├── types/        ← TypeScript types compartidos
│   └── utils/        ← Funciones compartidas (metrics, week-utils, crypto)
├── turbo.json
└── package.json
```

### Justificacion

- Re-usa ~80% del codigo actual (mover, no reescribir)
- Tipos compartidos entre front y back evitan duplicacion
- Un solo repo, mas facil de mantener para equipo pequeno
- Deploy independiente: front y back escalan por separado
- Migracion gradual (APIs se mueven una por una)

---

## apps/web (Frontend)

**Stack:** Next.js 16, TypeScript, Tailwind CSS, Recharts

**Responsabilidades:**
- Renderizar UI (SSR para SEO/performance, CSR para interactividad)
- Gestionar estado del cliente (auth tokens, filtros, forms)
- Llamar al backend via HTTP REST

**Cambios clave vs monolito actual:**
- Eliminar `app/api/` completamente
- Nuevo `lib/api-client.ts`: wrapper de fetch que apunta al backend
- Nuevo `hooks/useAuth.ts`: maneja JWT tokens (login, refresh, logout)
- Nuevo `hooks/useFetch.ts`: fetch con auth automatica, retry, error handling
- Nuevo `middleware/permissions.tsx`: componente que oculta UI segun permisos del usuario

**api-client.ts (concepto):**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL; // ej: https://api.qametrics.com

async function apiClient(path: string, options?: RequestInit) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { await refreshToken(); return apiClient(path, options); }
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

---

## apps/api (Backend)

**Stack:** Express.js, TypeScript, Prisma 7, PostgreSQL, JWT (jsonwebtoken)

**Estructura:**
```
api/src/
├── index.ts                 ← Entry point, Express app
├── config/
│   └── env.ts               ← Variables de entorno validadas con Zod
├── middleware/
│   ├── auth.ts              ← Verificar JWT, extraer user
│   ├── permissions.ts       ← Guard dinamico: requirePermission(resource, action)
│   ├── rate-limit.ts        ← Rate limiting por IP/usuario
│   ├── error-handler.ts     ← Catch-all de errores, respuesta estandar
│   └── logger.ts            ← Logging estructurado (pino)
├── routes/
│   ├── auth.routes.ts       ← login, refresh, logout
│   ├── users.routes.ts
│   ├── roles.routes.ts      ← CRUD de roles + permisos
│   ├── clients.routes.ts
│   ├── projects.routes.ts
│   ├── cycles.routes.ts
│   ├── testers.routes.ts
│   ├── records.routes.ts
│   ├── assignments.routes.ts
│   ├── metrics.routes.ts
│   └── reports.routes.ts
├── controllers/             ← Request/Response handling
├── services/                ← Logica de negocio pura
│   ├── auth.service.ts
│   ├── metrics.service.ts
│   ├── records.service.ts
│   └── reports.service.ts
└── validators/              ← Schemas Zod por endpoint
    ├── auth.validator.ts
    ├── client.validator.ts
    └── ...
```

**Patron: Route → Controller → Service → Prisma**
- Route: define endpoint + middleware (auth, permisos, validacion)
- Controller: parsea request, llama service, retorna response
- Service: logica de negocio pura (testeable sin HTTP)
- Prisma: acceso a BD

---

## Autenticacion: JWT con Refresh Tokens

**Login:**
```
POST /api/auth/login { email, password }
→ Verifica bcrypt
→ Genera accessToken (15min) + refreshToken (7d)
→ Almacena refreshToken hasheado en BD
→ Retorna { accessToken, refreshToken, user: { id, name, email, role, permissions } }
```

**Refresh:**
```
POST /api/auth/refresh { refreshToken }
→ Verifica refreshToken contra BD
→ Genera nuevo accessToken
→ Retorna { accessToken }
```

**Logout:**
```
POST /api/auth/logout
→ Elimina refreshToken de BD
```

**Nuevo campo en modelo User:** `refreshToken String?` (hasheado)

---

## Permisos Dinamicos (RBAC)

### Modelo de datos

```prisma
model Role {
  id          String       @id @default(cuid())
  name        String       @unique
  description String?
  isSystem    Boolean      @default(false)  // Roles del sistema no se pueden eliminar
  users       User[]
  permissions RolePermission[]
  createdAt   DateTime     @default(now())
}

model Permission {
  id       String           @id @default(cuid())
  resource String           // "clients", "projects", "records", etc.
  action   String           // "create", "read", "update", "delete"
  roles    RolePermission[]
  @@unique([resource, action])
}

model RolePermission {
  id           String     @id @default(cuid())
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@unique([roleId, permissionId])
}

model User {
  // ... campos existentes
  roleId       String
  role         Role      @relation(fields: [roleId], references: [id])
  refreshToken String?
}
```

### Middleware de permisos

```typescript
function requirePermission(resource: string, action: string) {
  return async (req, res, next) => {
    const permissions = req.user.role.permissions;
    const hasPermission = permissions.some(
      p => p.permission.resource === resource && p.permission.action === action
    );
    if (!hasPermission) return res.status(403).json({ error: "Sin permiso" });
    next();
  };
}
```

### Seed de permisos iniciales

**Resources:** users, roles, clients, projects, cycles, testers, records, assignments, dashboard, reports

**Actions por resource:** create, read, update, delete

**Roles iniciales (isSystem=true):**
- **Administrador:** todos los permisos
- **Jefe QA:** todo excepto users y roles
- **Analista QA:** read en la mayoria, create/update en records y assignments
- **Cliente:** solo read en dashboard y reports de sus proyectos

### UI de gestion de roles

Pagina `/settings/roles` (solo ADMIN):
- Lista de roles con cantidad de usuarios
- Modal crear/editar rol con matriz de checkboxes (resource x action)
- Roles del sistema (isSystem=true) no se pueden eliminar, pero si editar permisos

---

## packages/database

```
database/
├── prisma/
│   ├── schema.prisma      ← Schema completo (migrado del monolito)
│   ├── migrations/
│   └── seed.ts
├── src/
│   └── index.ts           ← Export: prisma client, types de Prisma
├── package.json
└── tsconfig.json
```

Se importa en apps/api como:
```typescript
import { prisma, User, Project } from "@qa-metrics/database";
```

---

## packages/types

```typescript
// Tipos compartidos entre frontend y backend

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: { name: string; permissions: PermissionInfo[] };
}

export interface PermissionInfo {
  resource: string;
  action: string;
}

export interface ApiError {
  error: string;
  status: number;
}

// ... tipos para cada entidad
```

---

## packages/utils

Migra directamente del monolito:
- `metrics.ts` — calculateKPIs, aggregateWeeklyTrend, etc.
- `week-utils.ts` — getMonday, isMonday, etc.
- `crypto.ts` — encrypt, decrypt AES-256-GCM

---

## Deploy en Azure

```
                    ┌─────────────────┐
                    │  Azure Front    │
                    │  Door (CDN)     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
    ┌─────────┴─────────┐       ┌──────────┴──────────┐
    │  Azure App Service│       │  Azure App Service  │
    │  apps/web         │       │  apps/api           │
    │  (Next.js SSR)    │       │  (Express)          │
    │  Plan: B1/S1      │       │  Plan: B1/S1        │
    └───────────────────┘       └──────────┬──────────┘
                                           │
                                ┌──────────┴──────────┐
                                │  Azure Database for │
                                │  PostgreSQL Flexible│
                                └─────────────────────┘
```

**Servicios Azure:**
- **Azure App Service** x2: uno para web (Next.js), otro para api (Express). Plan B1 para inicio, escalar a S1/P1 segun demanda
- **Azure Database for PostgreSQL - Flexible Server**: BD managed con backups automaticos, alta disponibilidad
- **Azure Front Door**: CDN + WAF + SSL + routing entre web y api
- **Azure Key Vault**: almacenar secretos (JWT_SECRET, ENCRYPTION_KEY, DB connection string)
- **Azure Container Registry** (opcional): si se usa Docker para deploy
- **Azure DevOps Pipelines**: CI/CD (build, test, deploy automatico)
- **Azure Repos**: repositorio Git

**Variables de entorno en App Service:**
```
# apps/web
NEXT_PUBLIC_API_URL=https://api.qametrics.com

# apps/api
DATABASE_URL=postgresql://...@qa-metrics-db.postgres.database.azure.com/qa_metrics?sslmode=require
JWT_SECRET=<desde Key Vault>
JWT_REFRESH_SECRET=<desde Key Vault>
ENCRYPTION_KEY=<desde Key Vault>
CORS_ORIGIN=https://qametrics.com
```

---

## Estrategia de migracion (gradual)

| Fase | Que se hace | Resultado |
|------|-------------|-----------|
| 1 | Setup Turborepo, mover packages/ | Monorepo funcional, monolito sigue corriendo |
| 2 | Crear apps/api con auth JWT + RBAC | Backend standalone con login y permisos |
| 3 | Migrar APIs: clients, projects, cycles, testers | Backend maneja entidades base |
| 4 | Migrar APIs: records, assignments, metrics, reports | Backend completo |
| 5 | Conectar apps/web al backend, crear api-client.ts | Frontend usa backend separado |
| 6 | Agregar rol CLIENT, UI de gestion de roles | Multi-tenant con permisos dinamicos |
| 7 | Cleanup: eliminar app/api/ de Next.js, tests E2E | Sistema limpio y testeado |
| 8 | Deploy en AWS + CI/CD | Produccion |

Cada fase es deployable. El sistema nunca deja de funcionar.

---

## Correciones del reporte de auditoria incluidas

Esta separacion resuelve automaticamente:
- Sin validacion res.ok → api-client.ts centralizado con error handling
- Autorizacion insuficiente → middleware de permisos dinamico
- Sin try/catch → error-handler middleware global
- Sin validacion Zod → validators/ por endpoint
- Rate limiting → middleware dedicado
- N+1 queries → services con queries optimizadas
- Console.error → logger estructurado (pino)
- NEXTAUTH_SECRET → JWT propio con keys rotables
- next.config.ts vacio → security headers en Express

---

## Criterios de exito

1. Frontend y backend deployados independientemente
2. JWT auth funcional con refresh tokens
3. Permisos dinamicos configurables desde UI
4. Rol CLIENT funcional (vista limitada)
5. Todas las APIs con validacion Zod + try/catch + permisos
6. Rate limiting en endpoints criticos
7. Tests de integracion para APIs
8. Build exitoso de ambos apps
