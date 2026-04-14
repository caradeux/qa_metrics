# Auditoría de Seguridad — QA Metrics

**Fecha:** 2026-04-14
**Alcance:** `apps/api`, `apps/web`, `packages/database`, `deploy/`
**Método:** revisión estática + `npm audit --production`.

Leyenda: ✅ OK · ⚠️ MEJORAR · 🔴 CRÍTICO

---

## 1. Autenticación y Autorización

| Item | Estado | Observación |
|---|---|---|
| `JWT_SECRET` validado (Zod min 32) en `apps/api/src/config/env.ts` | ✅ | Parseo fail-fast al arranque |
| `JWT_REFRESH_SECRET` separado y min 32 | ✅ | Buena práctica |
| Access token TTL 8h, refresh TTL 7d | ⚠️ | 8h largo para access en herramienta interna. Considerar 1h y usar refresh. |
| Password hashing bcrypt rounds=12 (`users.routes.ts`) | ✅ | Apropiado (OWASP recomienda ≥10) |
| Refresh token hasheado en DB (bcrypt 10) con rotación/revocación (`logout` lo limpia) | ✅ | Buena implementación |
| Revocación efectiva del refresh tras uso | ⚠️ | `refreshAccessToken` no rota el refresh; teóricamente reutilizable hasta expiración. Implementar rotación + detección de reutilización. |
| Tokens en `localStorage` (`apps/web/lib/api-client.ts`) | 🔴 | Expuestos a XSS. Mover a cookies **HttpOnly + Secure + SameSite=Strict** emitidas por el API. |
| Cookie `auth-token` no `HttpOnly`, `SameSite=Lax`, sin `Secure` | 🔴 | Legible desde JS y enviada en navegación cross-site. |
| `requirePermission` en todas las rutas críticas | ⚠️ | Mayoría de rutas protegidas; `/api/daily-records` usa chequeos custom (`canActOn`) sin `requirePermission`. Debe auditar también `records` + `assignments:*`. `stories` (rutas) y `testers/me`, `testers/:id` dependen de lógica manual. |
| Rutas sin `authMiddleware` | ✅ | Todas las rutas pasan por `router.use(authMiddleware)` salvo `/health` y `/api/auth/login|refresh` (correcto). |
| Scope multi-tenant por rol (QA_ANALYST / CLIENT_PM) | ✅ | Tras fix 2026-04-14, propagado a `assignments`, `testers`, `metrics`, `client-reports`, `cycles`, `stories`, `projects`. |

---

## 2. Validación de entrada

| Item | Estado | Observación |
|---|---|---|
| Zod en body/query de rutas críticas | ✅ | `validators/*.ts` cubren auth, records, stories, assignments, tester, holidays. |
| Sanitización XSS en texto libre (notas, títulos HU, nombres) | ⚠️ | No se sanitiza/escapa en el backend. React escapa por defecto en render. Si se inyectan datos en PDF/Excel o `dangerouslySetInnerHTML`, validar ahí. No se encontró `dangerouslySetInnerHTML` en `apps/web`. |
| SQL injection | ✅ | No hay `$queryRaw`/`$executeRaw` en código de aplicación. Prisma parametriza. |
| Límite de body `10mb` | ⚠️ | Correcto para import Excel. Considerar `1mb` en rutas que no reciben archivos. |

---

## 3. Secretos y variables de entorno

