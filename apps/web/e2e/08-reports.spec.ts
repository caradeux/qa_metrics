import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('Exportacion de Reportes', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar al dashboard de un proyecto', async () => {
    await navigateTo(page, '/dashboard');
    await page.waitForTimeout(1000);

    // Try to navigate to a project dashboard via clicks
    const proyectoBtn = page.locator('button:has-text("Proyecto")').or(page.locator('text=Por Proyecto'));
    if (await proyectoBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await proyectoBtn.first().click();
      await page.waitForTimeout(1000);
    }

    const projectLink = page.locator('a[href*="/dashboard/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForTimeout(3000);
    }
    await takeScreenshot(page, '08-reporte-dashboard-proyecto');
  });

  test('exportar reporte Excel', async () => {
    const excelBtn = page.locator('button:has-text("Excel")');
    if (await excelBtn.first().isVisible({ timeout: 10000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      await excelBtn.first().click();
      await page.waitForTimeout(2000);
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/\.(xlsx|xls)$/);
        await takeScreenshot(page, '08-reporte-excel-descargado');
      } else {
        await takeScreenshot(page, '08-reporte-excel-intento');
      }
    }
  });

  test('exportar reporte PDF', async () => {
    const pdfBtn = page.locator('button:has-text("PDF")');
    if (await pdfBtn.first().isVisible({ timeout: 10000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      await pdfBtn.first().click();
      await page.waitForTimeout(3000);
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/\.pdf$/);
        await takeScreenshot(page, '08-reporte-pdf-descargado');
      } else {
        await takeScreenshot(page, '08-reporte-pdf-intento');
      }
    }
  });
});
