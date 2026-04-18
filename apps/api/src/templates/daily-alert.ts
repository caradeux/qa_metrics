export interface DailyAlertContext {
  testerName: string;
  dayLabel: string;
  missingAssignments: Array<{
    storyExternalId: string | null;
    storyTitle: string;
    projectName: string;
    status: string;
  }>;
  appUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "No Iniciado",
  ANALYSIS: "Análisis",
  TEST_DESIGN: "Diseño",
  WAITING_QA_DEPLOY: "Esperando Deploy QA",
  EXECUTION: "Ejecución",
  RETURNED_TO_DEV: "Devuelto a Desarrollo",
};

export function renderDailyAlert(ctx: DailyAlertContext): { subject: string; html: string } {
  const subject = `⚠️ QA Metrics · No registraste movimientos el ${ctx.dayLabel}`;

  const rows = ctx.missingAssignments
    .map((a) => {
      const label = a.storyExternalId
        ? `${escapeHtml(a.storyExternalId)} — ${escapeHtml(a.storyTitle)}`
        : escapeHtml(a.storyTitle);
      const statusLabel = STATUS_LABELS[a.status] ?? escapeHtml(a.status);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${label}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(a.projectName)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${statusLabel}</td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1F3864;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.7;">QA Metrics</p>
      <h1 style="margin:4px 0 0;font-size:20px;">Recordatorio de registro diario</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p>Hola <strong>${escapeHtml(ctx.testerName)}</strong>,</p>
      <p>El siguiente avance no fue registrado el <strong>${escapeHtml(ctx.dayLabel)}</strong>. Registra lo que trabajaste (o indica cero si no avanzaste) para mantener las métricas al día.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;text-align:left;">
            <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Historia</th>
            <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Proyecto</th>
            <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(ctx.appUrl)}/mi-semana"
           style="display:inline-block;background:#1F3864;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">
          Ir a Mi Semana
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        Si no trabajaste ayer (licencia, feriado, vacaciones), avisa al admin o al PM del proyecto.<br/>
        Si ya registraste y este correo es un error, contáctanos.
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
