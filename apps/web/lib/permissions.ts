export const RESOURCES = [
  "users",
  "roles",
  "clients",
  "projects",
  "stories",
  "story-status",
  "cycles",
  "testers",
  "assignments",
  "phases",
  "records",
  "dashboard",
  "gantt",
  "reports",
  "reports-occupation",
  "reports-stories",
  "audit",
  "holidays",
  "activities",
  "activity-categories",
  "flowpilot-control",
  "flowpilot-mappings",
  "flowpilot-config",
  "flowpilot-hours",
] as const;

export const ACTIONS = ["create", "read", "update", "delete"] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];

export const RESOURCE_LABELS: Record<Resource, string> = {
  users: "Usuarios",
  roles: "Roles",
  clients: "Clientes",
  projects: "Proyectos",
  stories: "Historias de Usuario",
  "story-status": "Cambio de Estado HU",
  cycles: "Ciclos",
  testers: "Testers",
  assignments: "Asignaciones",
  phases: "Fases de Ejecución",
  records: "Registros Diarios",
  dashboard: "Dashboard",
  gantt: "Planificación (Gantt)",
  reports: "Reportes",
  "reports-occupation": "Reporte de Ocupación",
  "reports-stories": "Reporte Conglomerado HU",
  audit: "Auditoría de fechas",
  holidays: "Feriados",
  activities: "Actividades",
  "activity-categories": "Categorías de actividad",
  "flowpilot-control": "Control FlowPilot",
  "flowpilot-mappings": "Homologación FlowPilot",
  "flowpilot-config": "Configuración FlowPilot (URL)",
  "flowpilot-hours": "Registro de Horas",
};

export const ACTION_LABELS: Record<Action, string> = {
  create: "Crear",
  read: "Ver",
  update: "Editar",
  delete: "Eliminar",
};

// Agrupación de recursos por dominio, para que la matriz de permisos sea escaneable.
// Cualquier recurso no listado aquí se agrupa automáticamente en "Otros".
export const RESOURCE_GROUPS: { title: string; resources: Resource[] }[] = [
  { title: "Gestión", resources: ["users", "roles", "clients", "projects", "stories", "story-status", "cycles", "testers", "assignments", "phases"] },
  { title: "Registros y actividades", resources: ["records", "activities", "activity-categories", "holidays"] },
  { title: "Vistas y reportes", resources: ["dashboard", "gantt", "reports", "reports-occupation", "reports-stories", "audit"] },
  { title: "FlowPilot", resources: ["flowpilot-control", "flowpilot-mappings", "flowpilot-config", "flowpilot-hours"] },
];

export const permKey = (r: string, a: string) => `${r}:${a}`;
