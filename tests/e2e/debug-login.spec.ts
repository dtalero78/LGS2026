import { test, expect } from '@playwright/test';

/**
 * Test de debugging para entender por qué el login no funciona
 */
test.describe('DEBUG - Login Process', () => {
  test('Debug: Manual login step by step with screenshots', async ({ page }) => {
    // 1. Ir a login
    await page.goto('/login');
    await page.screenshot({ path: 'debug-01-login-page.png', fullPage: true });
    console.log('✅ Step 1: Navigated to /login');

    // 2. Verificar que el formulario existe
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    console.log('✅ Step 2: Form elements are visible');

    // 3. Llenar credenciales
    await emailInput.fill('superadmin@lgs.com');
    await passwordInput.fill('taleros4');
    await page.screenshot({ path: 'debug-02-credentials-filled.png', fullPage: true });
    console.log('✅ Step 3: Credentials filled');

    // 4. Verificar valores llenados
    const emailValue = await emailInput.inputValue();
    const passwordValue = await passwordInput.inputValue();
    console.log('Email value:', emailValue);
    console.log('Password value:', passwordValue);
    expect(emailValue).toBe('superadmin@lgs.com');
    expect(passwordValue).toBe('taleros4');

    // 5. Click submit y esperar
    console.log('🔄 Clicking submit button...');
    await submitButton.click();
    await page.screenshot({ path: 'debug-03-after-click.png', fullPage: true });

    // 6. Esperar un poco para que procese
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'debug-04-after-wait.png', fullPage: true });

    // 7. Verificar URL actual
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // 8. Verificar contenido de la página
    const bodyText = await page.locator('body').textContent();
    console.log('Body contains "Panel Administrativo":', bodyText?.includes('Panel Administrativo'));
    console.log('Body contains "Dashboard":', bodyText?.includes('Dashboard'));
    console.log('Body contains "Académico":', bodyText?.includes('Académico'));
    console.log('Body contains "Credenciales inválidas":', bodyText?.includes('Credenciales inválidas'));
    console.log('Body contains "Error":', bodyText?.includes('Error'));

    // 9. Verificar console logs del browser
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    // 10. Tomar screenshot final
    await page.screenshot({ path: 'debug-05-final-state.png', fullPage: true });

    // 11. Final assertion (probablemente fallará, pero queremos ver los logs)
    expect(currentUrl).not.toContain('/login');
  });

  test('Debug: Check if NextAuth endpoint works', async ({ page, request }) => {
    // Probar el endpoint de NextAuth directamente
    const response = await request.post('/api/auth/callback/credentials', {
      data: {
        email: 'superadmin@lgs.com',
        password: 'taleros4',
        redirect: false,
        callbackUrl: '/',
        json: true
      }
    });

    console.log('NextAuth API Response Status:', response.status());
    console.log('NextAuth API Response Headers:', response.headers());

    const body = await response.text();
    console.log('NextAuth API Response Body:', body);
  });
});
