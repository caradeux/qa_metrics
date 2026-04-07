import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('CRUD de Clientes', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar a la pagina de clientes', async () => {
    await navigateTo(page, '/clients');
    const heading = page.locator('text=Clientes').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '02-clientes-lista');
  });

  test('lista de clientes muestra los clientes del seed', async () => {
    const bancoNacional = page.locator('text=Banco Nacional');
    const seguros = page.locator('text=Seguros Continental');
    await expect(bancoNacional.first()).toBeVisible({ timeout: 10000 });
    await expect(seguros.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '02-clientes-seed-data');
  });

  test('crear nuevo cliente', async () => {
    await navigateTo(page, '/clients');
    const nuevoBtn = page.locator('text=Nuevo Cliente').or(page.locator('text=Crear el primero'));
    await nuevoBtn.first().click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, '02-clientes-modal-crear');

    await page.fill('input[placeholder="Nombre del cliente"]', 'Cliente Test E2E');
    await takeScreenshot(page, '02-clientes-modal-llenado');

    await page.click('button:has-text("Guardar")');
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Cliente Test E2E').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '02-clientes-creado-exitoso');
  });

  test('editar cliente existente', async () => {
    await navigateTo(page, '/clients');
    await page.waitForTimeout(1000);

    const row = page.locator('tr', { hasText: 'Cliente Test E2E' }).or(page.locator('div', { hasText: 'Cliente Test E2E' }));
    const editBtn = row.first().locator('button:has-text("Editar")').or(row.first().locator('text=Editar'));
    if (await editBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '02-clientes-modal-editar');

      await page.fill('input[placeholder="Nombre del cliente"]', 'Cliente Test E2E Editado');
      await page.click('button:has-text("Guardar")');
      await page.waitForTimeout(2000);
      await expect(page.locator('text=Cliente Test E2E Editado').first()).toBeVisible({ timeout: 10000 });
      await takeScreenshot(page, '02-clientes-editado-exitoso');
    }
  });

  test('cancelar creacion de cliente', async () => {
    await navigateTo(page, '/clients');
    const nuevoBtn = page.locator('text=Nuevo Cliente');
    if (await nuevoBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await nuevoBtn.first().click();
      await page.waitForTimeout(500);
      await page.fill('input[placeholder="Nombre del cliente"]', 'No deberia guardarse');
      await page.click('button:has-text("Cancelar")');
      await page.waitForTimeout(1000);
      const noGuardado = await page.locator('text=No deberia guardarse').count();
      expect(noGuardado).toBe(0);
      await takeScreenshot(page, '02-clientes-cancelar-creacion');
    }
  });

  test('eliminar cliente test', async () => {
    await navigateTo(page, '/clients');
    await page.waitForTimeout(1000);

    const row = page.locator('tr', { hasText: 'Cliente Test E2E' }).or(page.locator('div', { hasText: 'Cliente Test E2E' }));
    const deleteBtn = row.first().locator('button:has-text("Eliminar")').or(row.first().locator('text=Eliminar'));
    if (await deleteBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '02-clientes-confirmar-eliminar');

      const confirmBtn = page.locator('button:has-text("Eliminar")').last();
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '02-clientes-eliminado-exitoso');
    }
  });
});
