## 1.5-Week Implementation Plan (Entire Project, Updated Scope)

This plan is deployment-first, covers all in-scope features, and applies the new symptom changes:
- Symptom logging is chronic disease-specific only.
- Psoriasis-specific symptoms are required in this phase.
- API, ORM, and migrations must enforce that scope.

### Delivery Strategy
- Build a thin vertical slice for each feature so the full product works end-to-end by Day 10.
- Defer non-blocking enhancements to a clearly defined Phase 2 backlog.
- Use one production path: backend API + database + background worker + secure in-app messaging.

## Day-by-Day Plan (10 Working Days)

### Day 1: Foundation and Environment
- Finalize project configuration, environments, secrets handling, and health endpoints.
- Stand up core runtime stack (API service, database, worker queue).
- Define deployment pipeline for staging and production.
- Output: repeatable deploy baseline and smoke-start instructions.

### Day 2: Data Model and Migrations (Whole System)
- Finalize ORM entities and migrations for:
  - patient/provider/ehr/medical records
  - access requests/authorization docs
  - alerts
  - symptom logs/triggers/treatments/report artifacts
  - secure in-app messaging
- Enforce UTC timestamps and required relationships.
- Seed Psoriasis trigger checklist data.
- Output: migration pack and seed scripts validated locally.

### Day 3: Auth, RBAC, and Mandatory 2FA
- Implement login flow with mandatory OTP/TOTP 2FA.
- Enforce role-based access (Provider, Admin, Patient) across all endpoints.
- Add baseline session/token hardening.
- Output: protected API surface with role checks passing.

### Day 4: Consent Workflow End-to-End
- Build consent request, real-time patient notification (in-app), approve/deny actions.
- Generate HIPAA-compliant authorization document from approved template.
- Persist all consent state transitions and audit events.
- Output: consent workflow fully operational through API.

### Day 5: Unified Dashboard End-to-End
- Aggregate data from at least two linked external provider sources.
- Return consolidated provider list and full medical history.
- Implement configurable missing-data highlighting prompts.
- Keep dashboard read-only for patient users.
- Output: dashboard API meeting acceptance criteria.

### Day 6: Cross-System Sync (Epic/NextGen Only)
- Implement bi-directional push/pull integration for Epic/NextGen adapters.
- Support FHIR R4/HL7 paths required for this phase.
- Add conflict detection with provider alert generation (manual resolution only).
- Store per-category last-synced timestamps in UTC.
- Output: working sync pipeline with conflict alerts.

### Day 7: Symptom Logging (Updated Constraint Applied)
- Implement symptom APIs and validation for chronic disease-specific payloads only.
- Enforce Psoriasis-specific symptom fields and severity rules.
- Validate triggers only against seeded Psoriasis checklist.
- Allow OTC treatments as free text (no formulary validation).
- Output: symptom logging API, ORM, and migration behavior aligned to new scope.

### Day 8: Trend Reports, Quick-Share, and Provider Efficiency
- Generate symptom trend reports in PDF format.
- Share reports via secure in-app messaging.
- Implement auto-population from most recent prior visit per patient-provider pair.
- Add configurable negative-trend alert threshold logic.
- Add quick-share progress reports to PCP via secure in-app messaging.
- Output: provider workflow features operational end-to-end.

### Day 9: Hardening, Audit, and Staging Validation
- Validate encryption requirements for data at rest/in transit via deployment config.
- Confirm complete audit logging for security-sensitive actions.
- Run staging verification across all stories:
  - sync
  - dashboard
  - symptom logging/reporting
  - consent
  - alerts/quick-share
- Output: staging sign-off report with only non-blocking defects remaining.

### Day 10: Release Gates and Go-Live
- Run must-pass regression and deployment checks.
- Execute production deployment and post-deploy verification.
- Freeze deferred work into Phase 2 backlog with priorities and owners.
- Output: deployment-ready V1 live with defined next-phase roadmap.

## Must-Pass Release Gates (Day 10)

- Mandatory 2FA enforced for all login attempts.
- RBAC enforced for Provider/Admin/Patient access boundaries.
- Sync works for Epic/NextGen with conflict detection and provider alerts.
- Last-synced timestamps shown per data category in UTC.
- Dashboard aggregates at least two external sources and highlights missing data.
- Symptom API accepts chronic disease-specific payloads only.
- Psoriasis-specific symptom fields are enforced and persisted.
- Psoriasis trigger checklist is seeded and validated.
- Trend report PDF generation and secure in-app sharing work end-to-end.
- Consent request/notify/approve-deny/document generation all function correctly.
- Auto-population and negative-trend provider alerts work per configured rules.
- Audit logs recorded for critical actions and retained per policy configuration.
- Staging and production deployment scripts execute successfully.

## Deferred to Future Implementation (Phase 2)

- Additional EHR vendors beyond Epic and NextGen.
- Automatic conflict resolution workflows.
- Biometric authentication.
- OTC formulary validation or clinical decision support.
- Expansion beyond Psoriasis to other chronic-condition symptom templates.
- Telehealth/video workflows.
- Scheduling, billing, claims, and revenue-cycle functions.
- Network/server provisioning concerns outside this subsystem.
