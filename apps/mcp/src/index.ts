import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { api, ApiError } from "./api.js";
import { apiUrl } from "./session.js";

/**
 * Todas las escrituras pasan por la API de QA Metrics (no por la BD), asi se
 * aplican las mismas validaciones, permisos y aislamiento por cliente que en
 * la web. Los listados devuelven proyecciones compactas para no inflar el
 * contexto del modelo.
 */

const server = new McpServer({ name: "qa-metrics", version: "0.1.0" });

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");
const COMPLEXITY = z.enum(["LOW", "MEDIUM", "HIGH"]);
const STATUS = z.enum([
  "REGISTERED",
  "ANALYSIS",
  "TEST_DESIGN",
  "WAITING_QA_DEPLOY",
  "EXECUTION",
  "RETURNED_TO_DEV",
  "UAT",
  "PRODUCTION",
  "ON_HOLD",
]);

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    const data = await fn();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    const msg =
      err instanceof ApiError
        ? `Error ${err.status} de la API: ${JSON.stringify(err.body)}`
        : err instanceof Error
          ? err.message
          : String(err);
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}

const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
const READ = { readOnlyHint: true, openWorldHint: true };

// ---------------------------------------------------------------- sesion

server.registerTool(
  "whoami",
  {
    description: "Muestra el usuario autenticado y la URL de la API (produccion) a la que escribe el MCP.",
    annotations: READ,
  },
  () => run(async () => ({ apiUrl: apiUrl(), ...(await api<object>("GET", "/api/auth/me")) })),
);

// ---------------------------------------------------------------- clientes

server.registerTool(
  "listar_clientes",
  { description: "Lista los clientes del usuario.", annotations: READ },
  () =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/clients");
      return rows.map((c) => ({ id: c.id, name: c.name, proyectos: c._count?.projects }));
    }),
);

server.registerTool(
  "crear_cliente",
  {
    description: "Crea un cliente nuevo (PRODUCCION). Verifica antes con listar_clientes que no exista.",
    inputSchema: { name: z.string().min(1).max(200) },
    annotations: WRITE,
  },
  ({ name }) => run(() => api("POST", "/api/clients", { name })),
);

// ---------------------------------------------------------------- proyectos

server.registerTool(
  "listar_proyectos",
  {
    description: "Lista proyectos (opcionalmente de un cliente) con sus testers y conteo de HUs.",
    inputSchema: { clientId: z.string().optional() },
    annotations: READ,
  },
  ({ clientId }) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/projects", undefined, { clientId });
      return rows.map((p) => ({
        id: p.id,
        name: p.name,
        cliente: p.client?.name,
        clientId: p.clientId,
        modality: p.modality,
        projectManager: p.projectManager?.name ?? null,
        testers: p.testers?.map((t: any) => ({ id: t.id, name: t.name, allocation: t.allocation })),
        hus: p._count?.stories,
      }));
    }),
);

server.registerTool(
  "crear_proyecto",
  {
    description:
      "Crea un proyecto en un cliente existente (PRODUCCION). Verifica antes con listar_proyectos que no exista uno con el mismo nombre.",
    inputSchema: {
      name: z.string().min(1).max(200),
      clientId: z.string().min(1),
      modality: z.enum(["MANUAL", "AZURE_DEVOPS", "AUTOMATION"]).default("MANUAL"),
      projectManagerId: z.string().nullable().optional().describe("Usuario con rol CLIENT_PM"),
    },
    annotations: WRITE,
  },
  (input) => run(() => api("POST", "/api/projects", input)),
);

// ---------------------------------------------------------------- testers

server.registerTool(
  "listar_analistas",
  {
    description:
      "Lista usuarios con rol QA_ANALYST (opcionalmente asociados a un cliente) con su disponibilidad. Sirve para obtener el userId al agregar un tester.",
    inputSchema: { clientId: z.string().optional() },
    annotations: READ,
  },
  ({ clientId }) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/users", undefined, { role: "QA_ANALYST", clientId });
      return rows.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        active: u.active,
        clientes: u.assignedClients?.map((c: any) => c.name),
        allocationAvailable: u.allocationAvailable,
      }));
    }),
);

server.registerTool(
  "listar_testers",
  {
    description: "Lista los testers (analistas vinculados) de un proyecto. El testerId se usa en asignaciones y registros.",
    inputSchema: { projectId: z.string().min(1) },
    annotations: READ,
  },
  ({ projectId }) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/testers", undefined, { projectId });
      return rows.map((t) => ({
        testerId: t.id,
        name: t.name,
        email: t.user?.email,
        userId: t.user?.id,
        allocation: t.allocation,
      }));
    }),
);

