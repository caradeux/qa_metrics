# Integración qa_metrics → FlowPilot (registro de horas)

**Fecha:** 2026-06-01
**Estado:** Diseño aprobado — pendiente plan de implementación
**API de FlowPilot:** ver `docs/superpowers/specs/flowpilot-api-notes.md` (Fase 0 completada)

## Problema y objetivo

Los analistas QA registran su día en qa_metrics (trabajo en HU vía `DailyRecord`,
reuniones y ausencias vía `Activity`) **y además** deben cargar sus horas en
**FlowPilot** (`/time-entries/daily`). Es doble digitación.

**Objetivo:** desde qa_metrics, generar y enviar automáticamente las entradas de
horas del día a FlowPilot, en su nombre, eliminando la doble carga.

## Decisiones tomadas (brainstorming)

| Tema | Decisión |
|---|---|
| Integración | API real de FlowPilot, **sin docs** → descubierta en Fase 0 (hecho) |
| Alcance de datos | Día completo: actividades + trabajo en HU |
| Disparador | El analista, desde una **sección propia "Registro de Horas"** (no en "mi día"); botón de menú propio en el sidebar |
| Conexión | El panel **valida la conexión** (test de login) antes de habilitar el envío |
| Homologación | **Solo ADMIN/QA_LEAD** homologa, por usuario, con dropdowns que consultan **catálogos en vivo** de FlowPilot. Un ítem sin homologación no se envía. |
| Auth FlowPilot | Login Flask con email+password (no hay token) |
| Password | **Capturar al iniciar sesión en qa_metrics**, cifrado, reutilizar (mismo correo/pass) |
| Granularidad | 1 entrada por ítem (descripción + horas); destino fijo por analista |
| Tope | Máximo 8 horas/día |

## Arquitectura

```
Analista en /registro-horas (fecha D)
  │ GET preview
  ▼
qa_metrics API ── Day→Entries Builder
  │                 ├─ Activities del día (horas reales; bandType decide destino)
  │                 └─ DailyRecords del día (HU) + horas productivas (occupation.ts)
  │                        │ Mapping layer (bandType → destino FlowPilot)
  ▼                        ▼
Preview editable  ◄── entradas [{description, hours, destino}]
  │ POST sync
  ▼
FlowpilotClient (adapter) ── login Flask+CSRF ── POST /api/time-entries ×N
  │
  ▼
FlowpilotSyncLog (idempotencia por analista+fecha)
```

El **`FlowpilotClient`** es el único módulo que habla con la API real; todo lo
demás trabaja contra su interfaz.

## Modelo de datos (Prisma)

```prisma
// Password cifrado del usuario para login programático en FlowPilot.
// Se llena al iniciar sesión en qa_metrics (mismo correo/pass que FlowPilot).
model FlowpilotCredential {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  passwordEnc String   // AES-256-GCM (iv:tag:ciphertext); clave en env
  capturedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Estado de conexión del analista (no el destino — eso vive en FlowpilotMapping).
model FlowpilotConnection {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  flowpilotUserId Int?      // para GET de verificación (user_filter)
  enabled         Boolean   @default(true)
  valid           Boolean   @default(false)  // resultado del último test de conexión
  lastValidatedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Homologación por usuario: dónde carga cada tipo de ítem en FlowPilot.
// Administrada por ADMIN con catálogos en vivo (no ids hardcodeados).
// Ej. Renato: ("QA_WORK" → Contrato/UDD/1540/QA), ("VACACIONES" → Proyecto/Interno/Vacaciones/vacacion).
model FlowpilotMapping {
  id           String @id @default(cuid())
  userId       String
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind         String // "QA_WORK" (HU + reuniones) | "VACACIONES" | "LICENCIA" | "FERIADO" | ...
  entityType   String // "contract" | "project"
  clientId     Int
  clientName   String
  contractId   Int?   // si entityType=contract
  projectId    Int?   // si entityType=project
  entityName   String // nombre del contrato/proyecto (cache)
  taskTypeId   Int
  taskTypeName String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([userId, kind])
  @@index([userId])
}

// Idempotencia: qué se envió por (analista, fecha). FlowPilot NO deduplica.
model FlowpilotSyncLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime @db.Date
  entryIds    Int[]    // ids creados en FlowPilot
  hoursTotal  Float
  status      String   // "SENT" | "PARTIAL" | "FAILED"
  payloadHash String   // detectar cambios para reenvío
  sentAt      DateTime @default(now())
  @@unique([userId, date])
  @@index([userId])
}
```

## Autenticación y captura de password

- En el handler de **login de qa_metrics**, tras validar credenciales, si el rol
  carga horas (QA_ANALYST), **cifrar el password en claro** y hacer upsert en
  `FlowpilotCredential`. Cifrado **AES-256-GCM** con clave en `FLOWPILOT_ENC_KEY`
  (env), formato `iv:authTag:ciphertext` (mismo patrón que `Project.adoToken`).
