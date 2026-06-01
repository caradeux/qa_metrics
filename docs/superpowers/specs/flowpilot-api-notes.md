# FlowPilot — Notas del API (descubrimiento Fase 0)

> Capturado el 2026-06-01 inspeccionando el tráfico de red del ambiente QA con un
> registro manual real. FlowPilot es una app **Flask** (server: gunicorn). El API
> **no está documentada**; estas notas son la fuente de verdad para el adapter.
>
> ⚠️ **Credenciales:** la autenticación es por usuario/contraseña. NO se guardan
> credenciales reales en este repo. Los ejemplos usan placeholders.

## Entornos

| Entorno | Base URL |
|---|---|
| Producción | `https://flowpilot.biz` |
| QA (pruebas) | `https://wap-asignacion-semanal-horas-qa.azurewebsites.net` |

## Autenticación — sesión Flask vía login con CSRF

No hay token/API key. El API acepta **solo la cookie de sesión** (`session=...`,
firmada, `HttpOnly`, `Path=/`). Para obtenerla por servidor:

1. `GET /auth/login` → devuelve HTML con un `<input name="csrf_token">` y setea una
   cookie `session` (que codifica el `csrf_token` de la sesión).
2. `POST /auth/login` con `Content-Type: application/x-www-form-urlencoded` y el
   mismo cookie jar. Campos:
   ```
   csrf_token=<extraído del paso 1>
   email=<email del analista>
   password=<password del analista>
   submit=Iniciar Sesión
   ```
   → `302` a `/index`, setea la cookie `session` **autenticada** (HttpOnly).
3. Usar esa cookie autenticada para las llamadas `/api/*`.

**Implicancia de diseño:** "conectar tu cuenta" = guardar **email + password**
cifrados (no un token), porque el cookie expira y es HttpOnly. El servidor de
qa_metrics hace el login programático para obtener una cookie fresca antes de
enviar.

### Headers requeridos en las llamadas `/api/*`
- `Cookie: session=...` (la autenticada)
- `X-Requested-With: XMLHttpRequest`
- `Content-Type: application/json` (en POST)
- Same-origin: el backend valida `sec-fetch-site: same-origin` / `Origin`. Desde
  un cliente servidor (no navegador) esto normalmente no aplica, **a confirmar**.

## Endpoints

### Catálogos (para construir el mapeo)

**Clientes por tipo de entidad**
```
GET /api/clients-by-entity-type?entity_type=project   (o =contract)
→ {"data":[{"id":36,"name":"UDD"}, {"id":18,"name":"Interno"}, ...], "success":true}
```
Clientes observados (QA): Aramark(6), BICE(47), Central Puerto(52), Chubb(49),
HEALTHENVISION(56), Interno(18), Inversion(42), Kaufmann(19), Sierra Gorda(29),
Tattersall(33), TotalNet(53), UDD(36).

**Contratos por cliente** (cuando `entity_type=contract`)
```
GET /api/contracts/by-client/{clientId}
→ {"data":[{"id":84,"name":"1540_Célula QA - Renato García"}, ...], "success":true}
```
Ej. UDD(36): 84 "1540_Célula QA - Renato García", 82 "1541_Célula QA - Braulio
Benardis", 83 "1541_Célula QA - José Flores", 4 "Servicio QA".

**Proyectos por cliente** (cuando `entity_type=project`) — **CONFIRMADO:**
```
GET /api/projects/by-client/{clientId}
→ {"data":[{"id":54,"name":"Vacaciones"}, ...], "success":true}
```
Proyectos del cliente **Interno(18)** (= categorías internas/ausencias):
Actividades Inovabiz(96), Beneficio Cumpleaños(93), Capacitación(48),
Certificación(50), Facturación(331), Feriado(94), Gestión Interna(33),
Licencia médica(36), Pre-venta(49), Reuniones internas(26), Seguridad Inovabiz(246),
**Vacaciones(54)**.

**Tipos de Tarea** — no apareció como XHR; render server-side o endpoint global.
Valores conocidos: `task_type_id=3` → "QA", `task_type_id=20` → "vacacion".
**A confirmar: fuente del catálogo completo de tipos de tarea.**

### Leer entradas del día
```
GET /api/time-entries?user_filter={flowpilotUserId}&date=YYYY-MM-DD
→ {"time_entries":[ {entry...} ], "pagination":{...}, "total_query_hours":8.0, "status":"success"}
```
`user_filter` = id del usuario en FlowPilot (ej. 21). **A confirmar:** cómo obtener
el propio user id (probablemente de `/api/dashboard-summary` o del perfil).

