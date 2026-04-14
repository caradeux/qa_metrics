import { test, expect, Page } from '@playwright/test';

const ADMIN = { email: 'admin@qametrics.com', password: 'QaMetrics2024!' };
const TESTER = { email: 'tester1@qametrics.com', password: 'QaMetrics2024!' };

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first().fill(creds.email);
  await page.getByLabel(/contraseña|password/i).or(page.locator('input[type="password"]')).first().fill(creds.password);
  await Promise.all([
    page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 }).catch(() => null),
    page.getByRole('button', { name: /iniciar|ingresar|login/i }).click(),
  ]);
}

test.describe('Smoke: rol ADMIN', () => {
  test('todas las pantallas principales cargan', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await login(page, ADMIN);
    expect(page.url(), 'debe haber redirigido fuera de /login').not.toContain('/login');

    const routes = [
      '/dashboard',
      '/clients',
      '/projects',
      '/users',
      '/reports/client',
      '/equipo',
    ];
    for (const r of routes) {
      await page.goto(r);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
      const body = await page.locator('body').innerText().catch(() => '');
      expect.soft(body, `${r} no debe mostrar página 404`).not.toMatch(/404|not found/i);
      expect.soft(body.length, `${r} debe tener contenido`).toBeGreaterThan(20);
    }

    if (errors.length) console.log('ERRORES CONSOLA ADMIN:\n', errors.join('\n'));
    expect(errors.filter(e => !e.includes('Download the React DevTools')), 'errores JS en consola').toEqual([]);
  });
});

test.describe('Smoke: rol TESTER', () => {
  test('/mi-semana carga con grilla L-V', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await login(page, TESTER);
    expect(page.url()).not.toContain('/login');

    await page.goto('/mi-semana');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    const body = await page.locator('body').innerText();
    expect.soft(body).toMatch(/semana|lunes|martes/i);

    if (errors.length) console.log('ERRORES CONSOLA TESTER:\n', errors.join('\n'));
  });
});
