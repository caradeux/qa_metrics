# Asociación analista↔cliente, especialidades y asignación sin tope

**Fecha:** 2026-06-25
**Estado:** Aprobado (diseño) — pendiente plan de implementación

## Problema

Hoy ocurren tres cosas no deseadas al asignar analistas de QA a proyectos:

1. **El % de ocupación bloquea la asignación.** El flujo de "asignación rápida"
   (`apps/web/app/(app)/projects/page.tsx:53`) llama a
   `/api/users?role=QA_ANALYST&minCapacity=50`, y el backend
   (`apps/api/src/routes/users.routes.ts:51-53`) **oculta** a cualquier analista
   con menos de 50% disponible. Un analista al 100% asignado
   (`allocationAvailable = 0`) y con `allowOverallocation = false` (default)
   **desaparece** del dropdown. Resultado: "cuando ya están al 100% no me aparecen
   para asignar a otros proyectos". El % en realidad es indicativo —el trabajo se
   ejecuta según disponibilidad— y **no debe impedir** asignar.

2. **No existe el concepto de analista asociado a cliente(s).** Un analista
   (`User`) puede tener `Tester` en proyectos de clientes distintos sin ninguna
   restricción. Se requiere que cada analista esté asociado a uno o varios
   clientes (ej: Jeremy ↔ Starken + Autofin) y que **solo** aparezca para asignar
   en proyectos de **esos** clientes. `Client.userId` ya existe pero representa al
   dueño/PM del cliente, no sirve para esto.

3. **No hay forma de registrar la especialidad** del analista (QA Manual /
   QA Automatizado / Performance). Existe un flag `isAutomation` aislado.

## Objetivo

- El % de ocupación deja de bloquear: siempre se puede asignar a un analista de QA.
- Relación nueva muchos-a-muchos **analista↔cliente**, gestionada desde la ficha
  del Usuario.
- Filtro **estricto** por cliente al asignar (UI + validación de backend).
- **Especialidades** multi-valor por analista (informativas por ahora), que
  consolidan el actual `isAutomation`.

## Decisiones de diseño

| Tema | Decisión |
|------|----------|
| Dónde se gestiona la asociación | Ficha del Usuario/Analista (multi-select de clientes) |
| Estrictez del filtro por cliente | Estricto: el dropdown solo muestra asociados y el backend rechaza asignar a un no asociado |
| Rol de las especialidades | Solo informativas por ahora (etiquetas); no filtran |
| Tope de ocupación | Solo informativo; nunca oculta ni bloquea |
| `isAutomation` | `specialties` pasa a ser la fuente de verdad; se sincroniza `isAutomation = specialties.includes(QA_AUTOMATION)` |

## Modelo de datos (`packages/database/prisma/schema.prisma`)

```prisma
enum Specialty {
  QA_MANUAL
  QA_AUTOMATION
  PERFORMANCE
}

model User {
  // ...campos existentes...
  isAutomation Boolean     @default(false) // se mantiene, derivado de specialties
  specialties  Specialty[] @default([])
  assignedClients Client[] @relation("AnalystClients")
}

model Client {
  // ...campos existentes...
  userId   String                 // dueño/PM (sin cambios)
  user     User      @relation(fields: [userId], references: [id])
  analysts User[]    @relation("AnalystClients")
}
```

- **M2M implícita** de Prisma para `AnalystClients` (tabla intermedia automática).
  Distinta de `Client.userId` (dueño/PM).
- `specialties` como **array de enum Postgres**.

### Migración + backfill
- Crear enum `Specialty`, columna `specialties`, columna/tabla M2M.
- Backfill: para cada `User` con `isAutomation = true`, agregar `QA_AUTOMATION` a
  `specialties`.
- Las asociaciones de cliente **arrancan vacías**: no se infieren de los testers
  existentes (evitar inventar vínculos). Se cargan manualmente desde la ficha.

## Cambios en el Backend (`apps/api`)

### `validators/user.validator.ts`
- Agregar a create y update:
  - `clientIds: z.array(z.string()).optional()`
  - `specialties: z.array(z.nativeEnum(Specialty)).optional()`