server.registerTool(
  "agregar_tester",
  {
    description:
      "Vincula un analista QA (userId de listar_analistas) a un proyecto (PRODUCCION). El analista debe estar asociado al cliente del proyecto.",
    inputSchema: {
      projectId: z.string().min(1),
      userId: z.string().min(1),
      allocation: z.number().int().min(1).max(100).optional().describe("% de dedicacion, default 100"),
    },
    annotations: WRITE,
  },
  (input) => run(() => api("POST", "/api/testers", input)),
);

// ---------------------------------------------------------------- HUs y ciclos

server.registerTool(
  "listar_hus",
  {
    description: "Lista las historias de usuario (HU) de un proyecto con su asignacion/estado actual.",
    inputSchema: { projectId: z.string().min(1) },
    annotations: READ,
  },
  ({ projectId }) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/stories", undefined, { projectId });
      return rows.map((s) => ({
        id: s.id,
        externalId: s.externalId,
        title: s.title,
        designComplexity: s.designComplexity,
        executionComplexity: s.executionComplexity,
        ciclos: s.cycles?.map((c: any) => ({ id: c.id, name: c.name })),
        actual: s.currentAssignment
          ? {
              assignmentId: s.currentAssignment.id,
              status: s.currentAssignment.status,
              tester: s.currentAssignment.tester?.name,
              cycleId: s.currentAssignment.cycleId,
            }
          : null,
      }));
    }),
);

server.registerTool(
  "crear_hu",
  {
    description: "Crea una historia de usuario en un proyecto (PRODUCCION). Verifica antes con listar_hus que no exista.",
    inputSchema: {
      projectId: z.string().min(1),
      title: z.string().min(1).max(500),
      externalId: z.string().nullable().optional().describe("ID externo, p. ej. numero de la HU en ADO/Jira"),
      designComplexity: COMPLEXITY.optional(),
      executionComplexity: COMPLEXITY.optional(),
    },
    annotations: WRITE,
  },
  (input) => run(() => api("POST", "/api/stories", input)),
);

server.registerTool(
  "listar_ciclos",
  {
    description: "Lista ciclos de prueba de una HU (storyId) o de todo un proyecto (projectId).",
    inputSchema: { storyId: z.string().optional(), projectId: z.string().optional() },
    annotations: READ,
  },
  ({ storyId, projectId }) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/cycles", undefined, { storyId, projectId });
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        storyId: c.storyId,
        startDate: c.startDate,
        endDate: c.endDate,
        asignaciones: c._count?.assignments,
      }));
    }),
);

server.registerTool(
  "crear_ciclo",
  {
    description: "Crea un ciclo de prueba para una HU (PRODUCCION). Las fechas deben ser dias habiles.",
    inputSchema: {
      storyId: z.string().min(1),
      name: z.string().min(1).max(200).describe('p. ej. "Ciclo 1"'),
      startDate: ISO_DATE.optional(),
      endDate: ISO_DATE.optional(),
    },
    annotations: WRITE,
  },
  (input) => run(() => api("POST", "/api/cycles", input)),
);

// ---------------------------------------------------------------- asignaciones

server.registerTool(
  "listar_asignaciones",
  {
    description: "Lista asignaciones (tester + HU + ciclo) filtrando por proyecto, tester, ciclo o estado.",
    inputSchema: {
      projectId: z.string().optional(),
      testerId: z.string().optional(),
      cycleId: z.string().optional(),
      status: STATUS.optional(),
    },
    annotations: READ,
  },
  (query) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/assignments", undefined, query);
      return rows.map((a) => ({
        assignmentId: a.id,
        tester: a.tester?.name,
        testerId: a.testerId,
        hu: a.story?.title,
        storyId: a.storyId,
        ciclo: a.cycle?.name,
        cycleId: a.cycleId,
        status: a.status,
        startDate: a.startDate?.slice(0, 10),
        endDate: a.endDate?.slice(0, 10) ?? null,
        phases: a.phases?.map((p: any) => ({
          phase: p.phase,
          startDate: p.startDate?.slice(0, 10),
          endDate: p.endDate?.slice(0, 10),
        })),
      }));
    }),
);

server.registerTool(
  "crear_asignacion",
  {
    description:
      "Asigna un tester a una HU en un ciclo (PRODUCCION). Sin asignacion no se pueden cargar ejecuciones. Fechas en dias habiles; si se envian fases, las fechas de la asignacion se derivan de ellas.",
    inputSchema: {
      testerId: z.string().min(1),
      storyId: z.string().min(1),
      cycleId: z.string().min(1),
      startDate: ISO_DATE.optional(),
      endDate: ISO_DATE.nullable().optional(),
      status: STATUS.optional().describe("Default REGISTERED"),
      notes: z.string().nullable().optional(),
      phases: z
        .array(
          z.object({
            phase: z.enum(["ANALYSIS", "TEST_DESIGN", "EXECUTION"]),
            startDate: ISO_DATE,
            endDate: ISO_DATE,
          }),
        )
        .max(3)
        .optional(),
    },
    annotations: WRITE,
  },
  (input) => run(() => api("POST", "/api/assignments", input)),
);

