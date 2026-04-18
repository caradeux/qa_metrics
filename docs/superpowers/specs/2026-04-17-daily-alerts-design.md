# Alertas diarias por email — Design Spec

**Fecha:** 2026-04-17
**Autor:** Líder QA (jcaradeux@inovabiz.com)
**Estado:** Design approved, pending implementation plan

## Problema

Los testers a veces terminan el día sin registrar movimientos en sus asignaciones activas (diseño, ejecución, defectos). Esto deja al Líder QA sin visibilidad hasta que descubre el gap al preparar un reporte. Hoy no hay recordatorio automático.

## Alcance v1

Mandar un correo cada **día hábil a las 09:00 (America/Santiago)** revisando el **día hábil anterior**. Si un tester tiene asignaciones activas sin `DailyRecord` para esa fecha, recibe un correo listando qué le falta, con copia al admin y al PM del proyecto correspondiente.

**Fuera de scope v1** (documentado para iteraciones futuras):

- Opt-out por tester.
- Cadencia personalizada por proyecto.
- Canales adicionales (Slack/Teams).
- Dashboard UI de historial de alertas.
- Tabla `AlertSent` para idempotencia entre ejecuciones del mismo día.

## Decisiones tomadas durante brainstorming

| # | Decisión | Opción elegida |
|---|---|---|
| 1 | Pausas (`ON_HOLD`) | Se abordan en spec separado. En este spec solo se respeta el estado para no alertar. |
| 2 | Trigger temporal | Mañana hábil 09:00 CL, revisa día hábil anterior. |
| 3 | CC | ADMIN(s) activos + PM del proyecto de cada asignación faltante. |
| 4 | Proveedor email | Resend con dominio `qametrics.cl` (alias `notificaciones@qametrics.cl`). |
| 5 | Remitente | `notificaciones@qametrics.cl` (alias, no buzón personal). |
| 6 | Reply-To | ADMIN principal (configurable por env var). |
| 7 | Definición de "sin movimiento" | Asignaciones con estado NO IN `(ON_HOLD, PRODUCTION, UAT, WAITING_UAT)` sin `DailyRecord` para el día. |
| 8 | Scheduler | Coolify Scheduled Task → `POST /api/internal/run-daily-alerts` con header secret. |
| 9 | Distribución a admin/PM | CC en cada correo del tester (no digest separado). |

## Arquitectura

Todo dentro de `apps/api`. Sin schema changes en `packages/database`.

### Componentes nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/mailer.ts` | Adapter de proveedor de correo. Expone una sola interfaz `send({ to, cc, subject, html, replyTo })`. Implementación concreta con SDK de Resend. Cambiar proveedor implica modificar solo este archivo. |
| `src/lib/daily-alerts.ts` | Lógica core: `previousWorkday()`, `findTestersWithMissingRecords()`, `buildAlertPayloads()`, `runDailyAlerts()`. Puro, sin HTTP. Testeable en aislamiento. |
| `src/templates/daily-alert.ts` | Template HTML del correo (string template literal). Español, paleta `#1F3864` / `#2E5FA3`, tabla con HUs faltantes, botón CTA a `/mi-semana`. |
| `src/routes/internal.routes.ts` | Router montado en `/api/internal`. Endpoint `POST /api/internal/run-daily-alerts` con auth por header `X-Internal-Secret`. Soporta `?dryRun=true` para no enviar correos. |

### Modelos de datos usados

Todos existentes:

- `Tester` + `Tester.user` (para email).
- `TesterAssignment` (startDate, endDate, status).
- `DailyRecord` (testerId, assignmentId, date).
- `Holiday` (feriados CL 2026 ya precargados).
- `User` con `role.name = "ADMIN"` (para CC).
- `Project.projectManagerId` → `User.email` (para CC del PM).
- `UserStory` (externalId, title) vía `assignment.story`.

### Dependencias nuevas

- `resend` (~20kb). Única dependencia npm nueva.

### Configuración (env vars del API)

```
RESEND_API_KEY=re_xxx                        # API key desde dashboard de Resend
ALERT_FROM_EMAIL=notificaciones@qametrics.cl # remitente
ALERT_REPLY_TO=admin@qametrics.cl            # email del ADMIN principal
INTERNAL_SECRET=<random 32 chars>            # shared secret para el endpoint
APP_URL=https://qametrics.cl                 # para el botón CTA del correo
```

## Data flow

**Disparo**:

Coolify Scheduled Task con expresión `0 9 * * 1-5` (timezone `America/Santiago`):

```
curl -X POST https://qametrics.cl/api/internal/run-daily-alerts \
     -H "X-Internal-Secret: $INTERNAL_SECRET"
```

**Ciclo del handler**:

1. **Auth**. Valida `X-Internal-Secret` contra `process.env.INTERNAL_SECRET`. Mismatch → 403.
2. **Determinar `dayToCheck`**. Función `previousWorkday(today)`: resta 1 día y sigue restando mientras sea sábado/domingo o esté en `Holiday.date`. Así, martes revisa lunes; lunes revisa viernes (si viernes no es feriado).
3. **Guard de no-workday**. Si hoy mismo es fin de semana o feriado → responde 200 `{ skipped: true, reason: "non-workday" }`. Coolify seguirá llamando aunque no toque enviar.
4. **Query principal**. Cargar testers con asignaciones activas en `dayToCheck` sin `DailyRecord`:
   - Tester debe tener `user.email IS NOT NULL`.
   - Assignment: `status NOT IN (ON_HOLD, PRODUCTION, UAT, WAITING_UAT)`.
   - Rango de assignment cubre `dayToCheck`: `startDate <= dayToCheck AND (endDate IS NULL OR endDate >= dayToCheck)`.
   - No existe `DailyRecord(testerId, assignmentId, date = dayToCheck)`.
