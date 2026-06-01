// apps/api/scripts/flowpilot-spike.ts
// Throwaway — valida que el envío server-to-server a FlowPilot funcione sin navegador.
// Ejecutar (PowerShell), NO commitear credenciales:
//   $env:FP_EMAIL="<email>"; $env:FP_PASS="<pass>"; npx tsx apps/api/scripts/flowpilot-spike.ts
const BASE =
  process.env.FP_BASE ??
  "https://wap-asignacion-semanal-horas-qa.azurewebsites.net";

function firstCookie(setCookie: string | null): string {
  return (setCookie ?? "").split(";")[0]?.trim() ?? "";
}

async function main() {
  const email = process.env.FP_EMAIL;
  const password = process.env.FP_PASS;
  if (!email || !password) {
    throw new Error("Faltan FP_EMAIL / FP_PASS en el entorno");
  }

  // 1) GET login → cookie inicial + csrf_token del HTML
  const g = await fetch(`${BASE}/auth/login`, { redirect: "manual" });
  let cookie = firstCookie(g.headers.get("set-cookie"));
  const html = await g.text();
  const csrf = html.match(/name="csrf_token"[^>]*value="([^"]+)"/)?.[1];
  console.log("[1] GET login:", g.status, "| csrf?", !!csrf, "| cookie?", !!cookie);

  // 2) POST login (form-urlencoded)
  const form = new URLSearchParams({
    csrf_token: csrf ?? "",
    email,
    password,
    submit: "Iniciar Sesión",
  });
  const p = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie },
    body: form.toString(),
    redirect: "manual",
  });
  cookie = firstCookie(p.headers.get("set-cookie")) || cookie;
  console.log("[2] POST login:", p.status, "(esperado 302)");

  // 3) Crear entrada de prueba (Interno/Vacaciones 0.5h para no ensuciar datos reales)
  const create = await fetch(`${BASE}/api/time-entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      cookie,
    },
    body: JSON.stringify({
      entity_type: "project",
      client_id: "18",
      task_type_id: "20",
      date: "2026-06-01",
      hours_worked: 0.5,
      time_start: null,
      time_end: null,
      description: "SPIKE qa_metrics — borrar",
      project_id: "54",
      contract_id: null,
      azure_work_item_id: null,
      workitem_name: null,
      story_task_id: null,
      bug_id: null,
      test_case_id: null,
    }),
  });
  const created = (await create.json().catch(() => null)) as any;
  const id = created?.data?.id;
  console.log("[3] POST create:", create.status, "(esperado 201) | id:", id);

  // 4) Probar DELETE del id creado (CONFIRMAR endpoint/método)
  if (id) {
    const del = await fetch(`${BASE}/api/time-entries/${id}`, {
      method: "DELETE",
      headers: { "X-Requested-With": "XMLHttpRequest", cookie },
    });
    console.log("[4] DELETE:", del.status, "|", (await del.text()).slice(0, 120));
  } else {
    console.log("[4] DELETE: omitido (no hubo id creado)");
  }

  // 5) ¿De dónde sale el user id propio? ¿y los task-types?
  const dash = await fetch(`${BASE}/api/dashboard-summary`, {
    headers: { "X-Requested-With": "XMLHttpRequest", cookie },
  });
  console.log("[5] dashboard-summary:", dash.status, "|", (await dash.text()).slice(0, 300));
}

main().catch((e) => {
  console.error("SPIKE error:", e);
  process.exit(1);
});
