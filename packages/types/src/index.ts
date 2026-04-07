// ── Auth DTOs ──────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface PermissionInfo {
  id: string;
  action: string;
  resource: string;
}

// ── API Error ──────────────────────────────────────────────
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// ── Entity DTOs ────────────────────────────────────────────
export interface ClientDTO {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  clientId: string;
  client?: ClientDTO;
  jiraUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TesterDTO {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CycleDTO {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  projectId: string;
  project?: ProjectDTO;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentDTO {
  id: string;
  cycleId: string;
  testerId: string;
  cycle?: CycleDTO;
  tester?: TesterDTO;
  createdAt: string;
  updatedAt: string;
}

// ── Metrics DTOs ───────────────────────────────────────────
export interface KPIs {
  totalDesigned: number;
  totalExecuted: number;
  totalDefects: number;
  executionRatio: number;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  designed: number;
  executed: number;
  defects: number;
}

export interface TesterSummary {
  testerId: string;
  testerName: string;
  designed: number;
  executed: number;
  defects: number;
  ratio: number;
}

export interface DefectDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface CaseTypeDistribution {
  functional: { designed: number; executed: number };
  regression: { designed: number; executed: number };
  smoke: { designed: number; executed: number };
  exploratory: { designed: number; executed: number };
}
