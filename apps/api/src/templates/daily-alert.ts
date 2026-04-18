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

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  REGISTERED: { bg: "#F3F4F6", fg: "#4B5563" },
  ANALYSIS: { bg: "#DBEAFE", fg: "#1E40AF" },
  TEST_DESIGN: { bg: "#E0E7FF", fg: "#3730A3" },
  WAITING_QA_DEPLOY: { bg: "#FEF3C7", fg: "#92400E" },
  EXECUTION: { bg: "#D1FAE5", fg: "#065F46" },
  RETURNED_TO_DEV: { bg: "#FEE2E2", fg: "#991B1B" },
};

export function renderDailyAlert(ctx: DailyAlertContext): { subject: string; html: string } {
  const count = ctx.missingAssignments.length;
  const plural = count === 1 ? "pendiente" : "pendientes";
  const subject = `QA Metrics · Registro pendiente del ${ctx.dayLabel}`;
  const preheader = `${count} ${plural} sin registrar. Actualiza en menos de 1 minuto.`;

  const rows = ctx.missingAssignments
    .map((a, idx) => {
      const label = a.storyExternalId
        ? `<span style="color:#6B7280;font-weight:500;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;margin-right:6px;">${escapeHtml(a.storyExternalId)}</span>${escapeHtml(a.storyTitle)}`
        : escapeHtml(a.storyTitle);
      const statusLabel = STATUS_LABELS[a.status] ?? a.status;
      const statusColor = STATUS_COLORS[a.status] ?? { bg: "#F3F4F6", fg: "#4B5563" };
      const zebra = idx % 2 === 0 ? "#FFFFFF" : "#FAFBFC";
      return `
        <tr>
          <td style="padding:14px 20px;border-bottom:1px solid #F1F2F4;background:${zebra};font-size:14px;color:#111827;line-height:1.45;">${label}</td>
          <td style="padding:14px 16px;border-bottom:1px solid #F1F2F4;background:${zebra};font-size:13px;color:#4B5563;white-space:nowrap;">${escapeHtml(a.projectName)}</td>
          <td style="padding:14px 20px 14px 16px;border-bottom:1px solid #F1F2F4;background:${zebra};text-align:right;white-space:nowrap;">
            <span style="display:inline-block;background:${statusColor.bg};color:${statusColor.fg};font-size:11px;font-weight:600;letter-spacing:.02em;padding:4px 10px;border-radius:999px;">${escapeHtml(statusLabel)}</span>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>QA Metrics</title>
</head>
<body style="margin:0;padding:0;background:#EEF1F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF1F6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(17,24,39,.04),0 12px 32px rgba(17,24,39,.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#1F3864 0%,#2E5FA3 100%);padding:28px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#C7D6F2;">QA Metrics</td>
                  <td align="right" style="font-size:12px;color:#C7D6F2;">${escapeHtml(ctx.dayLabel)}</td>
                </tr>
              </table>
              <h1 style="margin:14px 0 0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-.01em;line-height:1.3;">Registro diario pendiente</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#D3DEEE;line-height:1.5;">Hola ${escapeHtml(ctx.testerName)}, falta confirmar tu avance del día anterior.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F9FC;border:1px solid #E4E8EF;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <div style="font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#6B7280;">Historias sin registrar</div>
                          <div style="font-size:32px;font-weight:700;color:#1F3864;line-height:1.1;margin-top:4px;">${count}</div>
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <a href="${escapeHtml(ctx.appUrl)}/mi-semana" style="display:inline-block;background:#1F3864;color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;letter-spacing:.01em;box-shadow:0 2px 4px rgba(31,56,100,.18);">Registrar ahora →</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;">
              <div style="font-size:13px;color:#4B5563;line-height:1.6;margin:12px 0 8px;">
                Registra lo trabajado (o 0 si no avanzaste) para mantener las métricas al día.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E4E8EF;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background:#F7F9FC;">
                    <th align="left" style="padding:10px 20px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;border-bottom:1px solid #E4E8EF;">Historia</th>
                    <th align="left" style="padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;border-bottom:1px solid #E4E8EF;">Proyecto</th>
                    <th align="right" style="padding:10px 20px 10px 16px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;border-bottom:1px solid #E4E8EF;">Estado</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 28px;">
              <div style="font-size:12px;color:#6B7280;line-height:1.6;">
                ¿No trabajaste ayer (licencia, feriado, vacaciones)? Avisa a tu PM o al admin.<br/>
                Este correo se genera automáticamente cada mañana hábil.
              </div>
            </td>
          </tr>
        </table>
        <div style="max-width:640px;margin:16px auto 0;font-size:11px;color:#8B94A2;text-align:center;line-height:1.5;">
          QA Metrics · <a href="${escapeHtml(ctx.appUrl)}" style="color:#8B94A2;text-decoration:none;">qametrics.cl</a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
