## 1.5-Week Implementation Plan (2-Person Team, Same Scope)

This plan keeps the same direction, features, and release criteria while making execution realistic for a 2-person team.

Scope constraints remain unchanged:
- Symptom logging is chronic disease-specific only.
- Psoriasis-specific symptoms are required in this phase.
- API, ORM, and migrations enforce this scope.

### Team Model
- Engineer A (Platform and Integration): environment, data model, auth/RBAC/2FA, sync adapters, deployment, hardening.
- Engineer B (Clinical Workflow, Product Features, and Frontend): consent, dashboard aggregation, symptom logging, reports, quick-share, provider efficiency flows, and UI implementation.
- Shared responsibilities: API contracts, frontend-backend integration, test coverage, code review, staging validation, release gates.

### Delivery Strategy
- Work in parallel streams from Day 1 with explicit daily integration checkpoints.
- Deliver thin vertical slices early, then harden and expand to full acceptance criteria.
- Keep one production path: backend API + database + worker queue + secure in-app messaging + production web frontend.
- Defer only non-blocking items to Phase 2.

## 10-Day Execution Plan (2 Parallel Workstreams with Frontend Production)

### Day 1: Foundation and Planning Baseline
- Engineer A
  - Finalize runtime setup, environment config, secrets handling, health endpoints.
  - Stand up API service, database, and worker queue in local and staging-like setup.
  - Define CI/CD skeleton for staging and production.
- Engineer B
  - Finalize API contract outlines for consent, dashboard, symptom logging, alerts, and reports.
  - Select frontend stack, routing approach, and state/data-fetch pattern for production maintainability.
  - Define initial UI information architecture for patient, provider, consent, dashboard, and symptom workflows.
  - Draft acceptance-test checklist mapped to user stories.
  - Create request/response examples for shared contract alignment.
- Joint checkpoint output
  - Shared implementation checklist, contract-first endpoint map, frontend skeleton decision, and smoke-start instructions.

### Day 2: Core Data Model and Migrations
- Engineer A
  - Implement base entities and migrations for patient/provider/ehr/medical records and sync metadata.
  - Enforce UTC timestamp conventions and required relationships.
- Engineer B
  - Implement entities/migrations for consent, alerts, symptom logs, triggers, treatments, report artifacts, secure messaging.
  - Seed Psoriasis trigger checklist data and validation fixtures.
  - Scaffold frontend app shell and baseline layouts for key workflow pages.
- Joint checkpoint output
  - Migration pack and seed scripts run successfully end-to-end; frontend shell renders in local dev.

### Day 3: Security Baseline and API Scaffolding
- Engineer A
  - Implement login flow with mandatory OTP/TOTP 2FA.
  - Add RBAC guardrails (Provider, Admin, Patient) and session/token hardening baseline.
  - Lead frontend auth hardening integration (session expiry behavior, 401/403 routing, and route-guard verification).
- Engineer B
  - Scaffold feature endpoints behind RBAC (consent, dashboard read APIs, symptom logging, reports, quick-share).
  - Implement frontend auth screens, session handling, and role-aware navigation.
  - Add initial frontend unit tests for auth flows and role-aware navigation boundaries.
- Joint checkpoint output
  - Protected API surface available with auth and role checks passing; frontend can authenticate and route by role.

### Day 4: Consent Workflow and Dashboard Slice
- Engineer A
  - Implement audit event persistence primitives and shared notification plumbing.
  - Support authorization document generation service integration hooks.
  - Own frontend-backend contract conformance checks for consent/dashboard payloads and response envelopes.
- Engineer B
  - Implement end-to-end consent flow: request, in-app patient notification, approve/deny, state transition logging.
  - Build first dashboard slice aggregating provider/patient history from mocked external source responses.
  - Build consent and dashboard UI slices wired to live/stubbed APIs.
- Joint checkpoint output
  - Consent flow operational through API and UI; dashboard slice query path validated.

