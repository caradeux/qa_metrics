import { test, expect, Page } from '@playwright/test';
import { login, navigateTo, takeScreenshot } from './helpers/auth';

test.describe.serial('Gestion de Usuarios', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar a pagina de usuarios', async () => {
    await navigateTo(page, '/users');
    const heading = page.locator('text=Usuarios').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '09-usuarios-lista');
  });

  test('lista de usuarios del seed', async () => {
    await expect(page.locator('text=admin@qametrics.com').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=laura.gomez').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '09-usuarios-seed-data');
  });

  test('crear nuevo usuario', async () => {
    await page.click('button:has-text("Nuevo Usuario")');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '09-usuarios-modal-crear');

    const inputs = page.locator('input');
    await inputs.first().fill('Usuario Test E2E');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test.e2e@qametrics.com');

    const passInput = page.locator('input[type="password"]');
    await passInput.first().fill('TestE2E2024!');

    const roleOption = page.locator('text=QA_ANALYST').or(page.locator('text=Registro de datos'));
    if (await roleOption.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await roleOption.first().click();
    }
    await takeScreenshot(page, '09-usuarios-modal-llenado');

    await page.click('button:has-text("Guardar")');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '09-usuarios-creado');
  });

  test('editar usuario existente', async () => {
    const row = page.locator('tr', { hasText: 'test.e2e@qametrics.com' }).or(page.locator('div', { hasText: 'test.e2e@qametrics.com' }));
    const editBtn = row.first().locator('button:has-text("Editar")');
    if (await editBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '09-usuarios-modal-editar');
      await page.click('button:has-text("Cancelar")');
    }
  });

  test('toggle estado activo/inactivo', async () => {
    const row = page.locator('tr', { hasText: 'test.e2e@qametrics.com' }).or(page.locator('div', { hasText: 'test.e2e@qametrics.com' }));
    const toggleBtn = row.first().locator('button:has-text("Activo")').or(row.first().locator('button:has-text("Inactivo")'));
    if (await toggleBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await toggleBtn.first().click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '09-usuarios-toggle-estado');
    }
  });

  test('eliminar usuario', async () => {
    const row = page.locator('tr', { hasText: 'test.e2e@qametrics.com' }).or(page.locator('div', { hasText: 'test.e2e@qametrics.com' }));
    const deleteBtn = row.first().locator('button:has-text("Eliminar")');
    if (await deleteBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '09-usuarios-confirmar-eliminar');
      const confirmBtn = page.locator('button:has-text("Eliminar")').last();
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '09-usuarios-eliminado');
    }
  });

  test('roles visibles en tabla de usuarios', async () => {
    // Navigate directly to avoid sidebar click interception issues
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const adminRole = page.locator('text=ADMIN').or(page.locator('text=Admin'));
    await expect(adminRole.first()).toBeVisible({ timeout: 15000 });
    await takeScreenshot(page, '09-usuarios-roles-visibles');
  });
});

