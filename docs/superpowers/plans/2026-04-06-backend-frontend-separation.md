# Backend/Frontend Separation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el monolito Next.js en un backend Express y frontend Next.js independientes dentro de un monorepo Turborepo, con auth JWT y permisos dinamicos RBAC.

**Architecture:** Turborepo monorepo con apps/web (Next.js 16), apps/api (Express + Prisma 7), y packages compartidos (database, types, utils). Auth con JWT access/refresh tokens. RBAC con roles y permisos configurables en BD.

**Tech Stack:** Turborepo, Next.js 16, Express.js, Prisma 7, PostgreSQL, JWT (jsonwebtoken), Zod, Pino, Vitest

---

## Task 1: Setup Turborepo Monorepo Structure

**Files:**
- Create: `package.json` (root workspace)
- Create: `turbo.json`
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/index.ts`
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/utils/package.json`
- Create: `packages/utils/tsconfig.json`
- Create: `packages/utils/src/index.ts`
- Move: `prisma/` → `packages/database/prisma/`
- Move: `generated/` → `packages/database/generated/`
- Move: `lib/metrics.ts` → `packages/utils/src/metrics.ts`
- Move: `lib/week-utils.ts` → `packages/utils/src/week-utils.ts`
- Move: `lib/crypto.ts` → `packages/utils/src/crypto.ts`

- [ ] **Step 1: Create root workspace package.json**

Replace the current `package.json` with a workspace root:

