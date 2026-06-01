import type {
  FlowpilotSession, FlowpilotCatalogItem, FlowpilotEntityType,
  FlowpilotEntryInput, FlowpilotEntry,
} from "./types.js";

function firstCookie(setCookie: string | null): string {
  return (setCookie ?? "").split(";")[0]?.trim() ?? "";
}

export class FlowpilotClient {
  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string): Promise<FlowpilotSession> {
    const g = await fetch(`${this.baseUrl}/auth/login`, { redirect: "manual" });
    const initCookie = firstCookie(g.headers.get("set-cookie"));
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
    const authCookie = firstCookie(p.headers.get("set-cookie")) || initCookie;
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
      const txt = await r.text();
      throw new Error(`FlowPilot createEntry → ${r.status}: ${txt.slice(0, 200)}`);
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
