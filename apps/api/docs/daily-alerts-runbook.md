# Daily Alerts — Runbook

## Setup inicial (una sola vez)

### 1. Verificar dominio en Resend

1. Crear cuenta en https://resend.com (plan free).
2. Ir a **Domains** → **Add Domain** → `qametrics.cl`.
3. Copiar los 3 DNS records (SPF, DKIM, MX) que muestra Resend.
4. Agregarlos en el panel DNS de `qametrics.cl`.
5. Volver a Resend y esperar que el dominio quede **Verified**.
6. Crear API key en **API Keys** con permiso "Full access" (o "Send emails").

### 2. Env vars en Coolify

En la app del API, agregar como secrets:

| Var | Valor |
|---|---|
| `RESEND_API_KEY` | `re_xxx` (la API key recién generada) |
| `ALERT_FROM_EMAIL` | `notificaciones@qametrics.cl` |
| `ALERT_REPLY_TO` | `admin@qametrics.com` (o la casilla del líder QA) |
| `INTERNAL_SECRET` | Random 32+ chars (`openssl rand -hex 32`) |
| `APP_URL` | `https://qametrics.cl` |

Redeploy la API para que tome las vars.

### 3. Scheduled Task en Coolify

- **Comando**:
  ```
  curl -X POST https://qametrics.cl/api/internal/run-daily-alerts \
       -H "X-Internal-Secret: $INTERNAL_SECRET"
  ```
- **Schedule (cron)**: `0 9 * * 1-5`
- **Timezone**: `America/Santiago`

### 4. Smoke test antes del primer cron real

Manual (con dryRun):
```
curl -s -X POST "https://qametrics.cl/api/internal/run-daily-alerts?dryRun=true" \
     -H "X-Internal-Secret: <secret>" | jq .
```

Debe devolver el JSON con `testersNotified` ≥ 0 y ningún correo real enviado.

## Rollback

Deshabilitar la Scheduled Task en Coolify. El código queda deployado pero ya no se ejecuta.

## Troubleshooting

- **Resend 422 "domain not verified"**: faltan DNS records. Revisar panel Resend.
- **Correos van a spam**: verificar SPF + DKIM en herramientas tipo mail-tester.com.
- **403 del endpoint**: secret mismatch entre la Scheduled Task y la env var del API.
- **`skipped: true` en un día hábil**: la fecha de hoy cayó en `Holiday` de la DB. Revisar `prisma.holiday`.
