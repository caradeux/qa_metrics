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