### Day 5: External Integration and Dashboard Completion
- Engineer A
  - Build Epic/NextGen adapter base flows for bi-directional push/pull and per-category last-synced timestamps (UTC).
  - Add conflict detection event generation and alert hooks.
  - Validate frontend environment/runtime configuration for multi-environment API endpoints and deployment-safe defaults.
- Engineer B
  - Complete dashboard acceptance criteria: at least two external provider sources, consolidated provider list, full medical history, missing-data prompts, patient read-only behavior.
  - Complete dashboard frontend experience for consolidated history, missing-data prompts, and timestamp visibility.
- Joint checkpoint output
  - Dashboard meets story-level criteria in API and UI; sync adapter skeleton runs with test fixtures.

### Day 6: Sync Production Path and Alerting Integration
- Engineer A
  - Complete FHIR R4/HL7 phase-required paths for Epic/NextGen adapters.
  - Wire conflict detection to provider alert generation (manual resolution only).
  - Implement frontend observability and error-surface hooks for sync/alert retrieval failures.
- Engineer B
  - Integrate sync outcomes into dashboard freshness/missing-data signals.
  - Surface sync freshness and conflict alerts in frontend provider views.
  - Add frontend tests for timestamp behavior, conflict alert visibility, and category-level freshness.
- Joint checkpoint output
  - Working sync pipeline with conflict alerts and visible sync metadata in API and UI.

### Day 7: Symptom Logging (Psoriasis-Specific Enforcement)
- Engineer A
  - Strengthen validation middleware and persistence constraints for chronic disease-specific payload handling.
  - Verify schema constraints align with migration and ORM model behavior.
  - Verify frontend-backend schema parity for symptom payload validation and error contract handling.
- Engineer B
  - Implement symptom APIs and business logic enforcing Psoriasis-specific fields and severity rules.
  - Validate triggers against seeded Psoriasis checklist; allow OTC treatment free text.
  - Implement symptom logging UI forms with psoriasis-specific validations and retrieval views.
- Joint checkpoint output
  - Symptom logging API, ORM, migration behavior, and frontend forms aligned to scope constraints.

### Day 8: Reports, Quick-Share, and Provider Efficiency
- Engineer A
  - Finalize worker/background execution for report generation and secure message dispatch.
  - Add reliability/error handling instrumentation.
  - Integrate frontend report/quick-share flows into CI smoke checks and release pipeline gates.
- Engineer B
  - Implement PDF symptom trend report generation and secure in-app sharing.
  - Implement auto-population from most recent prior visit per patient-provider pair.
  - Implement configurable negative-trend threshold logic and quick-share progress report flow to PCP.
  - Implement report generation and quick-share frontend flows with clear progress/error states.
- Joint checkpoint output
  - Provider workflow features operational end-to-end in API, worker path, and frontend.

### Day 9: Hardening, Audit, and Staging Validation
- Engineer A
  - Validate encryption config for data in transit and at rest.
  - Finalize complete audit logging for security-sensitive actions.
  - Execute deployment rehearsal to staging.
  - Own frontend staging pipeline verification (build, deploy, smoke gating, and rollback validation).
- Engineer B
  - Run full story-level validation suite across sync, dashboard, symptom reporting, consent, and alerts/quick-share.
  - Run frontend regression suite and cross-browser smoke checks for core user journeys.
  - Triage defects by release-blocking vs non-blocking and coordinate fixes.
- Joint checkpoint output
  - Staging sign-off report with backend and frontend validation complete and only non-blocking defects remaining.

### Day 10: Release Gates and Go-Live
- Engineer A
  - Execute production deployment, post-deploy verification, and rollback readiness checks.
  - Confirm operational runbook and monitoring hooks.
  - Execute frontend production deployment verification and release-gate sign-off from platform perspective.
- Engineer B
  - Run must-pass regression and business acceptance checks.
  - Validate final user-facing workflows and data integrity.
  - Execute final frontend usability and workflow sign-off from product/UX perspective.
- Joint checkpoint output
  - Deployment-ready V1 live with production frontend and Phase 2 backlog frozen with priorities and owners.

## Frontend Production Track (Cross-Cutting)

