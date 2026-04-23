# Rediseño Profesional de Reportes QA (PPTX)

- **Fecha:** 2026-04-22
- **Autor:** Líder QA (jcaradeux@inovabiz.com)
- **Estado:** Aprobado para planificación
- **Scope:** `apps/api` — módulo de reportes PPTX (weekly + monthly + yearly)

## 1. Objetivo

Reemplazar la generación actual de PPTX (basada en manipulación XML de `weekly-template.pptx`) por un módulo profesional construido con `pptxgenjs` que:

1. Proyecte la **identidad visual de Inovabiz** (paleta extraída del logo SVG oficial + tipografía Inter).
2. Incluya la **ocupación detallada** por proyecto con horas desglosadas en reuniones, inducciones, diseño y ejecución.
3. Presente una **curva "siempre ocupados"** (área apilada) que evidencia que los analistas usan el 100% de su capacidad contratada, diluyendo la impresión de "tiempos muertos".
4. Incorpore **complejidad de diseño y ejecución** por Historia de Usuario, más el **número de regresión** vigente — para desmontar la narrativa de "QA lento" cuando en realidad la HU volvió de desarrollo.
5. Mantenga las tres vistas temporales (semanal, mensual, anual) unificadas bajo una sola arquitectura.

## 2. Audiencia y modelo de entrega

- **Audiencia primaria:** cliente externo. El reporte es narrativa de valor que justifica facturación.
- **Audiencia secundaria:** interna (dirección + Líder QA). El contenido interno va en un **anexo separado** (slide divisor + slides por analista) que el Líder QA decide proyectar o no.
- **Sin flag de modo** en la URL: un único deck autocontenido. El divisor visual marca dónde termina lo cliente-facing.

## 3. Identidad visual

### 3.1 Paleta Inovabiz (del logo SVG real)

| Uso | HEX |
|---|---|
| Verde Inovabiz primario | `#25CF6C` |
| Verde Inovabiz claro | `#94CE94` |
| Cyan Inovabiz | `#04E5F3` |
| Azul Inovabiz | `#08ACF4` |
| Navy profundo (portadas, divisor anexo) | `#0F172A` |
| Navy UI (headers, contenedores) | `#1F2937` |
| Blanco | `#FFFFFF` |
| Gris claro | `#F9FAFB` |
| Text primario | `#111827` |
| Text muted | `#6B7280` |
| Amber warning (R2, fases pendientes) | `#F59E0B` |
| Red danger (defectos, R3+, bloqueos) | `#EF4444` |
| Purple accent (actividades no-productivas) | `#A855F7` |

### 3.2 Gradientes oficiales (reutilizables)

- Gradient verde: `#25CF6C → #94CE94` (135°) — para cards hero y KPIs positivos
- Gradient cyan/azul: `#04E5F3 → #08ACF4` (135°) — para portada y bordes

### 3.3 Tipografía

- **Inter** (embebida en el PPTX)
- Fallbacks: Segoe UI → Arial → sans-serif

### 3.4 Logo

- Asset: `apps/api/src/assets/inovabiz-logo.svg` (copiado desde `qa-metrics/docs/logo-inovabiz.svg`)
- Uso: portada (grande, centrado), headers de proyecto (pequeño esquina sup. izq.), cierre (grande)

## 4. Estructura del deck

Para **N proyectos** y **M analistas** en el scope:

### Bloque A — Portada y resumen (2 slides)

- **Slide 1 — Portada**
  - Fondo navy `#0F172A` full-bleed
  - Franja vertical lateral con gradient verde Inovabiz
  - Logo Inovabiz arriba izq. + texto **"QA Metrics by Inovabiz"** (cyan, spaced, bold) como lockup de marca
  - Título: "Informe de Avance QA"
  - Subtítulo contextual según periodo:
    - Weekly: `Semana del DD al DD de <mes> YYYY`
    - Monthly: `<Mes> YYYY`
    - Yearly: `Año YYYY`
  - Cliente (si `?clientId=`), fecha de emisión, "Preparado por Inovabiz"

