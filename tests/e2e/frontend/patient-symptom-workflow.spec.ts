import { expect, test } from '@playwright/test';
import { mockPatientSymptomWorkflowFlow } from './mockApi';

test('patient can log a symptom, review history, and open a shared report', async ({ page }) => {
  // Step 1: Install patient-facing route mocks before the app starts issuing requests.
  // This keeps the browser flow deterministic while still exercising the real UI.
  await mockPatientSymptomWorkflowFlow(page);

  // Step 2: Sign in and complete 2FA so we can reach the protected patient portal.
  // The auth flow should land the patient on their dashboard as the starting point.
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('patient@example.com');
  await page.getByLabel('Password').fill('Passw0rd!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/auth\/2fa-verify/);
  await page.getByLabel('Authentication Code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/patient\/dashboard/);

  // Step 3: Open the symptom logging screen through the authenticated sidebar.
  // This follows the real in-app patient navigation path after the protected shell is loaded.
  await page.getByRole('button', { name: 'Symptom Logs' }).click();
  await expect(page.getByRole('heading', { name: 'Log Symptom' })).toBeVisible();
  await page.getByLabel('Symptom Description').fill('Red plaques are flaring on my elbows and scalp.');
  await page.getByLabel('Stress').check();
  await page.getByLabel('OTC Treatments (comma-separated)').fill('Hydrocortisone cream, Salicylic acid');
  await page.getByRole('button', { name: 'Save Symptom Log' }).click();
  await expect(page.getByText('Symptom log saved successfully.')).toBeVisible();

  // Step 4: Open symptom history and confirm the saved log is visible with trigger and treatment details.
  // This verifies the UI can read back the same clinical history it just wrote.
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'Symptom History' })).toBeVisible();
  await expect(page.getByText('Red plaques are flaring on my elbows and scalp.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Stress' })).toBeVisible();
  await expect(page.getByText('Hydrocortisone cream')).toBeVisible();

  // Step 5: Open the shared report screen and load a valid report identifier.
  // The page should show the secure report link once the report is fetched.
  await page.getByRole('button', { name: 'Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Shared Reports' })).toBeVisible();
  await page.getByLabel('Report ID').fill('rep-1');
  await page.getByRole('button', { name: 'Load Report' }).click();
  await expect(page.getByText('Report loaded successfully.')).toBeVisible();
  await expect(page.getByText('rep-1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Secure Report' })).toBeVisible();
});