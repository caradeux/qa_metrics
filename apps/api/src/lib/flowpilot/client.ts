import type {
  FlowpilotSession, FlowpilotCatalogItem, FlowpilotEntityType,
  FlowpilotEntryInput, FlowpilotEntry,
} from "./types.js";

function extractSessionCookie(headers: Headers): string {
  // Headers.getSetCookie() returns ALL Set-Cookie values (Node >=18.14).
  const all = headers.getSetCookie?.() ?? [];
  const session = all.find((c) => c.startsWith("session="));
  if (session) return session.split(";")[0]?.trim() ?? "";
  // Fallback: single-value header (e.g. test mocks using headers.set).
  const single = headers.get("set-cookie");
  if (single && single.startsWith("session=")) return single.split(";")[0]?.trim() ?? "";
  return "";
}

export class FlowpilotClient {
  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string): Promise<FlowpilotSession> {
    const g = await fetch(`${this.baseUrl}/auth/login`, { redirect: "manual" });
    const initCookie = extractSessionCookie(g.headers);
    const html = await g.text();
    const csrf = html.match(/name="csrf_token"[^>]*value="([^"]+)"/)?.[1] ?? "";

    const form = new URLSearchParams({
      csrf_token: csrf, email, password, submit: "Iniciar Sesión",
    });
    const p = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: initCookie },
      body: form.toString(),
      redirect: "manual",
    });
    if (p.status !== 302) {
      throw new Error("FlowPilot login falló (credenciales inválidas o flujo cambiado)");
    }
    const authCookie = extractSessionCookie(p.headers) || initCookie;
    return { cookie: authCookie };
  }

  private headers(session: FlowpilotSession, json = false): Record<string, string> {
    return {
      "X-Requested-With": "XMLHttpRequest",
      cookie: session.cookie,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  private async getCatalog(session: FlowpilotSession, path: string): Promise<FlowpilotCatalogItem[]> {
    const r = await fetch(`${this.baseUrl}${path}`, { headers: this.headers(session) });
    if (!r.ok) throw new Error(`FlowPilot catálogo ${path} → ${r.status}`);
    const json = (await r.json()) as { data?: FlowpilotCatalogItem[] };
    return json.data ?? [];
  }

  listClientsByEntityType(session: FlowpilotSession, entityType: FlowpilotEntityType) {
    return this.getCatalog(session, `/api/clients-by-entity-type?entity_type=${entityType}`);
  }
  listContractsByClient(session: FlowpilotSession, clientId: number) {
    return this.getCatalog(session, `/api/contracts/by-client/${clientId}`);
  }
  listProjectsByClient(session: FlowpilotSession, clientId: number) {
    return this.getCatalog(session, `/api/projects/by-client/${clientId}`);
  }

  async listTaskTypes(session: FlowpilotSession): Promise<FlowpilotCatalogItem[]> {
    const r = await fetch(`${this.baseUrl}/api/task_types`, { headers: this.headers(session) });
    if (!r.ok) throw new Error(`FlowPilot /api/task_types → ${r.status}`);
    const json = (await r.json()) as { task_types?: FlowpilotCatalogItem[] };
    return json.task_types ?? [];
  }

  async createEntry(session: FlowpilotSession, input: FlowpilotEntryInput): Promise<FlowpilotEntry> {
    const body = {
      entity_type: input.entityType,
      client_id: String(input.clientId),
      task_type_id: String(input.taskTypeId),
      date: input.date,
      hours_worked: input.hoursWorked,
      time_start: null, time_end: null,
      description: input.description,
      azure_work_item_id: null, workitem_name: null, story_task_id: null,
      bug_id: null, test_case_id: null,
      contract_id: input.contractId != null ? String(input.contractId) : null,
      project_id: input.projectId != null ? String(input.projectId) : null,
    };
    const r = await fetch(`${this.baseUrl}/api/time-entries`, {
      method: "POST", headers: this.headers(session, true), body: JSON.stringify(body),
    });
    if (r.status !== 201) {
      throw new Error(`FlowPilot createEntry falló (HTTP ${r.status})`);
    }
    const json = (await r.json()) as { data: any };
    const d = json.data;
    return {
      id: d.id, clientId: d.client_id, clientName: d.client_name, date: d.date,
      description: d.description, hoursWorked: d.hours_worked, taskTypeName: d.task_type_name,
    };
  }

  async deleteEntry(session: FlowpilotSession, entryId: number): Promise<void> {
    const r = await fetch(`${this.baseUrl}/api/time-entries/${entryId}`, {
      method: "DELETE", headers: this.headers(session),
    });
    if (!r.ok) throw new Error(`FlowPilot deleteEntry ${entryId} → ${r.status}`);
  }
}