- **Slide 2 — Resumen ejecutivo**
  - 4 tarjetas KPI grandes con gradient sutil:
    - Casos Diseñados
    - Casos Ejecutados
    - Defectos Detectados
    - Ratio Ejec/Dis %
  - Barra inferior con 3 mini-KPIs narrativos:
    - `X HUs completadas en 1ª regresión` (verde)
    - `Y HUs requirieron 2+ regresiones` (ámbar)
    - `Z% capacidad del equipo utilizada` (cyan)
  - Footer: periodo cubierto + `N proyectos` + `M analistas`

### Bloque B — Mini-deck por proyecto (4 slides × N proyectos)

- **Slide B1 — Portada del proyecto**
  - Header navy con nombre del proyecto + chip del cliente
  - PM + analistas asignados con % allocation
  - 3 KPI cards del proyecto (Diseñados / Ejecutados / Defectos)
  - Mini-donut horizontal con distribución de estados del pipeline

- **Slide B2 — Detalle por Historia de Usuario**
  - Tabla con columnas: `HU | Regresión | Compl. Diseño | Compl. Ejec. | Estado | Diseñados | Ejecutados | Defectos`
  - Regresión: chip coloreado (R1 neutro, R2 `#F59E0B`, R3+ `#EF4444`)
  - Complejidad: semáforo compacto (HIGH rojo, MEDIUM ámbar, LOW verde)
  - Estado: chip con color existente (mapeo de `STATUS_LABEL`)

- **Slide B3 — Curva "siempre ocupados"** ⭐ *(pieza narrativa central)*
  - Gráfico de áreas apiladas, tamaño completo
  - Eje X: días L-V (weekly) | semanas ISO (monthly) | meses (yearly)
  - Eje Y: horas acumuladas del equipo del proyecto
  - Línea guía superior: capacidad total contratada
  - Bandas apiladas (bottom → top):
    1. Horas en fase `ANALYSIS` (azul claro `#94C7E3`)
    2. Horas en fase `TEST_DESIGN` (azul `#08ACF4`)
    3. Horas en fase `EXECUTION` (verde Inovabiz `#25CF6C`)
    4. Horas `Activity · Reunión con usuario` (cyan `#04E5F3`)
    5. Horas `Activity · Reunión con desarrollo` (purple `#A855F7`)
    6. Horas `Activity · Inducción/Capacitación` (ámbar `#F59E0B`)
    7. Horas productivas no imputadas (gris neutro `#6B7280`)
  - Leyenda lateral + mini-KPI *"100% de la capacidad contratada ejecutada"*

- **Slide B4 — Matriz de complejidad**
  - Izq: bubble chart 3×3 (Diseño × Ejecución). Cada burbuja = 1 HU, tamaño = `designed + executed`. Jitter para evitar solape. Color por estado.
  - Der: leyenda + top-3 "HUs de mayor esfuerzo acumulado" como tarjetas

### Bloque C — Consolidado de portafolio (3 slides)

- **Slide C1 — Pipeline global** (donut de estados agregado)
- **Slide C2 — Comparativa Diseñados vs Ejecutados por proyecto** (barras agrupadas)
- **Slide C3 — Tendencia acumulada**
  - Weekly: curva por día
  - Monthly: curva por semana
  - Yearly: curva por mes
  - Series: Diseñados, Ejecutados, Defectos (acumulados)

### Bloque D — Anexo interno (opt-out visual)

- **Slide D0 — Divisor**: fondo navy full, texto grande "ANEXO — Detalle interno de operación"
- **Slides D1..Dm — Un slide por analista**:
  - Donut de horas por categoría de Activity
  - Barra horizontal de ocupación % (semáforo)
  - Tabla de assignments del periodo con horas imputadas
  - Flag visual si `overallocated = true`
