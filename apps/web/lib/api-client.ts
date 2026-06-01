const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiClient<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(options?.headers || {})),
  };
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
    } else {
      if (typeof window !== "undefined" && !path.startsWith("/api/auth/me")) {
        window.location.href = "/login";
      }
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    let message = "Error del servidor";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new ApiError(res.status, message);
  }

  // Handle blob responses (PDF, Excel, PowerPoint)
  const contentType = res.headers.get("content-type") || "";
  if (
    contentType.includes("application/pdf") ||
    contentType.includes("spreadsheetml") ||
    contentType.includes("presentationml") ||
    contentType.includes("octet-stream")
  ) {
    return res.blob() as any;
  }

  return res.json();
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    let message = "Login failed";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new ApiError(res.status, message);
  }
  return res.json(); // { user }
}

export async function apiLogout() {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {}
}

export async function apiMe() {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

export { ApiError };

// ---------- Actividades ----------

export type ActivityCategoryBandType =
  | "USER_MEETING"
  | "DEV_MEETING"
  | "TRAINING"
  | "ABSENCE"
  | "OTHER";

export interface ActivityCategory {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
  bandType: ActivityCategoryBandType;
}

export interface Activity {
  id: string;
  testerId: string;
  categoryId: string;
  assignmentId: string | null;
  startAt: string;
  endAt: string;
  notes: string | null;
  category: ActivityCategory;
  tester?: { id: string; name: string; projectId: string };
  assignment?: { id: string; story: { id: string; title: string } } | null;
}

export const activityCategoriesApi = {
  list: (activeOnly = false) =>
    apiClient<ActivityCategory[]>(`/api/activity-categories${activeOnly ? "?activeOnly=true" : ""}`),
  create: (data: { name: string; color?: string | null; active?: boolean; bandType?: ActivityCategoryBandType }) =>
    apiClient<ActivityCategory>("/api/activity-categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; color: string | null; active: boolean; bandType: ActivityCategoryBandType }>) =>
    apiClient<ActivityCategory>(`/api/activity-categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) =>
    apiClient<void>(`/api/activity-categories/${id}`, { method: "DELETE" }),
};

export const activitiesApi = {
  list: (params: { testerId?: string; projectId?: string; assignmentId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return apiClient<Activity[]>(`/api/activities?${qs.toString()}`);
  },
  create: (data: {
    testerId: string; categoryId: string; assignmentId?: string | null;
    startAt: string; endAt: string; notes?: string | null;
  }) => apiClient<Activity>("/api/activities", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{
    categoryId: string; assignmentId: string | null; startAt: string; endAt: string; notes: string | null;
  }>) => apiClient<Activity>(`/api/activities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => apiClient<void>(`/api/activities/${id}`, { method: "DELETE" }),
};

export interface OccupationRow {
  testerId: string;
  testerName: string;
  periodDays: number;
  workdays: number;
  capacityHours: number;
  activityHours: number;
  byCategory: Array<{ categoryId: string; name: string; color: string | null; hours: number }>;
  byAssignment: Array<{ assignmentId: string; storyTitle: string; hours: number }>;
  productiveHoursEstimate: number;
  occupationPct: number;
  overallocated: boolean;
}

export const occupationApi = {
  get: (params: { testerIds?: string[]; projectId?: string; from: string; to: string }) => {
    const qs = new URLSearchParams();
    qs.set("from", params.from);
    qs.set("to", params.to);
    if (params.testerIds?.length) qs.set("testerIds", params.testerIds.join(","));
    if (params.projectId) qs.set("projectId", params.projectId);
    return apiClient<OccupationRow[]>(`/api/reports/occupation?${qs.toString()}`);
  },
};

// ---------- Temas que requieren gestión (popup de bienvenida) ----------

export type AttentionReason = "returned" | "on_hold" | "stuck" | "overdue";

export interface AttentionItem {
  assignmentId: string;
  storyId: string;
  storyTitle: string;
  externalId: string | null;
  projectId: string;
  projectName: string;
  clientName: string;
  testerName: string | null;
  status: string;
  daysInStatus: number;
  endDate: string | null;
  reasons: AttentionReason[];
}

export const attentionApi = {
  list: () => apiClient<{ count: number; items: AttentionItem[] }>("/api/assignments/attention"),
};

// ---------- FlowPilot homologación ----------

export interface FlowpilotCatalogItem { id: number; name: string; }

export interface FlowpilotMapping {
  id: string;
  userId: string;
  kind: string;
  entityType: "contract" | "project";
  clientId: number;
  clientName: string;
  contractId: number | null;
  projectId: number | null;
  entityName: string;
  taskTypeId: number;
  taskTypeName: string;
}

export type FlowpilotMappingInput = Omit<FlowpilotMapping, "id">;

export const flowpilotApi = {
  connectionStatus: () =>
    apiClient<{ email: string | null; valid: boolean; lastValidatedAt: string | null }>(`/api/flowpilot/connection`),
  connect: (password: string) =>
    apiClient<{ valid: boolean; email?: string }>(`/api/flowpilot/connection`, { method: "POST", body: JSON.stringify({ password }) }),
  clients: (entityType: "contract" | "project") =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/clients?entityType=${entityType}`).then((r) => r.data),
  contracts: (clientId: number) =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/contracts?clientId=${clientId}`).then((r) => r.data),
  projects: (clientId: number) =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/projects?clientId=${clientId}`).then((r) => r.data),
  taskTypes: () =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/task-types`).then((r) => r.data),
  listMappings: (userId: string) =>
    apiClient<FlowpilotMapping[]>(`/api/flowpilot/mappings?userId=${userId}`),
  upsertMapping: (data: FlowpilotMappingInput) =>
    apiClient<FlowpilotMapping>(`/api/flowpilot/mappings`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMapping: (id: string) =>
    apiClient<void>(`/api/flowpilot/mappings/${id}`, { method: "DELETE" }),
  preview: (date: string) =>
    apiClient<FlowpilotDayPreview>(`/api/flowpilot/preview?date=${date}`),
  sync: (date: string, entries: { kind: string; description: string; hours: number }[]) =>
    apiClient<{ ok: boolean; entryIds?: number[] }>(`/api/flowpilot/sync`, { method: "POST", body: JSON.stringify({ date, entries }) }),
  pending: (days = 14) =>
    apiClient<{ days: { date: string; hasData: boolean; sent: boolean }[] }>(`/api/flowpilot/pending?days=${days}`),
};

export interface FlowpilotPreviewEntry {
  kind: string; description: string; hours: number;
  source: "activity" | "story"; refId: string; mapped: boolean;
}
export interface FlowpilotDayPreview {
  date: string; capacityHours: number; totalHours: number;
  allMapped: boolean; withinCap: boolean;
  entries: FlowpilotPreviewEntry[];
  sync: { status: string; sentAt: string; hoursTotal: number } | null;
}
