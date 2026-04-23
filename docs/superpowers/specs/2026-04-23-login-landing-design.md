# Landing pública en /login

**Fecha:** 2026-04-23
**Estado:** Diseño aprobado, pendiente de implementación
**Alcance:** Frontend (apps/web) únicamente

---

## Objetivo

Convertir la página `qametrics.cl/login` en una landing pública que:

1. Comunique el valor de QA Metrics a prospects comerciales (espejo resumido del brochure).
2. Mantenga al formulario de login visible sin pasos extra para usuarios existentes.
3. Refuerce la marca Inovabiz (logo en header y footer).

---

## Decisiones de alcance

- **Opción A de ruteo:** la landing vive en `/login`, no en `/`. `/` sigue redirigiendo a `/login` como hoy.
- **Opción 1 de integración:** hero dividido — panel izquierdo con el pitch + panel derecho con el formulario, siempre visibles en desktop.
- **Opción 2 de secciones:** landing estándar con 4 secciones (hero, qué resuelve, cómo funciona, roles) + footer.
- **Opción 2 de paleta:** se conserva la paleta azul corporativa actual del app (`#0D1B2A → #1F3864 → #2E5FA3`). El verde esmeralda del brochure no se adopta. El logo Inovabiz aporta el único toque de color distintivo (gradientes verde-azul originales).

---

## Estructura de la página

### A. Barra superior sticky (64px)

- **Izquierda:** logo Inovabiz (SVG inline, altura 28px, sin texto acompañante).
- **Derecha (desktop):** anchor links `Funcionalidades` · `Roles` · `Contacto` + botón fantasma `Iniciar sesión` (en desktop no hace scroll porque el form ya está visible; es afordancia).
- **Derecha (mobile):** los anchor links se ocultan y queda solo el botón `Iniciar sesión` que hace scroll suave hasta el form. No se implementa menú hamburguesa (fuera de alcance).
- Fondo: translúcido con backdrop-blur sobre el hero oscuro, opaco blanco al hacer scroll.

### B. Hero dividido (min-height calc(100vh − 64px))

**Desktop (≥ lg, 1024px):**
- Layout: flex horizontal, 52% panel oscuro izquierdo + 48% panel blanco derecho.
- Panel oscuro conserva exactamente el gradiente actual: `linear-gradient(160deg, #0D1B2A 0%, #1F3864 60%, #2E5FA3 100%)`.
- Se conservan los decorativos existentes (grid de puntos, barras chart, línea tendencia SVG, grid pulse-glow).
- El contenido del panel izquierdo cambia a:
  ```
  Kicker:    LA PLATAFORMA QA DE INOVABIZ
  Título:    QA Metrics
  Subtítulo: Métricas de calidad que hablan por tu equipo.
  Lead:      Centraliza la operación QA de todos tus proyectos en una
             sola plataforma. Dashboards en tiempo real, reportes
             automáticos por cliente y visibilidad del trabajo real
             de cada analista.
  Stats:     [4 roles · RBAC granular]
             [2 modalidades · Azure DevOps o Manual]
             [∞ clientes · Multi-tenant real]
  ```
- Panel derecho: fondo blanco. Formulario actual 100% intacto (labels, inputs underline, checkbox "Recordar mi correo", botón "Iniciar Sesión", mensajes de error, spinner).

**Mobile (< lg):**
- Panel oscuro colapsa a mini-hero arriba (~40vh) con solo kicker + título + subtítulo (sin stats en fila; apiladas si entran).
- Form completo debajo.

### C. Sección "¿Qué resuelve?" (`#funcionalidades`)

- Fondo blanco, padding vertical generoso (py-24 desktop, py-16 mobile).
- Kicker `PROBLEMA → SOLUCIÓN`, título `Del Excel disperso a una sola fuente de verdad.`
- Grid 2 columnas (1 en mobile):

  **Antes** (borde/acento rojo suave, ej. `#FEE2E2` fondo, `#DC2626` iconos X):
  - Un Excel por cliente
  - Horas estimadas sin respaldo
  - Fechas que cambian sin rastro
  - Reportes armados a mano

  **Con QA Metrics** (borde/acento azul corporativo `#1F3864`, checks):
  - Una plataforma para todos
  - Registro diario por analista
  - Auditoría completa de cambios
  - Dashboards y reportes en vivo

