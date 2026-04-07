import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('CRUD de Proyectos', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar a la pagina de proyectos', async () => {
    await navigateTo(page, '/projects');
    const heading = page.locator('text=Proyectos').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '03-proyectos-lista');
  });

  test('lista proyectos del seed', async () => {
    await expect(page.locator('text=Core Bancario').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Portal Asegurados').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '03-proyectos-seed-data');
  });

  test('badge de modalidad visible en proyectos', async () => {
    const manualBadge = page.locator('text=MANUAL').or(page.locator('text=Manual'));
    await expect(manualBadge.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '03-proyectos-badges-modalidad');
  });

  test('crear proyecto modalidad MANUAL', async () => {
    await navigateTo(page, '/projects');
    await page.waitForTimeout(1000);

    const nuevoBtn = page.locator('a:has-text("Nuevo Proyecto")').or(page.locator('button:has-text("Nuevo Proyecto")'));
    await nuevoBtn.first().click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '03-proyectos-formulario-nuevo');

    const clientSelect = page.locator('select').first();
    await clientSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    await page.fill('input[type="text"]', 'Proyecto Test E2E Manual');

    const manualRadio = page.locator('input[value="MANUAL"]').or(page.locator('label:has-text("Manual")'));
    await manualRadio.first().click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, '03-proyectos-formulario-manual-llenado');

    await page.click('button:has-text("Crear")');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-proyectos-manual-creado');
  });

  test('crear proyecto modalidad AZURE DEVOPS', async () => {
    await navigateTo(page, '/projects');
    await page.waitForTimeout(1000);

    const nuevoBtn = page.locator('a:has-text("Nuevo Proyecto")').or(page.locator('button:has-text("Nuevo Proyecto")'));
    await nuevoBtn.first().click();
    await page.waitForTimeout(2000);

    const clientSelect = page.locator('select').first();
    await clientSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    await page.fill('input[type="text"]', 'Proyecto Test E2E ADO');

    const adoRadio = page.locator('input[value="AZURE_DEVOPS"]').or(page.locator('label:has-text("Azure DevOps")'));
    await adoRadio.first().click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, '03-proyectos-formulario-ado');

    const urlInput = page.locator('input[type="url"]');
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill('https://dev.azure.com/test-org');
    }
    const textInputs = page.locator('input[type="text"]');
    const count = await textInputs.count();
    if (count > 1) {
      await textInputs.nth(1).fill('TestProject');
    }
    const passInput = page.locator('input[type="password"]');
    if (await passInput.first().isVisible().catch(() => false)) {
      await passInput.first().fill('fake-pat-token-for-testing');
    }
    await takeScreenshot(page, '03-proyectos-formulario-ado-llenado');

    await page.click('button:has-text("Crear")');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-proyectos-ado-creado');
  });

  test('editar proyecto existente', async () => {
    await navigateTo(page, '/projects');
    await page.waitForTimeout(1000);

    const editLink = page.locator('a:has-text("Editar")').first();
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '03-proyectos-editar-formulario');
      await takeScreenshot(page, '03-proyectos-editar-modalidad-readonly');
    }
  });

  test('links a testers y ciclos desde lista de proyectos', async () => {
    await navigateTo(page, '/projects');
    await page.waitForTimeout(1000);

    const testersLink = page.locator('a:has-text("Testers")').first();
    const ciclosLink = page.locator('a:has-text("Ciclos")').first();
    await expect(testersLink).toBeVisible({ timeout: 10000 });
    await expect(ciclosLink).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '03-proyectos-links-testers-ciclos');
  });

  test('eliminar proyecto test', async () => {
    await navigateTo(page, '/projects');
    await page.waitForTimeout(1000);

    const testRow = page.locator('tr', { hasText: 'Proyecto Test E2E' }).or(page.locator('div', { hasText: 'Proyecto Test E2E' }));
    const deleteBtn = testRow.first().locator('button:has-text("Eliminar")').or(testRow.first().locator('a:has-text("Eliminar")'));
    if (await deleteBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '03-proyectos-confirmar-eliminar');

      const confirmBtn = page.locator('button:has-text("Eliminar")').last();
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '03-proyectos-eliminado');
    }
  });

  test('cancelar creacion de proyecto', async () => {
    await navigateTo(page, '/projects');
    await page.waitForTimeout(1000);

    const nuevoBtn = page.locator('a:has-text("Nuevo Proyecto")').or(page.locator('button:has-text("Nuevo Proyecto")'));
    await nuevoBtn.first().click();
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Cancelar")');
    await page.waitForTimeout(2000);
    const heading = page.locator('text=Proyectos').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '03-proyectos-cancelar');
  });
});