- **Slide final — Cierre Inovabiz**: logo grande, texto **"QA Metrics by Inovabiz"** bajo el logo (verde claro), "Gracias", contacto

**Total estimado para weekly con 5 proyectos y 4 analistas:** ~31 slides.

## 5. Datos y derivaciones

### 5.1 Curva "siempre ocupados" (slide B3) — por proyecto `P`

Para cada día `d` del periodo y cada tester `t` que tenga al menos un `Tester` en el proyecto `P`:

**Paso 1 — capacidad diaria del tester:**

```
capacidad(t, d) = 8h × (tester.allocation / 100)    si d es workday (no feriado, L-V)
                = 0                                   en otro caso
```

**Paso 2 — horas de Activity imputables al proyecto `P`:**

```
activityHours(t, d, categoría, P) =
  Σ hours(activity)  para activities que intersectan [d 00:00, d 24:00] y testerId = t y categoryId = categoría, donde:
    - Si activity.assignmentId != null y assignment pertenece a P → contribuyen 100% a P
    - Si activity.assignmentId != null y assignment pertenece a otro proyecto → 0 para P
    - Si activity.assignmentId == null (transversal) → contribuyen proporcional:
        share_P = (# phases active de t en P el día d) / (# phases active de t en cualquier proyecto el día d)
        contribución_P = hours(activity) × share_P
      (si el tester t no tiene phases activas en ningún proyecto el día d, share_P se reparte equitativo entre los proyectos donde t tiene Tester activo)
```

**Paso 3 — horas productivas del tester el día `d`:**

```
productiveHours(t, d) = max(0, capacidad(t, d) − Σ activityHours(t, d, *) sobre TODOS los proyectos)
```

**Paso 4 — reparto de `productiveHours(t, d)` entre fases, filtrado al proyecto `P`:**

```
phasesActivas(t, d, P) = AssignmentPhase donde:
    phase.startDate ≤ d ≤ phase.endDate
    y assignment.testerId = t
    y assignment.projectId = P (vía story → project)
    y assignment.status ∈ {REGISTERED, ANALYSIS, TEST_DESIGN, WAITING_QA_DEPLOY, EXECUTION, RETURNED_TO_DEV, WAITING_UAT, UAT}

phasesTotales(t, d) = phasesActivas del tester en CUALQUIER proyecto ese día

horasProyectoP(t, d) = productiveHours(t, d) × (#phasesActivas(t, d, P) / #phasesTotales(t, d))

horasFase(t, d, fase, P) = horasProyectoP(t, d) × (#phasesActivas(t, d, P) de tipo fase / #phasesActivas(t, d, P))
```

**Paso 5 — banda "Productivas no imputadas":**

Si `productiveHours(t, d) > 0` y `#phasesActivas(t, d, P) > 0` pero la proporción no cubre toda la capacidad del tester en el proyecto (por ejemplo, el tester trabaja también en otro proyecto), las horas NO asignadas a P **no aparecen** en la curva de P.

Si el tester tiene `Tester` activo en P pero ninguna phase activa en P ese día (y sí en otros proyectos) → se registran **0 horas para P** ese día en todas las bandas de fase.

Si el tester tiene `Tester` activo en P y ninguna phase activa en ningún proyecto → `productiveHours(t, d)` completa va a la banda "Productivas no imputadas" de P.

**Paso 6 — agregación al nivel proyecto:**

Suma de todas las bandas sobre los testers del proyecto por bucket temporal.

**Buckets temporales:**
- **Weekly:** 1 bucket por día (L-V) → 5 puntos
- **Monthly:** 1 bucket por semana ISO → 4-5 puntos
- **Yearly:** 1 bucket por mes → 12 puntos

**Invariante:** la suma de todas las bandas de un bucket debe ser ≤ `Σ capacidad(t, d)` sobre testers del proyecto para los días del bucket. Si es menor, la diferencia corresponde a capacidad del tester consumida por OTROS proyectos (lo cual es correcto: no inflamos la curva).