### D. Sección "Cómo funciona"

- Fondo `#F8FAFC` muy claro para diferenciarla de la sección anterior.
- Kicker `CAPACIDADES`, título corto.
- Grid 2×2 (desktop) / 1 columna (mobile) con 4 feature cards:

  1. **Multi-cliente · multi-proyecto** — Un dashboard por cliente con aislamiento real de datos. Cada PM ve solo lo suyo.
  2. **Azure DevOps + Manual** — Integración solo-lectura con ADO (API v7) o carga diaria vía formulario. Un modo por proyecto.
  3. **Dashboards y reportes** — Métricas diarias, ocupación del equipo, Gantt de asignaciones y reportes automáticos por cliente.
  4. **RBAC granular** — Permisos por recurso y acción. Admin, Líder QA, Analista y PM Cliente con alcances distintos y auditables.

- Cada card: icono SVG inline (no se añaden dependencias; siguiendo la convención del login actual), título en peso semibold, descripción en color `#6b7280`, borde fino con accent `#1F3864` a la izquierda.

### E. Sección "Para quién" (`#roles`)

- Fondo blanco.
- Kicker `ROLES`, título corto.
- Grid 4 columnas (desktop) / 2 (tablet) / 1 (mobile):

  - **A · Admin** — Configura la plataforma, roles y permisos. Ve todo.
  - **L · Líder QA** — Gestiona clientes, proyectos, ciclos y analistas.
  - **Q · Analista QA** — Registra su trabajo diario, gestiona sus stories y ciclos.
  - **P · PM Cliente** — Acceso solo-lectura a los proyectos de su cliente.

- Cada card: círculo con inicial (gradient azul corporativo), nombre del rol en mayúsculas con tracking, descripción breve.

### F. Footer (`#contacto`)

- Fondo `#0D1B2A` (mismo tono oscuro del hero izquierdo).
- Layout 2 columnas (colapsa a 1 en mobile):
  - **Izquierda:** logo Inovabiz grande (altura 44px) + tagline `Liberamos el potencial de tu empresa con IA y transformación digital.`
  - **Derecha:** link a `qametrics.cl` + `© 2026 Inovabiz`. No se incluye correo de contacto en esta iteración (el usuario lo definirá en ajustes post-implementación).
- Texto en tonos `#8BA4C4` sobre fondo oscuro para consistencia con el hero.

---

## Decisiones técnicas

### Archivos afectados

- `apps/web/app/(auth)/login/page.tsx` — reescritura completa de la página. Conserva:
  - `"use client"` directive
  - Toda la lógica de `useAuth`, `login`, `ApiError`, estado `email`/`password`/`remember`/`error`/`loading`
  - `useEffect` de prefill desde localStorage
  - `useEffect` de redirect al dashboard si ya está autenticado
  - El bloque `<form>` completo con sus inputs, checkbox, botón y animaciones existentes
- `apps/web/components/InovabizLogo.tsx` — nuevo componente React que inlinea el SVG del logo con props `className` y `variant` (`"full"` para el logotipo completo, tamaño header/footer). Evita depender del endpoint de la API.
- `apps/web/app/(auth)/layout.tsx` — sin cambios.
- Nada en `apps/api` cambia.

### Metadata SEO

En la misma `page.tsx` (o en un `metadata` export separado si Next 16 lo requiere en client components; verificar `node_modules/next/dist/docs/` antes):

```ts
title: "QA Metrics · Plataforma QA de Inovabiz"
description: "Centraliza la operación QA de todos tus proyectos. Dashboards, reportes y visibilidad del trabajo real de cada analista."
```

### Animaciones

- `fadeInUp` y `slideIn` (keyframes ya existentes en el login actual) se conservan y se aplican también a secciones B-E cuando entran al viewport (Intersection Observer en un pequeño hook o `useInView` si ya está instalado).
- Pulse glow del panel oscuro se conserva.
- Scroll suave global vía `scroll-behavior: smooth` en `<html>` (configurar en globals.css si aún no está).
- Hover en nav links: misma línea underline animada que usan los inputs del form (consistencia).

### Responsive

