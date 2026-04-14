import { test, expect } from '@playwright/test';

test('login normal redirige a dashboard sin loop', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@qametrics.com');
  await page.locator('input[type="password"]').fill('QaMetrics2024!');
  await page.getByRole('button', { name: /iniciar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/dashboard');
});

test('localStorage stale sin cookie NO hace loop', async ({ page, context }) => {
  // Simulamos sesión vieja: user en localStorage pero NO cookie auth-token
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('user', JSON.stringify({
      id: 'stale', name: 'Stale', email: 'stale@x.com',
      role: { id: '1', name: 'ADMIN', permissions: [] },
    }));
    localStorage.setItem('accessToken', 'fake');
    // cookie borrada
    document.cookie = 'auth-token=; path=/; max-age=0';
  });

  const navigations: string[] = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations.push(f.url()); });

  await page.goto('/login');
  await page.waitForTimeout(4000); // si hay loop, veremos muchas navegaciones

  // Debe quedarse en /login y haber limpiado localStorage
  expect(page.url()).toContain('/login');
  expect(navigations.filter(u => u.includes('/login')).length).toBeLessThan(4);
  const userInStorage = await page.evaluate(() => localStorage.getItem('user'));
  expect(userInStorage).toBeNull();
});