server.registerTool(
  "actualizar_asignacion",
  {
    description:
      "Cambia estado, fechas o notas de una asignacion (PRODUCCION). Cambiar fechas puede requerir 'reason'.",
    inputSchema: {
      assignmentId: z.string().min(1),
      status: STATUS.optional(),
      startDate: ISO_DATE.optional(),
      endDate: ISO_DATE.nullable().optional(),
      notes: z.string().nullable().optional(),
      reason: z.string().optional().describe("Motivo del cambio de fechas"),
    },
    annotations: { ...WRITE, idempotentHint: true },
  },
  ({ assignmentId, ...body }) => run(() => api("PUT", `/api/assignments/${assignmentId}`, body)),
);

// ---------------------------------------------------------------- ejecuciones (registros diarios)

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

server.registerTool(
  "ver_semana",
  {
    description:
      "Muestra, para un tester y una semana, las asignaciones activas, los dias cargables y los registros ya cargados (disenados/ejecutados/defectos).",
    inputSchema: {
      testerId: z.string().min(1),
      fecha: ISO_DATE.describe("Cualquier dia de la semana; se usa su lunes"),
    },
    annotations: READ,
  },
  ({ testerId, fecha }) =>
    run(() =>
      api("GET", "/api/daily-records", undefined, {
        testerId,
        weekStart: mondayOf(fecha),
        includeIdle: "true",
      }),
    ),
);

server.registerTool(
  "cargar_ejecuciones",
  {
    description:
      "Carga registros diarios de un tester (PRODUCCION): casos disenados, ejecutados y defectos por asignacion y fecha. " +
      "Si ya existe un registro para esa asignacion y fecha, sus valores se REEMPLAZAN (no se suman). " +
      "Reglas de la API: sin fechas futuras ni feriados, y la fecha debe estar dentro del rango de la asignacion. " +
      "Devuelve los valores previos para que se pueda verificar el cambio.",
    inputSchema: {
      testerId: z.string().min(1),
      entries: z
        .array(
          z.object({
            assignmentId: z.string().min(1),
            date: ISO_DATE,
            designed: z.number().int().min(0),
            executed: z.number().int().min(0),
            defects: z.number().int().min(0),
            notes: z.string().max(2000).nullable().optional(),
          }),
        )
        .min(1),
    },
    annotations: { ...WRITE, idempotentHint: true },
  },
  ({ testerId, entries }) =>
    run(async () => {
      const weeks = [...new Set(entries.map((e) => mondayOf(e.date)))];
      const previous = new Map<string, unknown>();
      for (const weekStart of weeks) {
        const week = await api<any>("GET", "/api/daily-records", undefined, {
          testerId,
          weekStart,
          includeIdle: "true",
        });
        for (const a of week.assignments ?? []) {
          for (const r of a.records ?? []) previous.set(`${a.id}|${r.date}`, r);
        }
      }

      const result = await api("POST", "/api/daily-records/bulk", { testerId, entries });
      return {
        result,
        cambios: entries.map((e) => ({
          assignmentId: e.assignmentId,
          date: e.date,
          antes: previous.get(`${e.assignmentId}|${e.date}`) ?? null,
          ahora: { designed: e.designed, executed: e.executed, defects: e.defects, notes: e.notes },
        })),
      };
    }),
);

// ---------------------------------------------------------------- automatizacion

server.registerTool(
  "listar_lineas_prueba",
  {
    description: "Lista las lineas de prueba (suites de automatizacion) de un proyecto con su responsable activo.",
    inputSchema: { projectId: z.string().min(1) },
    annotations: READ,
  },
  ({ projectId }) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/test-lines", undefined, { projectId });
      return rows.map((l) => ({
        testLineId: l.id,
        name: l.name,
        externalId: l.externalId,
        complexity: l.complexity,
        responsable: l.assignments?.[0]
          ? { assignmentId: l.assignments[0].id, testerId: l.assignments[0].testerId, name: l.assignments[0].tester?.name }
          : null,
      }));
    }),
);

