import { expect, test } from '@playwright/test';
import { mockPatientAuthFlow } from './mockApi';

test('patient can sign in, complete 2FA, open the dashboard, and log out', async ({ page }) => {
  // Step 1: Block before any app requests are made and wire patient-facing API responses.
  // The page now behaves like the real portal, but with deterministic browser-side data.
  await mockPatientAuthFlow(page);

  // Step 2: Load the app from the login entry point and verify the sign-in screen appears.
  // This confirms the root route and auth shell render correctly in the browser.
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

  // Step 3: Submit credentials and wait for the 2FA screen.
  // The login page should store a challenge token in sessionStorage and navigate forward.
  await page.getByLabel('Email').fill('patient@example.com');
  await page.getByLabel('Password').fill('Passw0rd!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/auth\/2fa-verify/);
  await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();

  // Step 4: Complete the 2FA challenge and confirm the patient dashboard loads.
  // This exercises the full auth handshake and the protected dashboard route.
  await page.getByLabel('Authentication Code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/patient\/dashboard/);
  await expect(page.getByRole('heading', { name: 'My Health Dashboard' })).toBeVisible();
  await expect(page.getByText('Patient read-only view')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Epic' })).toBeVisible();

  // Step 5: Log out from the top navigation and ensure the session is cleared.
  // The logout action should return the browser to the public login entry point.
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
});

test('anonymous users are redirected to login when they try to open a protected route', async ({ page }) => {
  // Step 1: Keep the browser storage empty so the app starts in an unauthenticated state.
  // This mirrors a first-time visitor opening a deep link to a protected page.
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Step 2: Visit a protected patient route directly and confirm the router sends us away.
  // The protected route guard should fall back to the login page for anonymous visitors.
  await page.goto('/patient/dashboard');
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
});
