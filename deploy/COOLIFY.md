# Despliegue en Coolify — QA Metrics

Guía para desplegar el monorepo en Coolify preservando los datos (usuarios, clientes, proyectos, HU, asignaciones).

## Arquitectura

El stack son tres servicios independientes:

1. **PostgreSQL 16** (recurso gestionado de Coolify).
2. **API** (Node/Express) — `apps/api/Dockerfile`, puerto interno `8080`.
3. **Web** (Next.js) — `apps/web/Dockerfile`, puerto interno `3000`.

## Variables de entorno

### API (`apps/api`)
| Variable              | Ejemplo                                                | Notas                                                           |
|-----------------------|--------------------------------------------------------|-----------------------------------------------------------------|
| `DATABASE_URL`        | `postgresql://user:pass@db-host:5432/qa_metrics`       | Apuntar al recurso Postgres de Coolify.                         |
| `JWT_SECRET`          | `openssl rand -base64 48`                              | Obligatorio, NO reutilizar de dev.                              |
| `JWT_REFRESH_SECRET`  | `openssl rand -base64 48`                              | Distinto del anterior.                                          |
| `ENCRYPTION_KEY`      | `openssl rand -base64 32` (32 bytes)                   | Cifra PATs de Azure DevOps. No rotar sin migrar datos cifrados. |
| `CORS_ORIGIN`         | `https://qa-metrics.inovabiz.com`                      | Dominio público del frontend (HTTPS).                           |
| `PORT`                | `8080`                                                 | Puerto interno del contenedor.                                  |
| `NODE_ENV`            | `production`                                           |                                                                 |

### Web (`apps/web`)
| Variable               | Ejemplo                               | Notas                                                             |
|------------------------|---------------------------------------|-------------------------------------------------------------------|
| `NEXT_PUBLIC_API_URL`  | `https://api.qa-metrics.inovabiz.com` | **Build-time**: pasarla como `ARG` al construir la imagen Docker. |
| `NODE_ENV`             | `production`                          |                                                                   |

> **Importante**: `NEXT_PUBLIC_API_URL` se hornea en el bundle de Next.js en build-time. Reconstruir la imagen si cambia el dominio.

## HTTPS obligatorio

Las cookies de autenticación se emiten como `Secure` en producción. Sin HTTPS el login no persiste la sesión. Configurar los certificados Let's Encrypt de Coolify para ambos dominios (API y Web) antes del primer login.

## Orden de despliegue

1. Crear servicio PostgreSQL 16 en Coolify y obtener el `DATABASE_URL`.
2. Construir y desplegar la imagen de **API** con las variables arriba.
3. Entrar al contenedor API (o ejecutar un job one-shot) y correr migraciones:
   ```bash
   cd /app/packages/database && npx prisma migrate deploy
   ```
4. Inyectar el snapshot inicial con los datos (ver sección siguiente).
5. Construir la imagen **Web** pasando `NEXT_PUBLIC_API_URL` como build-arg.
6. Desplegar Web.
7. Validar login con un usuario conocido (admin o jcaradeux).

## Preservar datos (snapshot export/import)

En el entorno actual (local) ya tenemos usuarios, clientes, proyectos y HUs reales que NO se deben perder. Flujo:

### Exportar desde dev
```bash
cd packages/database
npx tsx scripts/export-snapshot.ts
# Genera: deploy/snapshots/snapshot-<timestamp>.json y snapshot-latest.json
```

### Copiar a producción
El snapshot NO viaja en la imagen Docker (excluido por `.dockerignore`). Opciones para hacerlo llegar:

- **Opción A — volumen persistente**: montar un volumen Coolify en `/snapshots` y subir el JSON por SFTP/consola web antes del import.
- **Opción B — one-shot job**: copiar el JSON al contenedor API con `docker cp` y ejecutar el import.
- **Opción C — URL temporal**: subir el snapshot a un bucket privado y descargarlo con `curl` antes del import (recordar borrar después).

### Importar en producción
Dentro del contenedor API (o como one-shot):
```bash
cd /app/packages/database
npx tsx scripts/import-snapshot.ts /snapshots/snapshot-latest.json
```

El script es idempotente (upsert por id): conserva los IDs originales y se puede re-ejecutar si algo falla.

> Orden interno del import (respetando FKs): permissions → roles → rolePermissions → users → clients → projects → testers → testCycles → userStories → testerAssignments → assignmentStatusLogs → assignmentPhases → dailyRecords → holidays.

## Build local antes de subir (opcional)

Para validar que las imágenes funcionan antes de push:
```bash
cd deploy
docker compose build
docker compose up -d
```

Sitios: `http://localhost:3000` (web) y `http://localhost:4000` (api).

## Healthchecks sugeridos en Coolify

- **API**: `GET /api/health` → espera `200`.
- **Web**: `GET /` → espera `200`.

## Rollback

1. Volver a la imagen Docker anterior (Coolify conserva builds previas).
2. Si los datos se corrompen, re-importar el último snapshot válido desde `deploy/snapshots/`.

## Gotchas

- `prisma migrate deploy` **no** ejecuta seed. El seed inicial viene del snapshot.
- El `ENCRYPTION_KEY` cifra los PAT de Azure DevOps guardados en `Project.adoToken`. Cambiarlo invalida todos los tokens cifrados.
- `CORS_ORIGIN` debe ser exacto (sin trailing slash).
- Si el login no persiste la sesión en producción, revisa: (a) HTTPS activo, (b) `CORS_ORIGIN` correcto, (c) el dominio del frontend coincide con el del cookie.
