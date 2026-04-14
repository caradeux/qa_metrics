import { test, expect } from '@playwright/test';

test('modal Nuevo Cliente se muestra centrado', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@qametrics.com');
  await page.locator('input[type="password"]').fill('QaMetrics2024!');
  await page.getByRole('button', { name: /iniciar/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /nuevo cliente|agregar/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  const dialog = page.locator('dialog[open]').first();
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  console.log('Dialog box:', box, 'Viewport:', viewport);
  expect(box).not.toBeNull();
  // Centro horizontal del modal debe estar cerca del centro del viewport
  const centerX = box!.x + box!.width / 2;
  const diff = Math.abs(centerX - viewport.width / 2);
  console.log(`Centro X modal: ${centerX}, centro viewport: ${viewport.width / 2}, diff: ${diff}`);
  expect(diff).toBeLessThan(50);
  await page.screenshot({ path: 'e2e-results/modal-check.png', fullPage: false });
});
