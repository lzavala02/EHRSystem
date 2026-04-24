import { expect, test } from '@playwright/test';
import { mockProviderWorkflowFlow } from './mockApi';

test('provider can search patients, select one, generate a report, and quick-share it', async ({ page }) => {
  // Step 1: Install provider-facing API mocks before the app starts issuing network calls.
  // The browser sees a realistic provider workflow without depending on the backend process.
  await mockProviderWorkflowFlow(page);

  // Step 2: Sign in as a provider and finish the 2FA step to reach the protected portal.
  // This confirms the provider role lands on the correct default route.
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('provider@example.com');
  await page.getByLabel('Password').fill('Passw0rd!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/auth\/2fa-verify/);
  await page.getByLabel('Authentication Code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/provider\/patients/);
  await expect(page.getByRole('heading', { name: 'My Patients' })).toBeVisible();

  // Step 3: Narrow the patient list and select a workflow patient.
  // The selected patient state should flow through the shared provider-side context.
  await page.getByPlaceholder('Search by name, condition, or patient ID').fill('Taylor');
  await expect(page.getByText('Taylor Chronic')).toBeVisible();
  await page.getByRole('button', { name: 'Select for Workflow' }).click();
  await expect(page.getByRole('button', { name: 'Selected' })).toBeVisible();

  // Step 4: Navigate to Quick-Share using the sidebar and confirm the selected patient carries over.
  // This checks that the shared selection context survives route changes in the browser.
  await page.getByRole('button', { name: 'Quick-Share' }).click();
  await expect(page).toHaveURL(/\/provider\/quick-share/);
  await expect(page.getByRole('heading', { name: /Quick-Share/i })).toBeVisible();
  await expect(page.getByLabel('Patient')).toHaveValue('pat-2');

  // Step 5: Generate a trend report and wait for the mocked job to complete.
  // The UI should show the completion state and the new report identifier.
  await page.getByRole('button', { name: 'Generate Report' }).click();
  await expect(page.getByText('Report generation started. Waiting for completion...')).toBeVisible();
  await expect(page.getByText('Trend report generated and ready to share.')).toBeVisible();
  await expect(page.getByText('Report ID: rep-1')).toBeVisible();

  // Step 6: Fill the share form and send the report to another provider.
  // This verifies the final collaboration action in the provider browser journey.
  await page.getByLabel('Destination Provider ID').fill('prov-derm');
  await page.getByLabel('Message (Optional)').fill('Please review before next visit.');
  await page.getByRole('button', { name: /Send Quick-Share/i }).click();
  await expect(page.getByText(/Quick-share sent successfully/i)).toBeVisible();
});
