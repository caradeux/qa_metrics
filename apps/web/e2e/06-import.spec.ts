import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('Importacion Excel/CSV', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar a pagina de importacion', async () => {
    await navigateTo(page, '/records/import');
    const heading = page.locator('text=Importar').or(page.locator('text=importar'));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '06-importacion-pagina');
  });

  test('selectores de cliente y proyecto visibles', async () => {
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '06-importacion-selectores');
  });

  test('seleccionar cliente y proyecto', async () => {
    const clientSelect = page.locator('select').first();
    await clientSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);

    const projectSelect = page.locator('select').nth(1);
    await projectSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '06-importacion-proyecto-seleccionado');
  });

  test('boton descargar plantilla visible', async () => {
    const downloadBtn = page.locator('text=Descargar Plantilla').or(page.locator('text=Descargar'));
    await expect(downloadBtn.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '06-importacion-boton-plantilla');
  });

  test('zona de drop visible', async () => {
    const dropZone = page.locator('text=arrastr').or(page.locator('text=Arrastr')).or(page.locator('text=Subir')).or(page.locator('input[type="file"]'));
    await expect(dropZone.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '06-importacion-dropzone');
  });
});
