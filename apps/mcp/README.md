# @qa-metrics/mcp

Servidor MCP (stdio) para crear proyectos y cargar ejecuciones en QA Metrics.
Escribe **en la API configurada** (por defecto producción: `https://api.qametrics.cl`),
no en la base de datos, así que aplica las mismas validaciones y permisos que la web.

## 1. Iniciar sesión (una vez)

```bash
npm run login -w @qa-metrics/mcp
```

Pide email y contraseña en la terminal. La contraseña no se guarda: solo se guarda
el refresh token (90 días) en `~/.qa-metrics-mcp/session.json`.

> La API guarda **un solo refresh token por usuario**. Si después inicias sesión en la
> web, el MCP perderá la sesión cuando expire su access token (8 h) y habrá que
> repetir el login.

Para apuntar a otro entorno: `QA_METRICS_API_URL=http://localhost:4000 npm run login -w @qa-metrics/mcp`.

## 2. Registrar en Claude Code

`.mcp.json` en la raíz del repo (está en `.gitignore`):

```json
{
  "mcpServers": {
    "qa-metrics": {
      "command": "node",
      "args": ["<repo>/node_modules/tsx/dist/cli.mjs", "<repo>/apps/mcp/src/index.ts"],
      "env": { "QA_METRICS_API_URL": "https://api.qametrics.cl" }
    }
  }
}
```

## Herramientas

| Lectura | Escritura |
|---|---|
| `whoami`, `listar_clientes`, `listar_proyectos`, `listar_analistas`, `listar_testers`, `listar_hus`, `listar_ciclos`, `listar_asignaciones`, `ver_semana`, `listar_feriados` | `crear_cliente`, `crear_proyecto`, `agregar_tester`, `crear_hu`, `crear_ciclo`, `crear_asignacion`, `actualizar_asignacion`, `cargar_ejecuciones` |

Orden para un proyecto nuevo: cliente → proyecto → tester → HU → ciclo → asignación → `cargar_ejecuciones`.

`cargar_ejecuciones` **reemplaza** (no suma) los valores de un día ya cargado y devuelve
el valor anterior de cada registro.
