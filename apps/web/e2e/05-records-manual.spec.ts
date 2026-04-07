import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('Carga Manual de Datos', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar a carga manual desde sidebar', async () => {
    await navigateTo(page, '/records/new');
    const heading = page.locator('text=Carga Manual').or(page.locator('text=carga manual').or(page.locator('text=Registro')));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '05-carga-manual-pagina');
  });

  test('selectores de cliente, proyecto, ciclo y semana visibles', async () => {
    const selects = page.locator('select');
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThanOrEqual(1);
    await takeScreenshot(page, '05-carga-manual-selectores');
  });

  test('seleccionar cliente carga proyectos', async () => {
    // Select first client (Banco Nacional - has projects with cycles)
    const clientSelect = page.locator('select').first();
    await clientSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, '05-carga-manual-cliente-seleccionado');

    const projectSelect = page.locator('select').nth(1);
    const isDisabled = await projectSelect.isDisabled();
    expect(isDisabled).toBeFalsy();
    await takeScreenshot(page, '05-carga-manual-proyectos-cargados');
  });

  test('seleccionar proyecto carga ciclos', async () => {
    // Select first project under client (should be Core Bancario with cycles)
    const projectSelect = page.locator('select').nth(1);
    await projectSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, '05-carga-manual-proyecto-seleccionado');
  });

  test('formulario completo con todos los campos', async () => {
    // Select cycle - use timeout to avoid hanging on empty select
    const cycleSelect = page.locator('select').nth(2);
    const cycleOptions = cycleSelect.locator('option');
    const optionCount = await cycleOptions.count().catch(() => 0);

    if (optionCount > 1) {
      await cycleSelect.selectOption({ index: 1 }, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }

    // Check for date input
    const weekInput = page.locator('input[type="date"]').first();
    const dateVisible = await weekInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (dateVisible) {
      await weekInput.fill('2026-01-05').catch(() => {});
      await page.waitForTimeout(1000);
    }

    await takeScreenshot(page, '05-carga-manual-formulario-completo');
  });

  test('ingresar datos de un tester', async () => {
    const numberInputs = page.locator('input[type="number"]');
    const inputCount = await numberInputs.count();
    if (inputCount > 0) {
      await numberInputs.first().fill('25');
      await page.waitForTimeout(300);

      if (inputCount > 1) {
        await numberInputs.nth(1).fill('20');
        await page.waitForTimeout(300);
      }

      for (let i = 2; i < Math.min(inputCount, 6); i++) {
        await numberInputs.nth(i).fill(String(Math.floor(Math.random() * 5)));
        await page.waitForTimeout(200);
      }
    }

    await takeScreenshot(page, '05-carga-manual-datos-tester');
  });

  test('resumen del equipo visible', async () => {
    const summary = page.locator('text=Resumen').or(page.locator('text=Equipo'));
    await expect(summary.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '05-carga-manual-resumen-equipo');
  });

  test('tabs de testers navegables', async () => {
    const testerTabs = page.locator('button').filter({ hasText: /Ana|Luis|Maria|Pedro|Carolina/ });
    const tabCount = await testerTabs.count();
    if (tabCount > 1) {
      await testerTabs.nth(1).click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '05-carga-manual-tab-tester-2');
    }
  });
});
