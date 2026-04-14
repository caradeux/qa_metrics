import { test, expect, Page } from '@playwright/test';

/**
 * Smoke test completo: valida que cada rol accede a sus rutas principales
 * sin errores 500/404 y que hay datos mínimos.
 *
 * Las credenciales aquí son las de `e2e/helpers/auth.ts`. Si cambian los
 * passwords en dev, actualizar esa constante (o exponer TEST_USERS por env).
 */

const API_URL = 'http://localhost:4000';

const USERS = {
  admin:     { email: 'admin@qametrics.com',        password: 'QaMetrics2024!' },
  lead:      { email: 'jcaradeux@inovabiz.com',     password: 'QaMetrics2024!' },
  analyst:   { email: 'b.benardis@inovabiz.com',    password: 'Inovabiz.2026'  },
  client_pm: { email: 'demo@demo.cl',               password: 'Demo2026!'      },
};

async function apiLogin(email: string, password: string) {
  const r = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login fallo ${email}: ${r.status}`);
  return r.json();
}

async function authenticate(page: Page, email: string, password: string) {
  const data = await apiLogin(email, password);
  await page.context().addCookies([{
    name: 'auth-token',
    value: data.accessToken,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);
  await page.addInitScript(`
    localStorage.setItem('accessToken', ${JSON.stringify(data.accessToken)});
    localStorage.setItem('refreshToken', ${JSON.stringify(data.refreshToken)});
    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(data.user))});
  `);
}

async function visit(page: Page, path: string) {
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  const status = resp?.status() ?? 0;
  expect(status, `ruta ${path} retornó ${status}`).toBeLessThan(500);
  expect(status, `ruta ${path} retornó ${status}`).not.toBe(404);
}

test.describe('smoke: admin', () => {
  test('admin navega todas sus rutas', async ({ page }) => {
    await authenticate(page, USERS.admin.email, USERS.admin.password);
    for (const path of [
      '/dashboard',
      '/clients',
      '/projects',
      '/users',
      '/gantt',
      '/assignments',
      '/reports/client',
      '/equipo',
      '/settings/roles',
    ]) {
      await visit(page, path);
    }
  });
});

test.describe('smoke: analista', () => {
  test('analista navega sus rutas', async ({ page }) => {
    await authenticate(page, USERS.analyst.email, USERS.analyst.password);
    for (const path of ['/mi-semana', '/projects', '/gantt']) {
      await visit(page, path);
    }
  });
});

test.describe('smoke: client_pm', () => {
  test('client_pm navega sus rutas', async ({ page }) => {
    await authenticate(page, USERS.client_pm.email, USERS.client_pm.password);
    for (const path of ['/projects', '/dashboard', '/reports/client', '/gantt']) {
      await visit(page, path);
    }
  });
});

test.describe('smoke: datos mínimos', () => {
  test('existe al menos 1 proyecto y 1 HU (vía API con admin)', async () => {
    const { accessToken } = await apiLogin(USERS.admin.email, USERS.admin.password);
    const headers = { Authorization: `Bearer ${accessToken}` };

    const projRes = await fetch(`${API_URL}/api/projects`, { headers });
    expect(projRes.status).toBe(200);
    const projects = await projRes.json();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length, 'no hay proyectos en la BD').toBeGreaterThan(0);

    // Al menos una HU entre todos los ciclos del primer proyecto
    const projectId = projects[0].id;
    const cyclesRes = await fetch(`${API_URL}/api/projects/${projectId}/cycles`, { headers });
    if (cyclesRes.status === 200) {
      const cycles = await cyclesRes.json();
      let totalStories = 0;
      for (const c of cycles) {
        const storiesRes = await fetch(`${API_URL}/api/cycles/${c.id}/stories`, { headers });
        if (storiesRes.status === 200) {
          const stories = await storiesRes.json();
          totalStories += stories.length;
        }
      }
      expect(totalStories, 'no hay HUs en ningún ciclo').toBeGreaterThan(0);
    }
  });
});