server.registerTool(
  "crear_linea_prueba",
  {
    description: "Crea una linea de prueba (suite de automatizacion) en un proyecto (PRODUCCION).",
    inputSchema: {
      projectId: z.string().min(1),
      name: z.string().min(1).max(200),
      externalId: z.string().nullable().optional(),
      complexity: COMPLEXITY.optional(),
    },
    annotations: WRITE,
  },
  (input) => run(() => api("POST", "/api/test-lines", input)),
);

server.registerTool(
  "listar_asignaciones_automatizacion",
  {
    description: "Lista asignaciones de automatizacion (tester + linea de prueba) por testerId o testLineId.",
    inputSchema: { testerId: z.string().optional(), testLineId: z.string().optional() },
    annotations: READ,
  },
  (query) =>
    run(async () => {
      const rows = await api<any[]>("GET", "/api/automation-assignments", undefined, query);
      return rows.map((a) => ({
        assignmentId: a.id,
        tester: a.tester?.name,
        testerId: a.testerId,
        linea: a.testLine?.name,
        testLineId: a.testLineId,
        status: a.status,
        startDate: a.startDate?.slice(0, 10),
        endDate: a.endDate?.slice(0, 10) ?? null,
        registros: a._count?.records,
      }));
    }),
);

server.registerTool(
  "crear_asignacion_automatizacion",
  {
    description: "Asigna un tester del proyecto a una linea de prueba (PRODUCCION).",
    inputSchema: {
      testerId: z.string().min(1),
      testLineId: z.string().min(1),
      startDate: ISO_DATE,
      endDate: ISO_DATE.nullable().optional(),
      status: z.enum(["ACTIVE", "MAINTENANCE", "PAUSED", "DONE"]).optional(),
      notes: z.string().nullable().optional(),
    },
    annotations: WRITE,
  },
  (input) => run(() => api("POST", "/api/automation-assignments", input)),
);

server.registerTool(
  "ver_semana_automatizacion",
  {
    description: "Muestra, para un tester y una semana, sus lineas de automatizacion y los registros ya cargados.",
    inputSchema: {
      testerId: z.string().min(1),
      fecha: ISO_DATE.describe("Cualquier dia de la semana; se usa su lunes"),
    },
    annotations: READ,
  },
  ({ testerId, fecha }) =>
    run(() =>
      api("GET", "/api/automation-records", undefined, { testerId, weekStart: mondayOf(fecha), includeIdle: "true" }),
    ),
);

server.registerTool(
  "cargar_automatizacion",
  {
    description:
      "Carga registros diarios de automatizacion de un tester (PRODUCCION): scripts creados/refactorizados/corregidos y ejecuciones totales/pasadas/fallidas. " +
      "Si ya existe registro para esa asignacion y fecha, se REEMPLAZA. Sin fechas futuras ni feriados; pasados+fallidos <= total. " +
      "Devuelve los valores previos.",
    inputSchema: {
      testerId: z.string().min(1),
      entries: z
        .array(
          z.object({
            assignmentId: z.string().min(1),
            date: ISO_DATE,
            scriptsCreated: z.number().int().min(0).default(0),
            scriptsRefactored: z.number().int().min(0).default(0),
            scriptsFixed: z.number().int().min(0).default(0),
            execTotal: z.number().int().min(0).default(0),
            execPassed: z.number().int().min(0).default(0),
            execFailed: z.number().int().min(0).default(0),
            notes: z.string().max(2000).nullable().optional(),
          }),
        )
        .min(1),
    },
    annotations: { ...WRITE, idempotentHint: true },
  },
  ({ testerId, entries }) => run(() => loadAutomation(testerId, entries)),
);

async function loadAutomation(testerId: string, entries: { assignmentId: string; date: string }[]) {
  const previous = new Map<string, unknown>();
  for (const weekStart of new Set(entries.map((e) => mondayOf(e.date)))) {
    const week = await api<any>("GET", "/api/automation-records", undefined, { testerId, weekStart, includeIdle: "true" });
    for (const a of week.assignments ?? []) {
      for (const r of a.records ?? []) previous.set(`${a.id}|${r.date}`, r);
    }
  }
  const result = await api("POST", "/api/automation-records/bulk", { testerId, entries });
  return {
    result,
    cambios: entries.map((e) => ({
      assignmentId: e.assignmentId,
      date: e.date,
      antes: previous.get(`${e.assignmentId}|${e.date}`) ?? null,
      ahora: e,
    })),
  };
}

server.registerTool(
  "listar_feriados",
  {
    description: "Lista feriados registrados de un ano (no se pueden cargar ejecuciones en esos dias).",
    inputSchema: { year: z.number().int().min(2020).max(2100) },
    annotations: READ,
  },
  ({ year }) => run(() => api("GET", "/api/holidays", undefined, { year: String(year) })),
);

await server.connect(new StdioServerTransport());