| Item | Estado | Observación |
|---|---|---|
| `.gitignore` excluye `.env`, `apps/api/.env`, `apps/web/.env.local` | ✅ | |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` min 32 | ✅ | |
| `ENCRYPTION_KEY` min 16 (para cifrar PAT de ADO) | ⚠️ | 16 chars es mínimo débil para AES-256 (se necesitan 32 bytes). Elevar a `min(32)`. |
| `DATABASE_URL` con credenciales en plano | ⚠️ | Normal en `.env`. En prod usar secret manager (Azure Key Vault). |
| Secretos en logs | ✅ | `logger` no vuelca `env` ni tokens en código revisado. |

---

## 4. CORS, rate limiting, headers

| Item | Estado | Observación |
|---|---|---|
| CORS con `origin: env.CORS_ORIGIN` y `credentials: true` | ✅ | Un único origen por env. |
| `helmet()` activado | ✅ | Con `crossOriginResourcePolicy: cross-origin` (necesario para API) |
| CSP headers | ⚠️ | Helmet default CSP no seteado explícitamente en API; frontend Next.js no define CSP en `next.config.ts`. Añadir CSP estricta. |
| Rate limit global 200/15min prod | ✅ | Razonable |
| Rate limit login 10/15min prod | ✅ | Anti-bruteforce |
| Body limit 10MB | ⚠️ | Ver §2 |

---

## 5. Base de datos

| Item | Estado | Observación |
|---|---|---|
| Conexión parametrizada vía `DATABASE_URL` | ✅ | |
| Password DB `root:root` local | ⚠️ | OK en dev. En prod, credenciales fuertes + TLS (`sslmode=require`). |
| Índices | ✅ | Schema Prisma tiene `@@unique([testerId, cycleId, weekStart])` y claves únicas razonables. Revisar índices en `DailyRecord(testerId, date)` para queries de métricas. |
| Backups | 🔴 | No se encontró estrategia documentada. Documentar en `docs/` + configurar Azure Backup antes de productivo. |
| Migraciones destructivas | ✅ | AGENTS.md establece "no migrate reset". |

---

## 6. Frontend

| Item | Estado | Observación |
|---|---|---|
| `dangerouslySetInnerHTML` | ✅ | No usado. |
| `accessToken` en `localStorage` | 🔴 | Ver §1. |
| `refreshToken` en `localStorage` | 🔴 | Aún peor: compromiso de refresh = sesión de 7 días. |
| Cookie fallback `auth-token` no HttpOnly | 🔴 | Duplica vector XSS y permite middleware server-side leerla. Migrar a HttpOnly set por API. |
| CSP | ⚠️ | No definida en `next.config.ts`. |
| Logs sensibles en consola | ⚠️ | Revisar (no auditado archivo por archivo). Preferir `logger` wrapper y deshabilitar `console.*` en prod. |

---

## 7. Deployment

| Item | Estado | Observación |
|---|---|---|
| Dockerfiles presentes (`apps/api`, `apps/web`) | ✅ | |
| `.dockerignore` raíz | 🔴 | **No existe** en raíz. Riesgo de copiar `.env`, `node_modules` con secretos, `e2e/.auth/*.json` (tokens de pruebas) a la imagen. Crear `.dockerignore`. |
| `e2e/.auth/*.json` contiene tokens | ⚠️ | Verificar que estén en `.gitignore` y jamás en imágenes prod. |
| CI/CD: `azure-pipelines.yml` | ℹ️ | No auditado; verificar `secrets` vs variables claras. |
| HTTPS | ⚠️ | Debe forzarse en App Service/Ingress; configurar HSTS vía helmet. |
| Logs con PII | ⚠️ | `logger` middleware no redacta emails/passwords. Revisar formato. |

---

## 8. Vulnerabilidades de dependencias (`npm audit --production`)

### `apps/api`
| Paquete | Severidad | Detalle | Fix |
|---|---|---|---|
| `@hono/node-server` <1.19.13 | moderate | GHSA-92pp-h63x-v22m (path traversal en serveStatic) vía `@prisma/dev` → `prisma` | Actualizar `prisma` a 6.19.3 (semver major). Sólo afecta dev, no runtime. |
| `hono` <4.12.12 | moderate | Varias (GHSA-26pp-8wgv-hjvm, r5rp-j6wh-rvv4, xpcf-pg52-r92g, xf4j-xp2r-rqqx, wmmm-f939-6g9c) — cookie handling + path traversal | Fix disponible |
| `dompurify` <=3.3.1 (vía `jspdf`) | moderate | GHSA-vhxf-7vqr-mrjg + 3 más (XSS / prototype pollution) | Actualizar `jspdf` a 4.2.1 (semver major) |

**HIGH/CRITICAL en API:** ninguno.

### `apps/web`
| Paquete | Severidad | Detalle | Fix |
|---|---|---|---|
| `next` 16.0.0-beta.0..16.2.2 | **high** | GHSA-q4gf-8mx6-v5v3 — DoS en Server Components (CVSS 7.5) | Actualizar `next` a 16.2.3 (no breaking) |
| `@hono/node-server`, `hono`, `prisma`, `@prisma/dev` | moderate | Mismos que en API | Mismos fixes |

---

## Ranking de riesgos (top-5 antes de productivo)

1. **🔴 Tokens en `localStorage` + cookies no-HttpOnly** — Cualquier XSS exfiltra sesión + refresh de 7 días.
   *Plan:* que `/api/auth/login` y `/refresh` seteen cookies `HttpOnly; Secure; SameSite=Strict` con el access y refresh. Adaptar `apiClient` a `credentials: "include"`. Eliminar `localStorage.setItem("accessToken"|"refreshToken")`. Proteger CSRF con token doble o `SameSite=Strict`.
2. **🔴 `next` 16.2.2 con CVE high (DoS server components)** — directamente explotable.
   *Plan:* `npm i next@16.2.3 -w apps/web`, verificar build y tests E2E.
3. **🔴 Sin `.dockerignore` raíz** — riesgo de fuga de secretos en imagen.
   *Plan:* crear `.dockerignore` con `node_modules`, `.env*`, `**/.env*`, `**/e2e/.auth/`, `.git`, `*.log`, `coverage`, `dist`, `.turbo`, `.next`.
4. **🔴 Sin estrategia de backups documentada** — pérdida total posible.
   *Plan:* habilitar PITR en PostgreSQL gestionado (Azure Flexible Server), documentar RTO/RPO y runbook de restore en `docs/`.
5. **⚠️→🔴 Refresh token sin rotación** — si un refresh se filtra (punto 1), válido 7 días.
   *Plan:* rotar refresh en cada `/api/auth/refresh` (emitir nuevo + invalidar anterior) y detectar reutilización (si reaparece un refresh ya invalidado → revocar toda la familia).

---

## Acciones secundarias recomendadas

- Elevar `ENCRYPTION_KEY` a `min(32)` y verificar uso AES-256-GCM.
- Añadir CSP en Next.js (`next.config.ts` → `headers()`), HSTS (`strict-transport-security`) y X-Content-Type-Options ya vienen con helmet.
- Reducir body limit a 1MB excepto en rutas de import.
- Acortar access token a 1h; confiar en refresh.
- Redactar PII en `logger` (email, nombres) para logs prod.
- Actualizar `hono`, `jspdf`, `prisma` (major) en ventana planificada.
- Añadir `npm audit` como gate en CI (fail en high/critical).
