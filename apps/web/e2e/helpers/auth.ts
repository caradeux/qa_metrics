import { Page } from '@playwright/test';

export const TEST_USERS = {
  admin: { email: 'admin@qametrics.com', password: 'QaMetrics2024!' },
  lead: { email: 'laura.gomez@qametrics.com', password: 'Lead2024!' },
  analyst: { email: 'ana.garcia@qametrics.com', password: 'Analyst2024!' },
};

type UserRole = keyof typeof TEST_USERS;

/**
 * Login by:
 * 1. Getting tokens via API
 * 2. Setting auth-token cookie (for Next.js middleware)
 * 3. Setting localStorage tokens via addInitScript (for React AuthProvider)
 * 4. Navigating to /dashboard (now works because middleware sees cookie)
 */
export async function login(page: Page, role: UserRole = 'admin') {
  const { email, password } = TEST_USERS[role];

  // Get tokens via API
  const response = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login API failed: ${response.status}`);
  const data = await response.json();

  // Set auth cookie for Next.js middleware (server-side auth)
  await page.context().addCookies([{
    name: 'auth-token',
    value: data.accessToken,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);

  // Set localStorage tokens for React AuthProvider (client-side auth)
  await page.addInitScript(`
    localStorage.setItem('accessToken', ${JSON.stringify(data.accessToken)});
    localStorage.setItem('refreshToken', ${JSON.stringify(data.refreshToken)});
    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(data.user))});
  `);

  // Navigate to dashboard - middleware sees cookie, allows access
  // AuthProvider reads localStorage and renders authenticated content
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Wait for sidebar to confirm we're authenticated
  await page.locator('a:has-text("Clientes")').waitFor({ state: 'visible', timeout: 20000 });
}

/**
 * Navigate to a page using sidebar links (client-side navigation).
 */
export async function navigateTo(page: Page, path: string) {
  const sidebarLinks: Record<string, string> = {
    '/clients': 'Clientes',
    '/projects': 'Proyectos',
    '/records/new': 'Carga Manual',
    '/records/import': 'Importar Excel',
    '/users': 'Usuarios',
    '/assignments': 'Asignaciones',
    '/settings/roles': 'Roles y Permisos',
    '/dashboard': 'Dashboard',
  };

  const linkText = sidebarLinks[path];
  if (linkText) {
    const link = page.locator(`a:has-text("${linkText}")`).first();
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.click({ force: true });
    await page.waitForTimeout(1500);
  }
}

/**
 * Login via the UI form (for testing the login flow itself).
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e-screenshots/${name}.png`,
    fullPage: true,
  });
}