### 5.2 KPIs narrativos (slide 2)

- **`HUs en 1ª regresión completadas`**: `count(story)` donde `story.cycles.length === 1` y existe un assignment de esa cycle con `status = PRODUCTION`
- **`HUs con 2+ regresiones`**: `count(story)` donde `story.cycles.length ≥ 2`
- **`% capacidad utilizada`**: `Σ (activityHours + productiveHoursImputadas) / Σ capacidad` sobre todos los testers del scope

### 5.3 Regresión de la HU (columna en slide B2)

Etiqueta = `R{story.cycles.length}` — cuenta total histórica de `TestCycle` de la HU. Si la HU tiene 3 cycles (independiente de si todas tuvieron actividad), se etiqueta **R3**. Esto refleja cuántas veces la HU ha entrado a regresión por devoluciones de desarrollo.

Color del chip: `R1 → gris neutro (#6B7280)`, `R2 → ámbar (#F59E0B)`, `R3+ → rojo (#EF4444)`.

### 5.4 Matriz de complejidad (slide B4)

- Eje X: `designComplexity` (LOW/MEDIUM/HIGH)
- Eje Y: `executionComplexity` (LOW/MEDIUM/HIGH)
- Burbuja: 1 por HU, `size = designed + executed` del periodo
- Jitter de ±0.15 para evitar overlapping

### 5.5 Anexo por analista (slides D1..Dm)

Reutiliza `computeOccupationBatch(testerIds, from, to)` en `apps/api/src/lib/occupation.ts:121`. No requiere lógica nueva de datos.

## 6. Arquitectura técnica

### 6.1 Dependencias nuevas

- `pptxgenjs` (~3.12+) — reemplaza el approach XML directo
- `chartjs-node-canvas` — ya existe, se mantiene para charts complejos (bubble, stacked area)

### 6.2 Archivos nuevos

```
apps/api/src/
├── assets/
│   └── inovabiz-logo.svg           # copiado desde qa-metrics/docs/logo-inovabiz.svg
├── lib/pptx/
│   ├── theme.ts                    # paleta, fuentes, constantes de layout
│   ├── report-data.ts              # agregación Prisma → ReportSpec
│   ├── occupation-chart.ts         # genera PNG de curva "siempre ocupados"
│   ├── complexity-matrix.ts        # genera PNG de bubble chart 3×3
│   ├── portfolio-charts.ts         # pipeline donut, bars, trend line
│   ├── slides/
│   │   ├── cover.ts
│   │   ├── executive-summary.ts
│   │   ├── project-cover.ts
│   │   ├── project-hu-table.ts
│   │   ├── project-occupation-curve.ts
│   │   ├── project-complexity-matrix.ts
│   │   ├── portfolio-pipeline.ts
│   │   ├── portfolio-comparison.ts
│   │   ├── portfolio-trend.ts
│   │   ├── appendix-divider.ts
│   │   ├── analyst-detail.ts
│   │   └── closing.ts
│   └── build-report-pptx.ts        # orquestador: recibe ReportSpec + period
└── routes/reports.routes.ts        # endpoints reutilizan buildReportPptx
```

### 6.3 Archivos retirados

- `apps/api/src/lib/weekly-pptx.ts` — eliminar
- `apps/api/src/lib/weekly-charts.ts` — eliminar (se migran las funciones útiles a `lib/pptx/portfolio-charts.ts`)
- `apps/api/src/assets/weekly-template.pptx` — eliminar

### 6.4 Contrato del orquestador