- Implement a production web frontend that consumes the API and covers Day 1-10 core workflows.
- Enforce role-aware UX for Patient, Provider, and Admin views.
- Include loading, empty, error, and retry states for every critical data retrieval screen.
- Add frontend unit/component tests plus end-to-end happy-path checks for consent, dashboard, symptoms, and quick-share.
- Integrate frontend build and smoke validation into CI/CD before staging and production promotion.

### Remaining Frontend Tasks (Post-Day-2) - Even Split

Day 2 frontend implementation by Engineer B is complete for the core patient/provider pages and shared app shell.
The remaining frontend work from Day 3 onward is split evenly between Engineer A and Engineer B.

Engineer A (Frontend Platform, Integration, and Release)
- Own frontend-backend contract conformance checks and response envelope alignment during Day 3-8 integration.
- Own frontend authentication and authorization hardening integration (2FA edge cases, route protection verification, token/session expiry behavior).
- Own frontend build/deploy pipeline integration in CI/CD, including staging smoke gates and production promotion checks.
- Own runtime configuration management for frontend environments (dev/staging/prod variables and deployment-safe defaults).
- Own observability hooks for frontend production readiness (error capture plumbing and release verification checks).

Engineer B (Frontend Product Workflow, UX, and Validation)
- Own continued enhancement of patient/provider workflow UIs tied to Day 4-8 feature completion.
- Own loading/error/empty/retry UX completion across all story-critical screens.
- Own frontend test authoring for workflow behavior (unit/component/integration happy paths and failure paths).
- Own cross-browser workflow validation and usability pass for core journeys.
- Own final user-facing regression and acceptance validation for consent, dashboard, symptom logging, reports, alerts, and quick-share.

Shared (Equal Accountability)
- Pair-review all frontend PRs with one reviewer required from the other engineer.
- Resolve frontend-backend contract drift within the same day it is detected.
- Triage frontend defects together by release-blocking vs non-blocking severity.

### Frontend Access Instructions for Engineer A

See [docs/frontend_access_instructions.md](docs/frontend_access_instructions.md) for the standalone startup and environment setup steps.

## Daily Operating Rhythm (Required for 2-Person Throughput)

- 30-minute morning planning: dependency review, risk check, and ownership confirmation.
- Midday integration checkpoint: merge/rebase, run backend and frontend tests, resolve API contract drift immediately.
- End-of-day demo and gate check: ensure one integrated increment is testable daily.
- Review policy: no feature branch merges without at least one reviewer sign-off from the other engineer.
- Test policy: each completed feature includes backend tests, frontend tests where applicable, and at least one integration-path validation.

## Must-Pass Release Gates (Day 10)

- Mandatory 2FA enforced for all login attempts.
- RBAC enforced for Provider/Admin/Patient access boundaries.
- Production frontend deployed and reachable with authenticated role-based navigation.
- Sync works for Epic/NextGen with conflict detection and provider alerts.
- Last-synced timestamps shown per data category in UTC.
- Dashboard aggregates at least two external sources and highlights missing data.
- Symptom API accepts chronic disease-specific payloads only.
- Psoriasis-specific symptom fields are enforced and persisted.
- Psoriasis trigger checklist is seeded and validated.
- Trend report PDF generation and secure in-app sharing work end-to-end.
- Consent request/notify/approve-deny/document generation all function correctly.
- Auto-population and negative-trend provider alerts work per configured rules.
- Frontend user journeys for consent, dashboard, symptom logging, and quick-share pass staging smoke tests.
- Audit logs recorded for critical actions and retained per policy configuration.
- Staging and production deployment scripts execute successfully.

## Deferred to Future Implementation (Phase 2)

- Additional EHR vendors beyond Epic and NextGen.
- Automatic conflict resolution workflows.
- Biometric authentication.
- OTC formulary validation or clinical decision support.
- Expansion beyond Psoriasis to other chronic-condition symptom templates.
- Native mobile applications.
- Telehealth/video workflows.
- Scheduling, billing, claims, and revenue-cycle functions.
- Network/server provisioning concerns outside this subsystem.
