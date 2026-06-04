# Filtro por cliente en Carga diaria — Diseño

**Fecha:** 2026-06-03
**Rama:** `feature/carga-diaria-filtro-cliente`

## Problema

La vista **Admin → Carga diaria** (`/admin/carga-diaria`) lista a **todos** los analistas QA activos
con algún Tester vinculado, sin distinción de cliente. Con pocos analistas es manejable, pero el
equipo va a crecer y la lista única se vuelve desordenada e ineficiente para revisar el cumplimiento
por cliente. Se necesita poder **segmentar la vista por cliente**.

## Objetivo

Agregar un selector de **Cliente** que filtre los analistas mostrados a los que trabajan en ese
cliente, recalculando KPIs y contadores sobre el subconjunto, sin recargar la página. El envío masivo
de recordatorios debe respetar el cliente filtrado.

Fuera de alcance: acotar el detalle interno de cada analista (sus HU/actividades se siguen mostrando
completas, aunque pertenezcan a otros clientes); cambios de modelo de datos; permisos por líder.

## Modelo de datos relevante (existente, sin cambios)

- `Client (1) → (N) Project` (`Project.clientId`)
- `Project (1) → (N) Tester` (`Tester.projectId`) — **un Tester pertenece a un solo proyecto**
- `Tester.userId` → `User` (analista). Un **User puede tener varios Testers**, en proyectos de
  **distintos clientes**.

Por lo tanto, la relación analista→cliente es de muchos a muchos derivada:
`User → testers[] → project → client`. Un analista puede aparecer bajo más de un cliente.

## Diseño

### Enfoque: filtrado en el frontend

El backend agrega a cada fila la lista de clientes del analista; el frontend arma el selector y filtra
en vivo. Se prefiere sobre re-consultar el backend por cliente porque el volumen de analistas es chico
y el filtrado instantáneo (KPIs/contadores recalculados sin recarga) da mejor UX.

### Backend — `GET /api/admin/daily-load` (`apps/api/src/routes/admin.routes.ts`)

- Extender el `select` de `users` para incluir el cliente de cada tester:
  `testers: { select: { id: true, project: { select: { client: { select: { id, name } } } } } }`.
- Por cada row, derivar `clients: { id, name }[]` (únicos por id, ordenados por nombre) a partir de
  los testers del analista.
- Agregar al objeto de respuesta un campo top-level `clients: { id, name }[]` con la unión de todos
  los clientes presentes en las rows (ordenado por nombre), para poblar el selector sin un segundo
  request.
- El resto de la respuesta (date, isNonBusinessDay, rows[...]) no cambia.

### Backend — `POST /api/admin/send-daily-reminders` (mismo archivo)

- Aceptar query param opcional `clientId`.
- Si viene, restringir el conjunto de analistas/testers considerados a los que tienen Tester en un
  proyecto de ese cliente (mismo criterio que la vista). Sin `clientId`, comportamiento actual: todos
  los pendientes del día.
- Validación: `clientId` es un string opcional. Si no matchea ningún analista con Tester (cliente
  inexistente o sin analistas), el endpoint devuelve `testersNotified: 0` (no es error duro),
  consistente con el flujo actual cuando no hay pendientes.

### Frontend — `apps/web/app/(app)/admin/carga-diaria/page.tsx`

- Nuevos tipos: `DailyLoadRow` suma `clients: { id: string; name: string }[]`; `DailyLoadResponse`
  suma `clients: { id: string; name: string }[]`.
- Nuevo estado `clientId: string | "all"` (default `"all"`).
- Nuevo control **Cliente**: un `<select>` ubicado junto a los chips de estado (Todos/Pendientes/
  Completos). Opciones: "Todos los clientes" + `data.clients` ordenados. Se elige `<select>` sobre
  chips porque escala mejor a muchos clientes.
- Orden de filtrado: **cliente primero**, luego estado. Es decir, se computa `clientFilteredRows`
  (rows cuyo `clients` incluye `clientId`, o todas si `"all"`), y sobre ese subconjunto se calculan
  `summary` (KPIs), los contadores de los chips y `visibleRows`.
- El botón "Recordar pendientes (N)": N refleja los pendientes del subconjunto filtrado; al enviar,
  agrega `&clientId=<clientId>` a la llamada cuando `clientId !== "all"`.
- Si el cliente seleccionado deja de existir al cambiar de fecha (analista sin testers ese día), el
  filtro cae a `"all"` de forma segura (si `clientId` no está en `data.clients`, tratar como `"all"`).

## Comportamiento esperado

- Default sin tocar nada: idéntico a hoy (todos los analistas, "Todos los clientes").
- Al elegir un cliente: la lista, los 3 KPIs y los contadores de chips reflejan solo los analistas de
  ese cliente; el detalle de cada analista sigue completo.
- Un analista en 2 clientes aparece al filtrar por cualquiera de los dos.
- "Recordar pendientes" envía solo a los pendientes del cliente visible.

## Testing

- Backend: caso unit/integración de `daily-load` que verifica que `clients` por row y top-level se
  derivan correctamente cuando un analista tiene testers en >1 cliente.
- Backend: `send-daily-reminders?clientId=X` solo notifica analistas de X; sin `clientId`, a todos.
- Frontend: verificación manual del filtrado instantáneo (KPIs/contadores/botón) — seguir patrón de
  pruebas existente del repo.

## Sin migraciones

No se modifica el schema de Prisma.
