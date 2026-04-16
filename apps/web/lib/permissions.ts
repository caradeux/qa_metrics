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
};

export const ACTION_LABELS: Record<Action, string> = {
  create: "Crear",
  read: "Ver",
  update: "Editar",
  delete: "Eliminar",
};

export const permKey = (r: string, a: string) => `${r}:${a}`;