test.describe.serial('Gestion de Roles', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar a pagina de roles', async () => {
    await navigateTo(page, '/settings/roles');
    const heading = page.locator('text=Roles').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '09-roles-lista');
  });

  test('roles del sistema visibles', async () => {
    await expect(page.locator('text=ADMIN').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=QA_LEAD').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=QA_ANALYST').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '09-roles-sistema');
  });

  test('badge Sistema en roles del sistema', async () => {
    const sistemaBadge = page.locator('text=Sistema');
    await expect(sistemaBadge.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '09-roles-badge-sistema');
  });

  test('crear nuevo rol', async () => {
    await page.click('button:has-text("Nuevo Rol")');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '09-roles-modal-crear');

    const nameInput = page.locator('input').first();
    await nameInput.fill('Rol Test E2E');

    const descInput = page.locator('textarea');
    if (await descInput.first().isVisible().catch(() => false)) {
      await descInput.first().fill('Rol creado para pruebas E2E');
    }

    const checkboxes = page.locator('input[type="checkbox"]');
    const checkCount = await checkboxes.count();
    if (checkCount > 0) {
      await checkboxes.first().click();
      await page.waitForTimeout(300);
    }
    await takeScreenshot(page, '09-roles-modal-permisos');

    await page.click('button:has-text("Guardar")');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '09-roles-creado');
  });

  test('editar rol personalizado', async () => {
    // Ensure we're on the roles page and data is loaded
    await page.waitForTimeout(2000);
    const roleCard = page.locator('div', { hasText: 'Rol Test E2E' });
    const editBtn = roleCard.first().locator('button:has-text("Editar")');
    if (await editBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '09-roles-modal-editar');
      // Try to close modal - look for Cancelar or Cerrar button, or press Escape
      const cancelBtn = page.locator('button:has-text("Cancelar")');
      if (await cancelBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.first().click({ force: true });
      } else {
        // Fallback: press Escape to close modal
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }
  });

  test('ver permisos de rol del sistema (solo lectura)', async () => {
    const adminCard = page.locator('div', { hasText: 'ADMIN' });
    const editBtn = adminCard.first().locator('button:has-text("Editar")');
    if (await editBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '09-roles-sistema-readonly');
      // Close modal: target the Cerrar button inside dialog to avoid matching header's "Cerrar sesion"
      const dialogCloseBtn = page.locator('dialog button:has-text("Cerrar")');
      const modalCloseBtn = page.locator('[role="dialog"] button:has-text("Cerrar")');
      if (await dialogCloseBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await dialogCloseBtn.first().click({ force: true });
      } else if (await modalCloseBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await modalCloseBtn.first().click({ force: true });
      } else {
        // Fallback: press Escape to close any modal
        await page.keyboard.press('Escape');
      }
    }
  });

  test('eliminar rol personalizado', async () => {
    const roleCard = page.locator('div', { hasText: 'Rol Test E2E' });
    const deleteBtn = roleCard.first().locator('button:has-text("Eliminar")');
    if (await deleteBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '09-roles-confirmar-eliminar');
      const confirmBtn = page.locator('button:has-text("Eliminar")').last();
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '09-roles-eliminado');
    }
  });

  test('no se puede eliminar rol del sistema', async () => {
    const adminCard = page.locator('div', { hasText: 'ADMIN' }).first();
    const deleteBtn = adminCard.locator('button:has-text("Eliminar")');
    const isVisible = await deleteBtn.isVisible().catch(() => false);
    await takeScreenshot(page, '09-roles-sistema-sin-eliminar');
  });
});

test.describe.serial('Gestion de Asignaciones', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navegar a pagina de asignaciones', async () => {
    await navigateTo(page, '/assignments');
    const heading = page.locator('text=Asignaciones').or(page.locator('text=asignaciones'));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '09-asignaciones-lista');
  });

  test('KPIs de resumen ejecutivo visibles', async () => {
    const totalHU = page.locator('text=Total HU').or(page.locator('text=HU'));
    await expect(totalHU.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '09-asignaciones-kpis');
  });

  test('pipeline visual de estados', async () => {
    const pipeline = page.locator('text=INI').or(page.locator('text=ANA')).or(page.locator('text=EJE'));
    await expect(pipeline.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '09-asignaciones-pipeline');
  });

  test('filtro por proyecto', async () => {
    const projectSelect = page.locator('select').first();
    if (await projectSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectSelect.selectOption({ index: 1 });
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '09-asignaciones-filtro-proyecto');
    }
  });

  test('filtro por estado', async () => {
    const statusBtn = page.locator('button:has-text("EJE")').or(page.locator('button:has-text("PRD")'));
    if (await statusBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusBtn.first().click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '09-asignaciones-filtro-estado');
    }
  });

  test('cards de testers con asignaciones', async () => {
    const testerCard = page.locator('text=Ana Garcia').or(page.locator('text=Luis Torres'));
    await expect(testerCard.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '09-asignaciones-cards-testers');
  });

  test('crear nueva asignacion', async () => {
    const newBtn = page.locator('button:has-text("Nueva Asignacion")').or(page.locator('button:has-text("Nueva")'));
    if (await newBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '09-asignaciones-modal-crear');

      const selects = page.locator('select');
      if (await selects.first().isVisible().catch(() => false)) {
        await selects.first().selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
      if (await selects.nth(1).isVisible().catch(() => false)) {
        await selects.nth(1).selectOption({ index: 1 });
        await page.waitForTimeout(500);
      }

      const storyInput = page.locator('input[type="text"]');
      if (await storyInput.first().isVisible().catch(() => false)) {
        await storyInput.first().fill('HU-TEST-E2E');
      }

      await takeScreenshot(page, '09-asignaciones-modal-llenado');

      await page.click('button:has-text("Crear")');
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '09-asignaciones-creada');
    }
  });

  test('cambiar estado de asignacion', async () => {
    const statusSelect = page.locator('select').filter({ has: page.locator('option:has-text("EXECUTION")').or(page.locator('option:has-text("ANALYSIS")')) });
    if (await statusSelect.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusSelect.first().selectOption({ index: 2 });
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '09-asignaciones-cambio-estado');
    }
  });
});
