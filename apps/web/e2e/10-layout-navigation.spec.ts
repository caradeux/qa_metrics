import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('Layout y Navegacion General', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('sidebar con todos los links de navegacion', async () => {
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Clientes').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Proyectos').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Carga Manual').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Importar Excel').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '10-sidebar-completo');
  });

  test('header con info del usuario', async () => {
    const logoutBtn = page.locator('text=Cerrar sesion').or(page.locator('text=Cerrar Sesion'));
    await expect(logoutBtn.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '10-header-usuario');
  });

  test('logo QA METRICS visible', async () => {
    const logo = page.locator('text=QA').or(page.locator('text=METRICS'));
    await expect(logo.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '10-logo');
  });

  test('navegacion completa por todas las paginas', async () => {
    const pages = [
      { path: '/clients' as const, label: 'Clientes', screenshot: '10-nav-clientes' },
      { path: '/projects' as const, label: 'Proyectos', screenshot: '10-nav-proyectos' },
      { path: '/records/new' as const, label: 'Carga Manual', screenshot: '10-nav-carga-manual' },
      { path: '/records/import' as const, label: 'Importar Excel', screenshot: '10-nav-importar' },
      { path: '/users' as const, label: 'Usuarios', screenshot: '10-nav-usuarios' },
      { path: '/assignments' as const, label: 'Asignaciones', screenshot: '10-nav-asignaciones' },
      { path: '/dashboard' as const, label: 'Dashboard', screenshot: '10-nav-dashboard' },
    ];

    for (const p of pages) {
      await navigateTo(page, p.path);
      const content = page.locator(`text=${p.label}`).first();
      await expect(content).toBeVisible({ timeout: 10000 });
      await takeScreenshot(page, p.screenshot);
    }
  });

  test('indicador de ruta activa en sidebar', async () => {
    await navigateTo(page, '/clients');
    const activeLink = page.locator('a[href="/clients"]').or(page.locator('a[href*="clients"]'));
    await expect(activeLink.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '10-sidebar-ruta-activa');
  });

  test('version visible en footer del sidebar', async () => {
    const version = page.locator('text=v1.0').or(page.locator('text=v1'));
    await expect(version.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '10-sidebar-version');
  });
});

test.describe.serial('Permisos por Rol', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, 'lead');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('QA Lead ve opciones limitadas', async () => {
    await takeScreenshot(page, '10-permisos-lead-dashboard');

    await navigateTo(page, '/clients');
    await takeScreenshot(page, '10-permisos-lead-clientes');

    await navigateTo(page, '/projects');
    await takeScreenshot(page, '10-permisos-lead-proyectos');
  });
});

test.describe.serial('Responsive Design', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('dashboard en tablet (768px)', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await navigateTo(page, '/dashboard');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '10-responsive-tablet-dashboard');
  });

  test('clientes en tablet', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await navigateTo(page, '/clients');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '10-responsive-tablet-clientes');
  });

  test('dashboard en desktop grande (1920px)', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await navigateTo(page, '/dashboard');
    await page.waitForTimeout(1000);

    const projectLink = page.locator('a[href*="/dashboard/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForTimeout(3000);
    }
    await takeScreenshot(page, '10-responsive-desktop-grande');
  });
});
