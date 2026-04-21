// Playwright API mocks for browser-based frontend E2E tests.
//
// The frontend uses Axios against the app origin, so these helpers intercept
// the same browser requests that a real backend would handle. Each flow gets
// stable, deterministic responses while still exercising the full UI in a real
// browser.

import { Page } from '@playwright/test';

const ISO_NOW = '2026-04-21T12:00:00.000Z';

export async function mockPatientAuthFlow(page: Page) {
  await page.route('**/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challenge_id: 'challenge-patient',
        expires_at: ISO_NOW,
        methods: ['totp']
      })
    });
  });

  await page.route('**/v1/auth/2fa/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-patient-1',
        role: 'Patient',
        email: 'patient@example.com',
        name: 'Jordan Patient',
        session_token: 'session-patient-1',
        expires_at: ISO_NOW,
        patient_id: 'pat-1'
      })
    });
  });

  await page.route('**/v1/dashboard/patients/pat-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        patient_id: 'pat-1',
        patient_profile: {
          height: 170,
          weight: 72,
          vaccination_record: 'Up to date',
          family_history: 'Psoriasis'
        },
        source_systems: [
          { system_id: 'sys-epic', system_name: 'Epic' },
          { system_id: 'sys-nextgen', system_name: 'NextGen' }
        ],
        providers: [
          {
            provider_id: 'prov-pcp',
            provider_name: 'Dr. Ada Provider',
            specialty: 'Primary Care',
            clinic_affiliation: 'North Clinic'
          }
        ],
        medical_history: [
          {
            record_id: 'rec-1',
            category: 'Medications',
            value_description: 'Topical corticosteroid',
            recorded_at: '2026-04-12T07:40:00.000Z',
            system_id: 'sys-epic',
            system_name: 'Epic'
          }
        ],
        missing_data: [
          { field_name: 'Allergies', reason: 'Not yet recorded' }
        ]
      })
    });
  });

  await page.route('**/v1/dashboard/patients/pat-1/sync-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        patient_id: 'pat-1',
        sync_status: [
          {
            category: 'Medications',
            last_synced_at: '2026-04-12T07:40:00.000Z',
            system_id: 'sys-epic',
            system_name: 'Epic'
          }
        ]
      })
    });
  });

  await page.route('**/v1/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' })
    });
  });
}

export async function mockProviderWorkflowFlow(page: Page) {
  await page.route('**/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challenge_id: 'challenge-provider',
        expires_at: ISO_NOW,
        methods: ['totp']
      })
    });
  });

  await page.route('**/v1/auth/2fa/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-provider-1',
        role: 'Provider',
        email: 'provider@example.com',
        name: 'Dr. Ada Provider',
        session_token: 'session-provider-1',
        expires_at: ISO_NOW,
        provider_id: 'prov-pcp'
      })
    });
  });

  await page.route('**/v1/provider/patients', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        patients: [
          {
            patient_id: 'pat-1',
            patient_name: 'Jordan Patient',
            primary_condition: 'Psoriasis',
            last_visit: '2026-04-12T10:00:00.000Z'
          },
          {
            patient_id: 'pat-2',
            patient_name: 'Taylor Chronic',
            primary_condition: 'Dermatitis',
            last_visit: '2026-04-11T10:00:00.000Z'
          }
        ],
        total: 2,
        page: 1,
        page_size: 2
      })
    });
  });

  await page.route('**/v1/symptoms/reports/trend', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        report_id: 'rep-1',
        status: 'pending',
        created_at: ISO_NOW,
        job_id: 'rep-1'
      })
    });
  });

  await page.route('**/v1/reports/rep-1/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'completed',
        data: { report_id: 'rep-1' }
      })
    });
  });

  await page.route('**/v1/provider/quick-share', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        share_id: 'share-1',
        status: 'pending',
        created_at: ISO_NOW,
        message: 'Progress report shared with provider prov-derm.'
      })
    });
  });
}

export async function mockPatientSymptomWorkflowFlow(page: Page) {
  await mockPatientAuthFlow(page);

  await page.route('**/v1/symptoms/triggers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        triggers: [
          { trigger_id: 'trigger-stress', trigger_name: 'Stress', category: 'Lifestyle' },
          { trigger_id: 'trigger-weather', trigger_name: 'Weather Change', category: 'Environment' }
        ]
      })
    });
  });

  await page.route('**/v1/symptoms/logs**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          log_id: 'log-1',
          patient_id: 'pat-1',
          created_at: ISO_NOW
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        logs: [
          {
            log_id: 'log-1',
            patient_id: 'pat-1',
            symptom_description: 'Red plaques are flaring on my elbows and scalp.',
            severity_scale: 8,
            triggers: [
              { trigger_id: 'trigger-stress', trigger_name: 'Stress' }
            ],
            otc_treatments: ['Hydrocortisone cream'],
            created_at: ISO_NOW
          }
        ],
        total: 1,
        page: 1,
        page_size: 20
      })
    });
  });

  await page.route('**/v1/reports/rep-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        report_id: 'rep-1',
        patient_id: 'pat-1',
        generated_at: ISO_NOW,
        secure_url: 'https://secure.example.test/reports/rep-1',
        expires_at: '2026-05-21T12:00:00.000Z'
      })
    });
  });
}