```json
{
  "name": "qa-metrics",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

- [ ] **Step 3: Move current app to apps/web/**

```bash
mkdir -p apps/web
# Move all Next.js files to apps/web
mv app apps/web/
mv components apps/web/
mv public apps/web/
mv next.config.ts apps/web/
mv postcss.config.mjs apps/web/
mv tailwind.config.ts apps/web/ 2>/dev/null
mv proxy.ts apps/web/
mv tsconfig.json apps/web/
# Create apps/web/package.json from current deps (minus backend-only deps)
```

Create `apps/web/package.json`:
```json
{
  "name": "@qa-metrics/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@qa-metrics/types": "workspace:*",
    "@qa-metrics/utils": "workspace:*",
    "next": "16.2.2",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.1",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.2",
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Create packages/database/**

```bash
mkdir -p packages/database/src
mv prisma packages/database/
mv generated packages/database/
mv prisma.config.ts packages/database/
```

Create `packages/database/package.json`:
```json
{
  "name": "@qa-metrics/database",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "seed": "prisma db seed",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.6.0",
    "@prisma/client": "^7.6.0",
    "pg": "^8.20.0"
  },
  "devDependencies": {
    "prisma": "^7.6.0",
    "dotenv": "^17.4.1",
    "typescript": "^5"
  }
}
```

Create `packages/database/src/index.ts`:
```typescript
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClient } from "../generated/prisma/client.js";
export * from "../generated/prisma/enums.js";
```

- [ ] **Step 5: Create packages/utils/**

```bash
mkdir -p packages/utils/src
mv lib/metrics.ts packages/utils/src/
mv lib/week-utils.ts packages/utils/src/
mv lib/crypto.ts packages/utils/src/
```

Create `packages/utils/package.json`:
```json
{
  "name": "@qa-metrics/utils",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

Create `packages/utils/src/index.ts`:
```typescript
export * from "./metrics.js";
export * from "./week-utils.js";
export { encrypt, decrypt } from "./crypto.js";
```

- [ ] **Step 6: Create packages/types/**

Create `packages/types/package.json`:
```json
{
  "name": "@qa-metrics/types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "devDependencies": { "typescript": "^5" }
}
```

Create `packages/types/src/index.ts`:
```typescript
// Auth
export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { accessToken: string; refreshToken: string; user: UserInfo; }
export interface RefreshRequest { refreshToken: string; }
export interface RefreshResponse { accessToken: string; }

// User & Roles
export interface UserInfo {
  id: string; name: string; email: string;
  role: { id: string; name: string; permissions: PermissionInfo[] };
}
export interface PermissionInfo { resource: string; action: string; }

// API
export interface ApiErrorResponse { error: string; }
export interface PaginatedResponse<T> { data: T[]; total: number; page: number; limit: number; }

// Entities
export interface ClientDTO { id: string; name: string; createdAt: string; projectCount: number; }
export interface ProjectDTO { id: string; name: string; clientId: string; clientName: string; modality: string; createdAt: string; }
export interface TesterDTO { id: string; name: string; projectId: string; recordCount: number; }
export interface CycleDTO { id: string; name: string; projectId: string; startDate: string | null; endDate: string | null; recordCount: number; storyCount: number; }
export interface AssignmentDTO { id: string; testerId: string; testerName: string; storyId: string; storyTitle: string; status: string; startDate: string; endDate: string | null; executionCycle: string | null; notes: string | null; }

// Metrics
export interface KPIs { totalDesigned: number; totalExecuted: number; totalDefects: number; executionRatio: number; }
export interface WeeklyTrendPoint { weekStart: string; designed: number; executed: number; defects: number; }
export interface TesterSummary { testerId: string; testerName: string; designed: number; executed: number; defects: number; ratio: number; }
export interface DefectDistribution { critical: number; high: number; medium: number; low: number; }
```

- [ ] **Step 7: Install dependencies and verify structure**

```bash
cd qa-metrics
npm install
npm install -D turbo
npx turbo build --filter=@qa-metrics/utils
npx turbo build --filter=@qa-metrics/database
```

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "refactor: setup turborepo monorepo with shared packages"
```

---

## Task 2: Create Backend Express App with JWT Auth

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/error-handler.ts`
- Create: `apps/api/src/middleware/logger.ts`
- Create: `apps/api/src/services/auth.service.ts`
- Create: `apps/api/src/routes/auth.routes.ts`
- Create: `apps/api/src/validators/auth.validator.ts`
- Test: `apps/api/src/__tests__/auth.test.ts`

- [ ] **Step 1: Create apps/api/package.json**

```json
{
  "name": "@qa-metrics/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@qa-metrics/database": "workspace:*",
    "@qa-metrics/types": "workspace:*",
    "@qa-metrics/utils": "workspace:*",
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.9",
    "tsx": "^4.21.0",
    "typescript": "^5",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 2: Create config/env.ts with Zod validation**

```typescript
// apps/api/src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 3: Create middleware/auth.ts (JWT verification)**

```typescript
// apps/api/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "@qa-metrics/database";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: {
      id: string;
      name: string;
      permissions: Array<{ resource: string; action: string }>;
    };
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, active: true,
        role: {
          select: {
            id: true, name: true,
            permissions: { select: { permission: { select: { resource: true, action: true } } } },
          },
        },
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: "Usuario no encontrado o inactivo" });
    }

    req.user = {
      id: user.id, email: user.email, name: user.name,
      role: {
        id: user.role.id, name: user.role.name,
        permissions: user.role.permissions.map(rp => rp.permission),
      },
    };

    next();
  } catch {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

export function requirePermission(resource: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const perms = req.user?.role.permissions || [];
    if (!perms.some(p => p.resource === resource && p.action === action)) {
      return res.status(403).json({ error: "Sin permiso para esta accion" });
    }
    next();
  };
}
```

- [ ] **Step 4: Create middleware/error-handler.ts**

```typescript
// apps/api/src/middleware/error-handler.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, "Unhandled error");

  if (err.name === "ZodError") {
    return res.status(422).json({ error: "Datos invalidos", details: (err as any).issues });
  }

  res.status(500).json({ error: "Error interno del servidor" });
}
```

- [ ] **Step 5: Create middleware/logger.ts**

```typescript
// apps/api/src/middleware/logger.ts
import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport: env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
});
```

- [ ] **Step 6: Create services/auth.service.ts**

```typescript
// apps/api/src/services/auth.service.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@qa-metrics/database";
import { env } from "../config/env.js";
import type { LoginResponse } from "@qa-metrics/types";

export async function login(email: string, password: string): Promise<LoginResponse> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  });

  if (!user || !user.active) throw new Error("INVALID_CREDENTIALS");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  const accessToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

  const hashedRefresh = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: hashedRefresh } });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id, name: user.name, email: user.email,
      role: {
        id: user.role.id, name: user.role.name,
        permissions: user.role.permissions.map(rp => ({ resource: rp.permission.resource, action: rp.permission.action })),
      },
    },
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });

  if (!user || !user.active || !user.refreshToken) throw new Error("INVALID_REFRESH");

  const valid = await bcrypt.compare(refreshToken, user.refreshToken);
  if (!valid) throw new Error("INVALID_REFRESH");

  const accessToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "15m" });
  return { accessToken };
}

export async function logout(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
}
```

- [ ] **Step 7: Create validators/auth.validator.ts**

```typescript
// apps/api/src/validators/auth.validator.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Contrasena requerida"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token requerido"),
});
```

- [ ] **Step 8: Create routes/auth.routes.ts**

```typescript
// apps/api/src/routes/auth.routes.ts
import { Router, Request, Response } from "express";
import { loginSchema, refreshSchema } from "../validators/auth.validator.js";
import * as authService from "../services/auth.service.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    if (err.name === "ZodError") {
      return res.status(422).json({ error: err.issues[0].message });
    }
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch {
    res.status(401).json({ error: "Refresh token invalido" });
  }
});

router.post("/logout", authMiddleware, async (req: AuthRequest, res: Response) => {
  await authService.logout(req.user!.id);
  res.json({ message: "Sesion cerrada" });
});

export default router;
```

- [ ] **Step 9: Create main Express app (src/index.ts)**

```typescript
// apps/api/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { logger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));

// Routes
app.use("/api/auth", authRoutes);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Error handler (must be last)
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`API server running on port ${env.PORT}`);
});

export default app;
```

- [ ] **Step 10: Create .env for backend**

```bash
# apps/api/.env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:root@localhost:5432/qa_metrics?schema=public
JWT_SECRET=dev-jwt-secret-must-be-at-least-32-chars-long
JWT_REFRESH_SECRET=dev-refresh-secret-must-be-at-least-32-chars
ENCRYPTION_KEY=dev-encryption-key-change-in-production-32b
CORS_ORIGIN=http://localhost:3000
```

- [ ] **Step 11: Install deps and test server starts**

```bash
cd apps/api
npm install
npm run dev
# Expected: "API server running on port 4000"

# Test login:
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qametrics.com","password":"QaMetrics2024!"}'
# Expected: { accessToken: "...", refreshToken: "...", user: {...} }
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add Express backend with JWT auth"
```

---

## Task 3: Update Prisma Schema for RBAC

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/seed-roles.ts`

- [ ] **Step 1: Update schema.prisma with Role, Permission, RolePermission models**

Replace the User model's `role` field and add new models. Replace `UserRole` enum with a Role relation. Add `refreshToken` field to User.

Key changes:
- Remove `enum UserRole`
- Add `model Role` with `name`, `description`, `isSystem`
- Add `model Permission` with `resource`, `action` (unique combo)
- Add `model RolePermission` joining Role ↔ Permission
- Update User: `roleId String` + `role Role @relation(...)` + `refreshToken String?`
- Add indexes on all foreign keys

- [ ] **Step 2: Run migration**

```bash
cd packages/database
npx prisma migrate dev --name rbac_dynamic_permissions
```

- [ ] **Step 3: Create seed that populates roles and permissions**

Seed creates:
- 10 resources x 4 actions = 40 permissions
- 4 system roles (Admin, Jefe QA, Analista QA, Cliente)
- Assigns permissions to each role per the spec matrix
- Creates default admin user with Admin role

- [ ] **Step 4: Run seed and verify**

```bash
npx prisma db seed
npx prisma studio
# Verify: Role table has 4 roles, Permission table has 40 entries
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add RBAC schema with roles and permissions"
```

---

## Task 4: Migrate Entity APIs to Backend

**Files:**
- Create: `apps/api/src/routes/clients.routes.ts`
- Create: `apps/api/src/routes/projects.routes.ts`
- Create: `apps/api/src/routes/cycles.routes.ts`
- Create: `apps/api/src/routes/testers.routes.ts`
- Create: `apps/api/src/routes/users.routes.ts`
- Create: `apps/api/src/routes/roles.routes.ts`
- Create: `apps/api/src/validators/client.validator.ts`
- Create: `apps/api/src/validators/project.validator.ts`
- Create: `apps/api/src/validators/cycle.validator.ts`
- Create: `apps/api/src/validators/tester.validator.ts`
- Create: `apps/api/src/validators/user.validator.ts`
- Create: `apps/api/src/validators/role.validator.ts`

- [ ] **Step 1: Create validators for all entities**

Each validator uses Zod. Same schemas as current monolito but standardized.

- [ ] **Step 2: Create clients.routes.ts**

Pattern for EACH route file:
```typescript
import { Router } from "express";
import { authMiddleware, requirePermission } from "../middleware/auth.js";
import { prisma } from "@qa-metrics/database";
// Zod validators imported

const router = Router();
router.use(authMiddleware); // All routes require auth

router.get("/", requirePermission("clients", "read"), async (req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      where: { userId: req.user!.id },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(clients);
  } catch (err) { next(err); }
});

// POST, PUT /:id, DELETE /:id with permissions + validation
export default router;
```

- [ ] **Step 3: Create all other entity route files** (projects, cycles, testers, users, roles)

Same pattern. Each route has:
- `authMiddleware` on all routes
- `requirePermission(resource, action)` per endpoint
- Zod validation on POST/PUT bodies
- try/catch with `next(err)` for error handler
- Proper filtering by userId where applicable

- [ ] **Step 4: Create roles.routes.ts with permission matrix CRUD**

```
GET  /api/roles           → List roles with permissions
POST /api/roles           → Create role
PUT  /api/roles/:id       → Update role name + permissions (array of {resource, action})
DELETE /api/roles/:id     → Delete role (not isSystem)
```

- [ ] **Step 5: Register all routes in index.ts**

```typescript
import clientsRoutes from "./routes/clients.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
// ... all routes

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/cycles", cyclesRoutes);
app.use("/api/testers", testersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/roles", rolesRoutes);
```

- [ ] **Step 6: Test all endpoints with curl**

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@qametrics.com","password":"QaMetrics2024!"}' | jq -r '.accessToken')

# Test clients
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/clients
# Expected: array of clients

# Test roles
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/roles
# Expected: array of roles with permissions
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate entity CRUD APIs to Express backend"
```

---

## Task 5: Migrate Records, Assignments, Metrics, Reports APIs

**Files:**
- Create: `apps/api/src/routes/records.routes.ts`
- Create: `apps/api/src/routes/assignments.routes.ts`
- Create: `apps/api/src/routes/metrics.routes.ts`
- Create: `apps/api/src/routes/reports.routes.ts`
- Create: `apps/api/src/services/metrics.service.ts`
- Create: `apps/api/src/services/reports.service.ts`
- Create: `apps/api/src/validators/record.validator.ts`
- Create: `apps/api/src/validators/assignment.validator.ts`

- [ ] **Step 1: Create records.routes.ts**

Includes: GET (with filters), POST (batch upsert), import preview, import confirm, template download

- [ ] **Step 2: Create assignments.routes.ts**

Includes: GET (with filters), POST, PUT /:id (status change), DELETE /:id. Validates AssignmentStatus enum values.

- [ ] **Step 3: Create metrics.service.ts**

Move logic from `@qa-metrics/utils` metrics functions. Add:
- `getProjectMetrics(projectId, filters)` — queries + aggregation
- `getClientMetrics(clientId)` — queries all projects for client
- Optimized queries (no N+1: use groupBy instead of map+query)

- [ ] **Step 4: Create metrics.routes.ts**

```
GET /api/metrics?projectId=&cycleId=&weekFrom=&weekTo=&testerId=
GET /api/metrics/client?clientId=
```

- [ ] **Step 5: Create reports.service.ts**

Move Excel generation (ExcelJS) and PDF generation (jsPDF) from monolito.

- [ ] **Step 6: Create reports.routes.ts**

```
GET  /api/reports/excel?projectId=&...
POST /api/reports/pdf { projectId, filters }
GET  /api/templates/download
```

- [ ] **Step 7: Register routes in index.ts and test**

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: migrate records, assignments, metrics, reports APIs"
```

---

## Task 6: Create Frontend API Client and Auth Hooks

**Files:**
- Create: `apps/web/lib/api-client.ts`
- Create: `apps/web/hooks/useAuth.ts`
- Create: `apps/web/hooks/usePermissions.ts`
- Create: `apps/web/app/providers.tsx` (update)
- Modify: `apps/web/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create lib/api-client.ts**

Centralized fetch wrapper that:
- Adds Bearer token from localStorage
- Auto-refreshes on 401
- Throws typed ApiError
- Handles JSON parsing safely

- [ ] **Step 2: Create hooks/useAuth.ts**

React context + hook that:
- Stores accessToken/refreshToken in localStorage
- Provides login(), logout(), user, permissions
- Auto-refresh on app mount
- Redirects to /login if unauthenticated

- [ ] **Step 3: Create hooks/usePermissions.ts**

```typescript
export function usePermissions() {
  const { user } = useAuth();
  const can = (resource: string, action: string) =>
    user?.role.permissions.some(p => p.resource === resource && p.action === action) ?? false;
  return { can };
}
```

- [ ] **Step 4: Update providers.tsx**

Replace SessionProvider (NextAuth) with AuthProvider (custom JWT).

- [ ] **Step 5: Update login page**

Call `POST /api/auth/login` via api-client instead of `signIn("credentials")`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add frontend API client with JWT auth hooks"
```

---

## Task 7: Connect Frontend Pages to Backend API

**Files:**
- Modify: ALL pages in `apps/web/app/(app)/`
- Remove: `apps/web/app/api/` (all API routes)
- Modify: `apps/web/components/layout/Sidebar.tsx`
- Modify: `apps/web/components/layout/Header.tsx`

- [ ] **Step 1: Replace all fetch("/api/...") with apiClient("/api/...")**

In EVERY page, replace:
```typescript
// OLD
const res = await fetch("/api/clients");
const data = await res.json();

// NEW
import { apiClient } from "@/lib/api-client";
const data = await apiClient("/api/clients");
```

- [ ] **Step 2: Add permission checks to UI components**

```typescript
const { can } = usePermissions();

// Hide buttons/sections based on permissions
{can("clients", "create") && <button>Nuevo Cliente</button>}
{can("users", "read") && <Link href="/users">Usuarios</Link>}
```

- [ ] **Step 3: Update Sidebar with permission-based nav**

Only show nav items the user has permission to access.

- [ ] **Step 4: Update Header with user info from JWT context**

- [ ] **Step 5: Delete apps/web/app/api/ directory entirely**

- [ ] **Step 6: Delete apps/web/proxy.ts** (auth handled by api-client)

- [ ] **Step 7: Test full flow**: Login → Dashboard → Clients → Projects → Records → Assignments → Users

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: connect frontend to backend API, remove API routes"
```

---

## Task 8: Add Roles Management UI

**Files:**
- Create: `apps/web/app/(app)/settings/roles/page.tsx`
- Modify: `apps/web/components/layout/Sidebar.tsx` (add Settings link)

- [ ] **Step 1: Create settings/roles/page.tsx**

Page shows:
- List of roles with user count
- Create role button (if can("roles", "create"))
- Edit modal with permission matrix (resource x action checkboxes)
- System roles flagged as non-deletable

- [ ] **Step 2: Add Settings section to Sidebar**

```
Configuracion
  └─ Roles y Permisos  (/settings/roles)
```

Only visible if `can("roles", "read")`.

- [ ] **Step 3: Test full RBAC flow**

1. Login as Admin
2. Create new role "Supervisor" with custom permissions
3. Create user with Supervisor role
4. Login as Supervisor
5. Verify only permitted pages/actions are available

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add roles management UI with permission matrix"
```

---

## Task 9: Cleanup, Tests, and Production Readiness

**Files:**
- Create: `apps/api/src/__tests__/auth.test.ts`
- Create: `apps/api/src/__tests__/clients.test.ts`
- Create: `apps/api/src/__tests__/permissions.test.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/web/.env.example`
- Create: `.gitignore` (root)
- Create: `Dockerfile` (apps/api)
- Create: `Dockerfile` (apps/web)

- [ ] **Step 1: Write auth integration tests**

Test: login success, login fail, refresh token, expired token, logout

- [ ] **Step 2: Write permission tests**

Test: admin can access all, analyst blocked from users, client blocked from records

- [ ] **Step 3: Write CRUD integration tests**

Test: clients CRUD, projects CRUD with auth headers

- [ ] **Step 4: Create Dockerfiles for Azure deployment**

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Create .env.example files**

- [ ] **Step 6: Create root .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
generated/
*.log
```

- [ ] **Step 7: Final build verification**

```bash
npx turbo build
npx turbo test
# Expected: All apps build, all tests pass
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add tests, dockerfiles, production config"
```

---

## Summary: File Count by Task

| Task | New Files | Modified | Deleted |
|------|-----------|----------|---------|
| 1. Turborepo setup | ~15 | ~5 | 0 |
| 2. Backend + JWT auth | ~12 | 0 | 0 |
| 3. RBAC schema | ~2 | 1 | 0 |
| 4. Entity APIs | ~12 | 1 | 0 |
| 5. Records/Metrics APIs | ~8 | 1 | 0 |
| 6. Frontend auth hooks | ~4 | 2 | 0 |
| 7. Connect frontend | 0 | ~16 | ~21 |
| 8. Roles UI | ~2 | 1 | 0 |
| 9. Tests + Docker | ~8 | 2 | 0 |
| **TOTAL** | **~63** | **~29** | **~21** |
