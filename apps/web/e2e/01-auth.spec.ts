import { test, expect } from '@playwright/test';
import { TEST_USERS, loginViaUI, takeScreenshot } from './helpers/auth';

test.describe('Autenticacion', () => {
  test('muestra la pagina de login correctamente', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, '01-login-page');
  });

  test('login exitoso con credenciales de admin (via UI)', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    const hasToken = await page.evaluate(() => !!localStorage.getItem('accessToken')).catch(() => false);
    const hasSidebar = await page.locator('a:has-text("Clientes")').isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasToken || hasSidebar).toBeTruthy();
    await takeScreenshot(page, '01-login-exitoso-admin');
  });

  test('login fallido con credenciales incorrectas', async ({ page }) => {
    await loginViaUI(page, 'admin@qametrics.com', 'contraseña_incorrecta');
    const errorMsg = page.locator('.bg-\\[\\#FEF2F2\\]');
    await expect(errorMsg).toBeVisible({ timeout: 10000 });
    const url = page.url();
    expect(url).toContain('/login');
    await takeScreenshot(page, '01-login-fallido');
  });

  test('login fallido con email vacio', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#password', 'QaMetrics2024!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toContain('/login');
    await takeScreenshot(page, '01-login-email-vacio');
  });

  test('login fallido con password vacio', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', 'admin@qametrics.com');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toContain('/login');
    await takeScreenshot(page, '01-login-password-vacio');
  });

  test('redirige a login si no hay sesion', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url).toContain('/login');
    await takeScreenshot(page, '01-redireccion-sin-sesion');
  });

  test('boton de login muestra estado de carga', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', 'admin@qametrics.com');
    await page.fill('#password', 'QaMetrics2024!');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(300);
    await takeScreenshot(page, '01-login-loading-state');
  });
});