```ts
export type ReportPeriod = "weekly" | "monthly" | "yearly";

export interface ReportSpec {
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  clientFilter?: { id: string; name: string };
  projects: ProjectReportData[];
  analysts: AnalystOccupation[];   // viene de computeOccupationBatch
  portfolioKPIs: {
    designed: number;
    executed: number;
    defects: number;
    ratioPct: number;
    husFirstCycle: number;
    husMultipleCycles: number;
    capacityUtilizationPct: number;
    totalAnalysts: number;
  };
}

export async function buildReportPptx(spec: ReportSpec): Promise<Buffer>;
```

### 6.5 Endpoints (sin cambio de URL)

- `GET /reports/weekly-pptx?weekStart=YYYY-MM-DD&clientId=X`
- `GET /reports/monthly-pptx?month=YYYY-MM&clientId=X`
- `GET /reports/yearly-pptx?year=YYYY&clientId=X`

Cada endpoint:
1. Resuelve scope por rol (igual que hoy, usando `isClientPm`, `isAnalyst`, `analystProjectIds`).
2. Agrega datos con una sola función compartida (`report-data.ts`).
3. Llama a `buildReportPptx(spec)` → Buffer.
4. Envía respuesta con mismo filename pattern actual.

### 6.6 Permisos

Mantiene `requirePermission("reports", "read")` igual que hoy. Sin recursos nuevos en BD.

### 6.7 Scope de acceso

- **CLIENT_PM**: ve solo sus proyectos (filtro existente) → el Bloque D del anexo se **oculta completo** para este rol.
- **QA_ANALYST**: ve solo proyectos donde tiene un Tester vinculado → Bloque D solo muestra su propio slide.
- **QA_LEAD / ADMIN**: ve todo el scope del cliente dueño de la cuenta.

## 7. Diferencias entre weekly / monthly / yearly

| Aspecto | Weekly | Monthly | Yearly |
|---|---|---|---|
| Buckets curva ocupación | 5 días | 4-5 semanas ISO | 12 meses |
| Slide C3 (tendencia) | Curva por día | Curva por semana | Curva por mes |
| Portada subtítulo | `Semana del DD al DD de <mes> YYYY` | `<Mes> YYYY` | `Año YYYY` |
| Filename | `Informe_QA_Semanal_YYYY-MM-DD.pptx` | `Informe_QA_Mensual_YYYY-MM.pptx` | `Informe_QA_Anual_YYYY.pptx` |

El resto de slides es **idéntico** en layout; solo cambia el rango de datos.

## 8. Datos sensibles y seguridad

- **Anexo interno:** se suprime del deck si `role = CLIENT_PM`. Para `QA_ANALYST`, solo incluye su propio slide.
- **Tokens ADO cifrados:** no se incluyen jamás en el PPTX (invariante existente).
- **Costos / tarifas:** no se incluyen en ninguna versión del deck.

## 9. Invariantes respetados

- No se escribe a Azure DevOps (solo lectura desde Prisma).
- Modalidad de proyecto no se modifica.
- Scope filtering por rol se replica igual al de `/weekly-pptx` actual.

## 10. Out of scope (explícitamente)

- Modificación del schema Prisma (no se añaden campos a `DailyRecord`).
- Cambios al modelo de `Activity` o `ActivityCategory`.
- Nuevas rutas o cambios de URL.
- Exportación a PDF.
- Envío por email automatizado.
- UI de preview del reporte en `apps/web`.

## 11. Criterios de aceptación

1. Los tres endpoints devuelven un `.pptx` válido que abre en PowerPoint 2019+ y Google Slides sin warnings.
2. El logo Inovabiz aparece en la portada, cierre y cada header de proyecto.
3. La curva "siempre ocupados" suma las 7 bandas y nunca supera la capacidad total.
4. Cada HU en la tabla muestra regresión + semáforo de complejidad.
5. La matriz de complejidad es legible con hasta 30 HUs por proyecto (con jitter).
6. El anexo interno está claramente separado con slide divisor.
7. El tiempo de generación del weekly con 5 proyectos y 4 analistas se mantiene **bajo 15 segundos**.
8. CLIENT_PM no ve slides del anexo interno.