- Breakpoint único clave: `lg` (1024px).
- Panel oscuro usa `hidden lg:flex` → en mobile se reemplaza por un mini-hero (`lg:hidden`) con solo kicker + título + subtítulo apilados.
- Grids: `grid-cols-1 lg:grid-cols-2` (secciones C, D) o `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (sección E).

### Out of scope (explícitamente NO se hace)

- Cambios al flujo de autenticación, cookies, `useAuth`, backend.
- Rutas nuevas.
- Modificación del app interno `(app)/*`.
- i18n (todo en español).
- Tracking/analytics.
- Form de contacto comercial (el footer solo lleva anchor o email estático).
- Cambios en el brochure PDF existente.

---

## Contenido textual final (para implementar literal)

### Barra superior
- Links: `Funcionalidades`, `Roles`, `Contacto`
- CTA: `Iniciar sesión`

### Hero izquierdo
- Kicker: `LA PLATAFORMA QA DE INOVABIZ`
- Título: `QA Metrics`
- Subtítulo: `Métricas de calidad que hablan por tu equipo.`
- Lead: `Centraliza la operación QA de todos tus proyectos en una sola plataforma. Dashboards en tiempo real, reportes automáticos por cliente y visibilidad del trabajo real de cada analista.`
- Stats:
  - `4 roles` — `RBAC granular`
  - `2 modalidades` — `Azure DevOps o Manual`
  - `∞ clientes` — `Multi-tenant real`

### Sección "¿Qué resuelve?"
- Kicker: `PROBLEMA → SOLUCIÓN`
- Título: `Del Excel disperso a una sola fuente de verdad.`
- Lista "Antes":
  - `Un Excel por cliente`
  - `Horas estimadas sin respaldo`
  - `Fechas que cambian sin rastro`
  - `Reportes armados a mano`
- Lista "Con QA Metrics":
  - `Una plataforma para todos`
  - `Registro diario por analista`
  - `Auditoría completa de cambios`
  - `Dashboards y reportes en vivo`

### Sección "Cómo funciona"
- Kicker: `CAPACIDADES`
- Título: `Todo lo que tu operación QA necesita.`
- Cards (título + descripción):
  1. `Multi-cliente · multi-proyecto` — `Un dashboard por cliente con aislamiento real de datos. Cada PM ve solo lo suyo.`
  2. `Azure DevOps + Manual` — `Integración solo-lectura con ADO (API v7) o carga diaria vía formulario. Un modo por proyecto.`
  3. `Dashboards y reportes` — `Métricas diarias, ocupación del equipo, Gantt de asignaciones y reportes automáticos por cliente.`
  4. `RBAC granular` — `Permisos por recurso y acción. Admin, Líder QA, Analista y PM Cliente con alcances distintos y auditables.`

### Sección "Para quién"
- Kicker: `ROLES`
- Título: `Un rol para cada perfil del equipo.`
- Cards:
  - `A` · `Admin` — `Configura la plataforma, roles y permisos. Ve todo.`
  - `L` · `Líder QA` — `Gestiona clientes, proyectos, ciclos y analistas.`
  - `Q` · `Analista QA` — `Registra su trabajo diario, gestiona sus stories y ciclos.`
  - `P` · `PM Cliente` — `Acceso solo-lectura a los proyectos de su cliente.`

### Footer
- Tagline: `Liberamos el potencial de tu empresa con IA y transformación digital.`
- Meta: `qametrics.cl · © 2026 Inovabiz`

El usuario indicó que ajustes de copy se harán post-implementación.

---

## Criterios de aceptación

1. Al abrir `https://qametrics.cl/login` en desktop, se ve la landing completa con el formulario visible en el hero derecho sin scroll.
2. El usuario puede loguearse exactamente igual que antes (mismos endpoints, cookies, redirect a `/dashboard`).
3. Al hacer scroll, aparecen las 4 secciones en el orden descrito (B→C→D→E→F).
4. En mobile (<1024px), el panel oscuro se colapsa arriba y el form es usable sin scroll horizontal.
5. El logo de Inovabiz aparece en la barra superior y en el footer con sus gradientes originales.
6. Los links de la barra (`Funcionalidades`, `Roles`, `Contacto`) hacen scroll suave a sus secciones respectivas.
7. Un usuario ya autenticado sigue siendo redirigido a `/dashboard` automáticamente al abrir `/login`.
8. No hay cambios en el comportamiento del backend ni en ninguna otra ruta del app.