- **Consentimiento:** primer login muestra aviso ("usaremos tu credencial para
  registrar horas en FlowPilot en tu nombre") con opción de desactivar.
- **Login programático** (en `FlowpilotClient.login()`):
  1. `GET /auth/login` → extraer `csrf_token` del HTML + cookie.
  2. `POST /auth/login` (form-urlencoded: csrf_token, email, password, submit).
  3. Guardar cookie de sesión autenticada (en memoria, por request de sync).
- Si el login falla (401 / password cambiado) → marcar credencial inválida y pedir
  al analista re-loguearse en qa_metrics (se re-captura). Surface claro en UI.

## Capa de mapeo (item del día → destino FlowPilot)

Cada ítem resuelve un `kind`, y el `kind` se busca en `FlowpilotMapping` del usuario:

```
Para cada item:
  kind =
    Activity con bandType=ABSENCE → categoría → "VACACIONES" | "LICENCIA" | "FERIADO"
    en cualquier otro caso (HU, reuniones, etc.) → "QA_WORK"
  destino = FlowpilotMapping[userId, kind]
  si no existe homologación para ese kind → ítem marcado "sin homologar" (no se envía)
```

Confirmado con datos reales: las reuniones (dev/cliente) se imputan al **`QA_WORK`**
(contrato QA), no a Interno. Solo las **ausencias reales** van a su homologación de
Interno. La correspondencia `bandType/categoría → kind` es una tabla pequeña en
código; el **destino** de cada `kind` lo define el admin por usuario en el formulario
de homologación (catálogos en vivo).

## Day→Entries Builder

Entrada: `(userId, date)`. Pasos:

1. **Tester(s)** del usuario → sus `Activity` del día y sus `DailyRecord` del día.
2. **Activities** (cada una con horas reales `endAt-startAt`):
   - no-ausencia → `kind=QA_WORK`, `description` = `categoría` (+ nota).
   - ausencia → `kind` según categoría (VACACIONES/LICENCIA/FERIADO).
   - destino resuelto vía `FlowpilotMapping[userId, kind]`.
3. **Trabajo en HU** (`kind=QA_WORK`): `productiveHours = min(8, capacity) −
   activityHours − absenceHours` (de `occupation.ts`, día único). Repartir entre las
   HU con `DailyRecord` ese día, **ponderado por** `(designed+executed+defects)`,
   **redondeo a 0.5h**, ajustando el residuo en la HU mayor para cuadrar el total.
   1 entrada por HU, `description` = `externalId — título` (o "Ejecución/Diseño HU").
4. **Total**: validar `Σ horas ≤ 8`. Si actividades+ausencias ya suman 8 (ej. día de
   vacaciones), no se generan entradas de HU.
5. Resultado = lista de entradas candidatas (cada una con destino resuelto, horas,
   descripción) — todas **editables** en el preview antes de enviar.

Casos borde: día sin HU ni actividades → preview vacío (nada que enviar). Día de
vacaciones completo → 1 entrada de 8h a Interno/Vacaciones. Si `productiveHours ≤ 0`
(día lleno de reuniones) → sin entradas de HU.

## UI / Frontend

- **Nuevo ítem de menú en el sidebar**: "Registro de Horas" (visible para QA_ANALYST;
  ADMIN/QA_LEAD ven estado). Ruta `apps/web/app/(app)/registro-horas/page.tsx`.
- **Página principal**: navegador de fecha (estilo `/admin/carga-diaria`) + tabla
  **preview editable** del día (descripción + horas + destino), barra de total
  `X / 8h` con validación, badge de estado de sync ("No enviado / Enviado HH:MM /
  Parcial"), botón **Enviar a FlowPilot** (deshabilitado si la conexión no está
  validada o el total > 8h).
- **Panel de conexión** (sub-panel o `/registro-horas/conexion`): muestra correo
  (pre-llenado, mismo que qa_metrics), botón **Validar conexión** (llama a
  `/connection/test`) con resultado visible. No pide password (se capturó al iniciar
  sesión). El envío queda bloqueado hasta validar y hasta que existan homologaciones.

- **Formulario de homologación (solo ADMIN/QA_LEAD)** — pantalla de administración
  (ej. `apps/web/app/(app)/admin/flowpilot-homologacion/page.tsx`):
  - Selector de **usuario** → lista sus filas de `FlowpilotMapping`.
  - Editor de fila estilo FlowPilot: **Tipo de Entidad** (Proyecto/Contrato) → carga
    **Cliente** (proxy) → carga **Contrato/Proyecto** (proxy) → **Tipo de Tarea**
    (proxy). Se asocia a un `kind` (QA_WORK / VACACIONES / LICENCIA / FERIADO).
  - Validación: cada usuario debe tener al menos `QA_WORK` homologado para poder
    enviar; las ausencias se exigen solo si el analista las usa.

## API qa_metrics (nuevos endpoints) + adapter

- **`FlowpilotClient`** (`apps/api/src/lib/flowpilot/client.ts`): `login()`,
  `listContractsByClient()`, `listProjectsByClient()`, `createEntry()`,
  `deleteEntry()`, `listDayEntries()`. Encapsula cookies/CSRF/headers.
- `GET  /api/flowpilot/connection` — estado (conectado, credencial válida,
  resultado de la última validación).
- `POST /api/flowpilot/connection/test` — **validar la conexión**: intenta el login
  Flask con la credencial guardada (y opcionalmente verifica `flowpilotUserId`).
  Devuelve `{ valid, reason? }` y persiste el resultado.

### Homologación (solo ADMIN/QA_LEAD)

- **Proxy de catálogos** (usan la sesión FlowPilot del admin; los catálogos son
  globales, no por usuario):
  - `GET /api/flowpilot/catalog/clients?entityType=contract|project`
  - `GET /api/flowpilot/catalog/contracts?clientId=`
  - `GET /api/flowpilot/catalog/projects?clientId=`
  - `GET /api/flowpilot/catalog/task-types`
- `GET  /api/flowpilot/mappings?userId=` — homologaciones de un usuario.
- `PUT  /api/flowpilot/mappings` `{ userId, kind, entityType, clientId, contractId?,
  projectId?, taskTypeId, ...names }` — upsert de una fila de homologación.
- `DELETE /api/flowpilot/mappings/:id` — quitar una homologación.
- `GET  /api/flowpilot/preview?date=YYYY-MM-DD` — entradas generadas (sin enviar).
- `POST /api/flowpilot/sync` `{ date, entries[] }` — login → crea entradas →
  escribe `SyncLog`. Idempotente (ver abajo). **Gate:** rechaza con `409` si la
  conexión no fue validada con éxito; el botón Enviar permanece deshabilitado hasta
  que la validación pase.
- Autorización: el analista solo opera sobre **su** usuario; ADMIN/QA_LEAD pueden
  ver estado (envío en bloque queda **fuera de alcance** v1).

## Idempotencia y reenvío

- `SyncLog @@unique(userId,date)`. Antes de enviar:
  - Sin log previo → crear entradas, guardar `entryIds` + `payloadHash`, status `SENT`.
  - Con log `SENT` y `payloadHash` **igual** → no reenviar (mostrar "ya enviado").
  - Con log y `payloadHash` **distinto** → **borrar** `entryIds` previos en FlowPilot
    (`DELETE /api/time-entries/{id}` — *confirmar endpoint en implementación*) y
    recrear. Si el DELETE no resulta viable, **bloquear** y pedir editar en FlowPilot.
- Fallo parcial (algunas creadas, una falla) → guardar `PARTIAL` con los `entryIds`
  ya creados para permitir limpieza/reintento.

## Seguridad

- Password de terceros almacenado en forma **recuperable** (necesario para el login
  Flask). Mitigaciones: AES-256-GCM con clave en env (no en BD/repo); cifrar solo
  para roles que cargan horas; permitir desactivar; re-captura en cada login.
- **Rotar** el password del ambiente QA que apareció durante el descubrimiento.
- Nunca loguear el password ni el cuerpo del login; redacción en logs del adapter.

## Pruebas

- **Unitarias** del Day→Entries Builder: mapeo por bandType, reparto de horas con
  redondeo a 0.5 y cuadre a ≤8h, casos borde (vacaciones, día lleno de reuniones,
  sin HU). `FlowpilotClient` mockeado.
- **Cifrado**: round-trip encrypt/decrypt, formato `iv:tag:ct`.
- **Idempotencia**: mismo `payloadHash` no reenvía; hash distinto borra+recrea.
- **Adapter** (integración, opcional, contra ambiente QA): login + createEntry +
  deleteEntry con credencial de prueba.

## A confirmar en implementación (Fase 0 residual)

1. `DELETE`/`PUT /api/time-entries/{id}` (capturar acciones Editar/Eliminar).
2. Fuente del catálogo de **tipos de tarea** (¿endpoint o server-rendered?) — lo
   necesita el proxy `/catalog/task-types`. Si es server-rendered, scrapearlo del HTML.
3. Cómo obtener el **flowpilot user id** propio (¿`/api/dashboard-summary`?).
4. ¿El backend valida `same-origin`/`Origin` y rechaza llamadas desde servidor?
   (probar `createEntry` server-to-server contra el ambiente QA).

## Fuera de alcance (v1)

- Envío en bloque por el admin (solo autoservicio del analista).
- Edición de entradas ya en FlowPilot desde qa_metrics (más allá de borrar+recrear).
- Sincronización bidireccional (FlowPilot → qa_metrics).
- Auto-descubrimiento de la homologación (la define el admin manualmente).
```
