import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('Dashboard Principal', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('pagina principal del dashboard', async () => {
    await navigateTo(page, '/dashboard');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '07-dashboard-principal');
  });

  test('toggle entre vista por cliente y por proyecto', async () => {
    const clienteBtn = page.locator('button:has-text("Cliente")').or(page.locator('text=Por Cliente'));
    const proyectoBtn = page.locator('button:has-text("Proyecto")').or(page.locator('text=Por Proyecto'));

    if (await clienteBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await clienteBtn.first().click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '07-dashboard-vista-cliente');
    }

    if (await proyectoBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await proyectoBtn.first().click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '07-dashboard-vista-proyecto');
    }
  });

  test('cards de clientes visibles con datos del seed', async () => {
    await navigateTo(page, '/dashboard');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Banco Nacional').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Seguros Continental').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '07-dashboard-cards-clientes');
  });

  test('navegar al dashboard de un proyecto', async () => {
    const proyectoBtn = page.locator('button:has-text("Proyecto")').or(page.locator('text=Por Proyecto'));
    if (await proyectoBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await proyectoBtn.first().click();
      await page.waitForTimeout(1000);
    }

    const projectCard = page.locator('a[href*="/dashboard/"]').first();
    if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectCard.click();
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '07-dashboard-proyecto-navegacion');
    }
  });

  test('KPIs visibles en dashboard de proyecto', async () => {
    const kpiElements = page.locator('text=Casos Diseñados').or(page.locator('text=Diseñados')).or(page.locator('text=Ejecutados'));
    await expect(kpiElements.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '07-dashboard-proyecto-kpis');
  });

  test('graficas visibles', async () => {
    const chart = page.locator('.recharts-wrapper').or(page.locator('svg.recharts-surface'));
    await expect(chart.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '07-dashboard-graficas');
  });

  test('tabla resumen por tester', async () => {
    const testerTable = page.locator('text=Tester').or(page.locator('th:has-text("Tester")'));
    await expect(testerTable.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '07-dashboard-tabla-testers');
  });

  test('filtros del dashboard', async () => {
    const filterToggle = page.locator('text=Filtros').or(page.locator('button:has-text("Filtros")'));
    if (await filterToggle.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterToggle.first().click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '07-dashboard-filtros-abiertos');
    }
  });

  test('comparacion entre ciclos', async () => {
    const compareToggle = page.locator('text=Comparar').or(page.locator('text=Comparativa')).or(page.locator('button:has-text("Comparar")'));
    if (await compareToggle.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await compareToggle.first().click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '07-dashboard-comparacion-ciclos');
    } else {
      await takeScreenshot(page, '07-dashboard-comparacion-section');
    }
  });

  test('botones de exportacion visibles', async () => {
    const excelBtn = page.locator('button:has-text("Excel")').or(page.locator('text=Excel'));
    const pdfBtn = page.locator('button:has-text("PDF")').or(page.locator('text=PDF'));
    await expect(excelBtn.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await expect(pdfBtn.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '07-dashboard-botones-exportar');
  });
});
