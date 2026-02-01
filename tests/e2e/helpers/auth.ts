import { Page } from '@playwright/test';

/**
 * Helper para autenticación en tests E2E
 */
export async function login(page: Page, email?: string, password?: string) {
  // Usar credenciales de .env o las proporcionadas
  const adminEmail = email || process.env.ADMIN_EMAIL || 'superadmin@lgs.com';
  const adminPassword = password || process.env.ADMIN_PASSWORD || 'taleros4';

  // Ir a login page
  await page.goto('/login');

  // Llenar formulario
  await page.fill('input[name="email"], input[type="email"]', adminEmail);
  await page.fill('input[name="password"], input[type="password"]', adminPassword);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

  // Wait for dashboard to fully load (API calls, permissions, stats)
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Additional wait for React hydration and async API responses
  await page.waitForTimeout(2000);

  // Verify authentication by checking for dashboard content
  const currentUrl = page.url();
  const bodyText = await page.locator('body').textContent();
  const isAuthenticated =
    bodyText?.includes('Panel Administrativo') ||
    bodyText?.includes('Dashboard') ||
    bodyText?.includes('Académico') ||
    bodyText?.includes('Gestión');

  if (!isAuthenticated) {
    throw new Error('Login failed - authentication content not found');
  }

  console.log('✅ Login successful, redirected to:', currentUrl);
}

/**
 * Helper para logout
 */
export async function logout(page: Page) {
  // Buscar botón de logout (puede variar según UI)
  const logoutButton = page.locator('button:has-text("Cerrar sesión"), button:has-text("Logout"), a:has-text("Salir")').first();

  if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL('**/login**', { timeout: 5000 });
    console.log('✅ Logout successful');
  }
}
