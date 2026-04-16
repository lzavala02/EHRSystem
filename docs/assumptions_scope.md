# Assumptions and Scope

## Assumptions

- The clinic has procured API access credentials for at least one major EHR system (Epic or NextGen), and those systems expose compliant FHIR R4 or HL7 v2 endpoints.
- Network connectivity between the clinic and remote EHR systems is stable and managed outside this subsystem; the 'Last Synced' timestamp is stored in UTC.
- Patients have already linked at least two external provider accounts during onboarding before accessing the unified dashboard.
- Dashboard data is read-only for patients; 'Missing Data' required fields will be defined and configured during implementation.
- The Triggers checklist will be pre-seeded for Psoriasis only; OTC treatment entries are free-text and will not be validated against a drug formulary in this phase.
- Symptom Trend Reports will be generated in PDF format and shared via the app's secure in-app messaging feature.
- 2FA will use TOTP or SMS OTP; biometric authentication is excluded from this phase.
- The HIPAA-compliant authorization document template will be pre-approved by the clinic's legal/compliance team before implementation begins.
- Auto-population pulls from the single most recent prior visit per patient-provider pair.
- The 'negative trend' alert threshold (e.g., symptom severity over N days) will be defined collaboratively with clinical staff during implementation.
- All data at rest and in transit will be encrypted (AES-256 / TLS 1.2+), with a full audit log retained for a minimum of 6 years per HIPAA requirements.
- RBAC roles (Provider, Admin, Patient) will be defined and maintained by the clinic prior to go-live.

---

## In-Scope

- Bi-directional FHIR/HL7 Push/Pull synchronization with Epic and NextGen, including automated conflict detection and provider alert notifications.
- Per-category 'Last Synced' timestamp display for Medications, Labs, and other defined data categories.
- Unified Chronic Disease Dashboard aggregating data from at least two external EHR sources, with a consolidated provider list and full medical history.
- Missing Data field highlighting with patient-facing prompts to complete incomplete records.
- Chronic symptom and trigger logging module with predefined Psoriasis fields, a standard triggers checklist, and free-text OTC treatment entry.
- Symptom Trend Report generation and secure in-app sharing with providers.
- Secure digital consent workflow: real-time patient notification on access requests with in-app Approve/Deny controls and auto-generated HIPAA-compliant authorization document.
- Mandatory Two-Factor Authentication (2FA) for all user login attempts.
- Auto-population of redundant documentation fields from the most recent prior visit, and configurable negative-trend alerts to providers.
- Quick-Share feature for providers to send progress reports to the patient's Primary Care Physician (PCP) via in-app secure messaging.

---

## Out-of-Scope

- Integration with EHR systems beyond Epic and NextGen (e.g., Cerner, Athenahealth); additional vendors are a future-phase item.
- Auto-resolution of data conflicts during synchronization; conflicts must be resolved manually by the provider.
- Biometric authentication (Face ID, fingerprint); only TOTP/SMS-based 2FA is in scope for this phase.
- Drug formulary validation or clinical decision support (CDS) for OTC treatment entries.
- Expansion of the symptom/trigger logging module to chronic conditions beyond Psoriasis in this phase.
- Telehealth, video consultation, or real-time communication features beyond in-app secure messaging.
- Scheduling, billing, claims processing, or any revenue cycle management functionality.
- Network infrastructure, server provisioning, or hosting environment setup.