- `isAutomation` deja de recibirse del cliente; se deriva.

### `routes/users.routes.ts`
- **`GET /`**:
  - Incluir en la respuesta `assignedClients` (`{ id, name }[]`) y `specialties`.
  - Nuevo query param `?clientId=<id>`: si viene, filtrar a solo analistas
    asociados a ese cliente (`where.assignedClients = { some: { id: clientId } }`).
  - **Eliminar el filtro por `minCapacity`.** Se sigue calculando
    `allocationUsed` / `allocationAvailable` y se devuelven como info, pero
    **nunca** se excluye un usuario por capacidad. (Se puede retirar el manejo de
    `minCapacity` por completo.)
- **`POST /` y `PUT /:id`**:
  - Persistir `specialties`.
  - Sincronizar `isAutomation = specialties.includes("QA_AUTOMATION")`.
  - `set` de `assignedClients` con `clientIds` (`{ set: clientIds.map(id => ({ id })) }`).

### `routes/testers.routes.ts` (`POST`)
- **Regla estricta:** al crear un `Tester` con `userId` no nulo, verificar que ese
  `User` esté asociado al `client` del proyecto destino. Si no lo está, responder
  `400` con mensaje claro (ej. "El analista no está asociado a este cliente") y
  **no** crear el tester.
- El `userId` null (tester sin cuenta) sigue permitido.

## Cambios en el Frontend (`apps/web`)

### Ficha de Usuario (`app/(app)/users/new` y `app/(app)/users/[id]/edit`)
- **Multi-select de clientes asociados** (solo aplica/visible para rol analista QA).
- **Checks de especialidades**: QA Manual / QA Automatizado / Performance.
  El check de "QA Automatizado" **reemplaza** el actual de `isAutomation`.
- Enviar `clientIds` y `specialties` en el submit.

### Asignación rápida (`app/(app)/projects/page.tsx`)
- Cambiar la llamada de
  `/api/users?role=QA_ANALYST&minCapacity=50`
  a
  `/api/users?role=QA_ANALYST&clientId=<project.client.id>`.
- El dropdown ahora solo muestra analistas del cliente del proyecto; el % se
  muestra como info (ej. "70% disponible" / "ocupado") pero ninguno se oculta.

### Nuevo Tester (`app/(app)/projects/[id]/testers/new`)
- Filtrar igualmente por el cliente del proyecto
  (`/api/users?role=QA_ANALYST&clientId=<clienteDelProyecto>`). La página obtiene
  el cliente del proyecto vía la API de proyecto.
- Mantener la lógica actual de mostrar el % como advertencia, no como bloqueo.

### Listados de analistas
- Mostrar **especialidades como etiquetas** (badges) donde se listan analistas
  (informativo).

## Fuera de alcance

- La vista propia del analista ya está acotada hoy: `projects.routes.ts` solo le
  muestra proyectos donde es tester (`where.testers = { some: { userId } }`). No se
  modifica. La asociación analista↔cliente se usa para el dropdown de asignación y
  las etiquetas, **no** para ampliar lo que el analista ve.
- Las especialidades no filtran asignación (puede ser un follow-up).
- No se infieren asociaciones desde datos existentes.

## Criterios de aceptación

1. Un analista al 100% asignado **sí aparece** y **puede** ser asignado a otro
   proyecto (del cliente al que pertenece).
2. En el dropdown de asignación de un proyecto del cliente X, **solo** aparecen
   analistas asociados al cliente X.
3. Intentar asignar (vía API) un analista no asociado al cliente del proyecto
   devuelve `400` y no crea el tester.
4. La ficha del usuario permite asociar/quitar clientes y marcar especialidades, y
   esos cambios persisten.
5. Marcar "QA Automatizado" deja `isAutomation = true` en el `User` (track de
   automatización sigue funcionando).
6. Los analistas con `isAutomation = true` previos quedan con la especialidad
   `QA_AUTOMATION` tras la migración.