### Crear entrada
```
POST /api/time-entries        Content-Type: application/json
```
Payload (capturado):
```json
{
  "entity_type": "contract",          // "contract" | "project"
  "client_id": "36",                  // string
  "task_type_id": "3",                // string
  "date": "2026-06-01",               // YYYY-MM-DD
  "hours_worked": 4,                  // number (max 24, min 0.01)
  "time_start": null,                 // "HH:MM" opcional
  "time_end": null,                   // "HH:MM" opcional
  "description": "Ejecucion Tema 1",  // REQUERIDO
  "contract_id": "84",                // si entity_type=contract
  "project_id": null,                 // si entity_type=project
  "azure_work_item_id": null,
  "workitem_name": null,
  "story_task_id": null,
  "bug_id": null,
  "test_case_id": null
}
```
Respuesta `201`:
```json
{"data":{ "id":35220, "client_name":"UDD", "contract_name":"1540_Célula QA - Renato García",
          "entity_type":"Contrato", "task_type_name":"QA", "hours_worked":4.0, ... },
 "message":"Entrada creada correctamente", "success":true}
```

### Editar / Eliminar entrada
**CONFIRMADO (spike server-to-server, 2026-06-01):**
```
DELETE /api/time-entries/{id}  → 200 {"message":"Time entry deleted successfully","success":true}
```
`PUT /api/time-entries/{id}` (editar) probable pero no probado; con DELETE+create
basta para el reenvío idempotente del Plan 3.

### Resultado del spike server-to-server (2026-06-01)

Ejecutado desde Node (`apps/api/scripts/flowpilot-spike.ts`) contra el ambiente QA:
- `[1] GET /auth/login` → 200, CSRF + cookie OK.
- `[2] POST /auth/login` → **302** ✓ — **el backend acepta login server-to-server
  sin navegador** (no rechaza por Origin/Referer). Riesgo principal despejado.
- `[3] POST /api/time-entries` → **201** ✓ (crea desde Node).
- `[4] DELETE /api/time-entries/{id}` → **200** ✓.
- `[5] GET /api/dashboard-summary` → 200, pero **no expone el user id** de forma
  evidente (trae alertas/notificaciones). El `user_filter` del GET del día queda
  **pendiente** (buscar en perfil/otro endpoint); no bloquea la creación.

## Dos patrones de mapeo (confirmados con cargas reales)

| Caso qa_metrics | entity_type | client_id | task_type_id | destino |
|---|---|---|---|---|
| Trabajo en HU + reuniones de cliente | `contract` | 36 (UDD) | 3 (QA) | `contract_id` = contrato del analista |
| Vacaciones / ausencia / interno | `project` | 18 (Interno) | 20 (vacacion)* | `project_id` = proyecto interno (Vacaciones=54, etc.) |

\* `task_type_id` para categorías internas distintas de vacaciones (Capacitación,
Reuniones internas, Licencia, Feriado) **a confirmar**; puede variar por proyecto.

**Contrato fijo por analista** (cliente UDD siempre):
- Renato García → contrato 84 "1540_Célula QA - Renato García"
- Braulio Benardis → contrato 82 "1541_Célula QA - Braulio Benardis"
- José Flores → contrato 83 "1541_Célula QA - José Flores"

**Regla de negocio:** máximo **8 horas por día** por analista.

## ⚠️ Sin idempotencia del lado de FlowPilot

Se enviaron 4 POST y se crearon **4 entradas distintas** (ids 35220–35223). FlowPilot
**no deduplica**. Por lo tanto qa_metrics debe:
- Llevar un `FlowpilotSyncLog` por (analista, fecha) con los ids creados.
- Antes de reenviar un día ya sincronizado: o bien **bloquear**, o bien **borrar
  los ids previos** (vía DELETE) y recrear. Decisión de diseño en la spec.

## Cómo lo registra el equipo QA hoy (observado)

Todas las entradas reales fueron: `entity_type=Contrato`, cliente **UDD**, contrato
**"1540_Célula QA - Renato García"**, tipo de tarea **QA**, variando solo
**descripción + horas**:
- "Ejecucion Tema 1" 4h, "Ejecucion Tema2" 3h, "Reunion Desarollo" 0.5h,
  "Reunion Interna Inovabiz" 0.5h → total 8h.

**Insight de mapeo:** `entity_type` + `client` + `contract`/`project` + `task_type`
son **constantes por asignación del analista**. Lo que varía por entrada es
**descripción + horas**. Entonces cada ítem del día en qa_metrics (una Activity o un
bloque de trabajo en HU) → una entrada FlowPilot con esa descripción y sus horas,
bajo el destino fijo {entity, client, contract/project, task_type} del analista.