5. **Por cada tester con ≥1 asignación faltante**:
   - Cargar `tester.user.email`. Si es null, log warning y skip.
   - Armar CC: todos los `User` con rol ADMIN activos + `project.projectManager.user.email` de cada proyecto distinto de sus asignaciones faltantes. Dedup por email.
   - Render template con `{ testerName, dayLabel, missingAssignments: [{externalId, title, projectName, status}], appUrl }`.
   - Llamar `mailer.send()` (o no si `dryRun=true`).
6. **Respuesta**:
   ```json
   {
     "dayChecked": "2026-04-16",
     "testersNotified": 3,
     "assignmentsFlagged": 7,
     "errors": []
   }
   ```

**Template del correo** (resumen):

- **Asunto**: `⚠️ QA Metrics · No registraste movimientos el [lunes 16 de abril]`
- **Cuerpo**: saludo con nombre del tester, párrafo explicativo, tabla `HU · Proyecto · Estado`, botón "Ir a Mi Semana" (→ `APP_URL/mi-semana`), footer con "Si no trabajaste ayer (licencia/feriado/vacaciones), avisa al admin o PM. Si lo registraste y este correo es un error, contáctanos".
- **CC**: ADMIN(s) + PMs.
- **Reply-To**: `ALERT_REPLY_TO`.

## Errores y casos borde

- **Resend API down / dominio no verificado / email inválido**: se captura el error por tester, se agrega al array `errors` del response, el loop continúa. Un fallo no bloquea a los demás.
- **Tester sin `user.email`** (puede pasar si el Tester no está linkeado a User): log warning, skip, entry en `errors`.
- **DB unavailable**: el endpoint devuelve 500. Coolify loggea el fallo. No se reintenta esa ejecución — Coolify volverá a llamar mañana. Asumimos que una caída de 24h es tolerable en v1.
- **Secret incorrecto**: 403 inmediato, sin logging de detalle.
- **Día a revisar es feriado o fin de semana** (se llama manualmente un sábado, por ejemplo): 200 con `skipped: true`, nada que hacer.
- **Idempotencia**: ejecutar 2 veces el mismo día envía el correo 2 veces. Aceptable en v1. Si se vuelve problema, agregar tabla `AlertSent(testerId, date @db.Date)` con unique constraint.

## Modo `dryRun`

Query param `?dryRun=true` en el endpoint: ejecuta todo el pipeline (query, render de template) pero **no** llama al mailer. Devuelve los payloads que hubiese mandado como parte del JSON response. Permite validar en producción sin spammear testers reales el primer día.

## Testing

Ubicación: `apps/api/src/__tests__/`.

### Unit tests (`daily-alerts.test.ts`)

- `previousWorkday` respeta sábados, domingos y `Holiday.date` (mockeados).
- `findTestersWithMissingRecords` excluye testers sin email, excluye assignments en estados `ON_HOLD`/`PRODUCTION`/`UAT`/`WAITING_UAT`, respeta rango de fechas.
- Dedup de CC cuando un user aparece como ADMIN y PM al mismo tiempo.
- Render del template: valida que HU con `externalId` aparezca como `"HU-342 — Validación"` y sin `externalId` solo como `"Validación"`.

### Integration tests (`internal-alerts.test.ts`)

- `POST /api/internal/run-daily-alerts` sin secret → 403.
- Con secret correcto y `?dryRun=true` → 200 y body contiene payloads esperados sin tocar red.
- Con datos seed (tester con 1 asignación sin `DailyRecord` para el día simulado) → 200 con `testersNotified: 1`.

### Sin tests de envío real

No se testea el envío efectivo a Resend en CI. Se valida manualmente en staging/prod.

## Operación

### Setup inicial (one-time)

1. **Verificar dominio `qametrics.cl` en Resend dashboard**: agregar los 3 DNS records (SPF, DKIM, MX o return-path) que Resend indique. Sin esto los correos caen a spam.
2. **Configurar env vars en Coolify** (como secrets): `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_REPLY_TO`, `INTERNAL_SECRET`, `APP_URL`.
3. **Crear Scheduled Task en Coolify**: cron `0 9 * * 1-5`, timezone `America/Santiago`, comando que hace `curl` al endpoint con el secret header.
4. **Smoke test con `dryRun=true`** una vez antes del primer cron real.

### Rollback

Deshabilitar la Scheduled Task en Coolify. El código queda deployado pero deja de ejecutarse. Sin data modificada, nada que revertir en DB.

### Observabilidad mínima

- `console.log` del resumen en cada ejecución; Coolify captura stdout.
- Resend dashboard: deliverability, bounces, opens, clicks.

## Diagrama simplificado

```
Coolify Cron (09:00 M-F CL)
        │
        ▼  POST /api/internal/run-daily-alerts + X-Internal-Secret
   API Server
        │
        ▼  validate secret → runDailyAlerts()
   daily-alerts.ts
        │  ├─ previousWorkday(today, holidays)
        │  ├─ if non-workday → return {skipped}
        │  ├─ findTestersWithMissingRecords(dayToCheck)
        │  ├─ for each tester:
        │  │     ├─ build CC (admins + PMs, deduped)
        │  │     ├─ render template
        │  │     └─ mailer.send()
        │  └─ aggregate result
        ▼
  Resend API → tester + CC
```
