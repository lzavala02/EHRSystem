# ADR-001: Architecture Decisions for the Chronic Disease EHR Subsystem

**Status:** Accepted

**Context:**
A small outpatient clinic requires a Patient Health Record subsystem to support chronic disease management across five functional areas: bi-directional EHR synchronization with Epic and NextGen, a unified chronic disease dashboard, a symptom and trigger logging module, a secure digital consent workflow, and automated provider alerting with documentation assistance. The system must serve three user roles — Healthcare Providers, Patients, and Caregivers — at department scale, with many concurrent users and a strict no-data-loss reliability requirement. All data handling is governed by HIPAA, mandating AES-256 encryption at rest, TLS 1.2+ in transit, a six-year audit log retention period, and mandatory Two-Factor Authentication for all login attempts. The development team is small with a student background and has one month to deliver a working system. These constraints — tight timeline, small team, regulated data, and a single deployment target — collectively govern all five architecture decisions recorded below.

**Decision:**
Five architecture decisions were made jointly, as each reinforces the others and none should be evaluated in isolation.

*System Roles and Communication — Client–Server:*
The system is built on a Client–Server model in which a React single-page application or mobile client communicates with a centralized backend server over HTTPS REST APIs. The server owns all business logic, orchestrates FHIR R4 adapter calls to Epic and NextGen, enforces RBAC, and manages the audit log. Clients are thin: they render data and submit user actions. EHR synchronization and PDF report generation that require longer processing time are handled as background jobs initiated and managed by the server.

*Deployment and Evolution — Monolith:*
All five feature modules are built, tested, and deployed as a single application. Inter-module communication happens in-process via service calls rather than over a network. The monolith is internally organized using Layered Architecture to maintain clear boundaries without introducing distributed system complexity. There is no independent deployment or scaling of individual features in this phase.

*Code Organization — Layered Architecture:*
The server-side codebase is organized into three horizontal layers with a strict unidirectional dependency rule. The Presentation Layer — controllers and API route handlers — depends on the Business Logic Layer — services, domain rules, workflow orchestration, and FHIR adapter calls — which depends on the Data Access Layer — repositories, ORM models, and query logic. No layer may import from a layer above it. Cross-cutting concerns such as authentication, 2FA enforcement, RBAC, and audit logging are implemented once in the Business Logic Layer and applied consistently across all five features.

*Data and State Ownership — Single Database:*
All feature modules share a single PostgreSQL database instance. Patient records, EHR sync state, symptom logs, consent authorizations, alert configurations, and the HIPAA audit log all reside in one schema. Cross-feature queries are standard SQL joins. Operations requiring atomicity across feature domains — such as recording a consent approval and generating the corresponding HIPAA authorization document — use standard ACID database transactions. RBAC is enforced at the application layer.

*Interaction Model — Hybrid Synchronous and Asynchronous:*
All direct user-facing API calls use synchronous request–response communication, as clinical users require immediate feedback when submitting symptom logs, approving consent requests, or responding to alerts. Operations involving external EHR APIs or multi-step document generation are dispatched as background jobs: the server enqueues the job, returns an immediate HTTP 202 acknowledgment, and the client polls a status endpoint or receives a push notification upon completion. A job queue library — Bull for Node.js or Celery for Python — manages background job execution and retry logic. The per-category Last Synced timestamp is updated by the background sync job upon successful completion.

**Alternatives Considered:**

*Event-Driven Architecture* was evaluated for the provider alerting and consent notification features, which appear to benefit from asynchronous event propagation. It was rejected because a full event-driven system requires a message broker, consumer group management, dead-letter queue handling, and event schema governance — operational demands that exceed both the team's capacity and the one-month delivery window. The same notification behaviors are achievable within the Client–Server model using scheduled background jobs and push notification APIs.

*Microservices* were evaluated given the natural modularity of the five features — the FHIR Sync Service, Consent Service, and Alert Service could in principle be independently deployable. They were rejected because doing so would require the team to implement service discovery, inter-service authentication, distributed tracing, and network resilience, none of which can be delivered correctly in four weeks. The features also share too much data — patient records, provider lists, consent state — to be cleanly separated without introducing distributed transactions or eventual consistency, both of which are incompatible with HIPAA's data integrity requirements at this team's scale.

*Feature-Based Architecture* was evaluated as an alternative code organization strategy because it co-locates all code for a given feature and reduces cross-directory navigation during iteration. It was rejected because the five features share significant cross-cutting logic — patient identity, RBAC enforcement, audit logging, and 2FA — that would need to be duplicated or awkwardly shared across feature directories. Layered Architecture handles these shared concerns more naturally through service injection and applies a structure that the team's frameworks enforce by default.

*Database per Service* was evaluated in conjunction with the Microservices option and rejected for the same foundational reason: this system is a monolith, and splitting the database without splitting the deployment introduces all the complexity of distributed data — eventual consistency, cross-service joins via API calls, distributed transaction coordination — with none of the deployment independence benefits. Cross-feature queries such as joining symptom logs with patient identity and provider records for a Symptom Trend Report are trivial with one database and operationally expensive across separate data stores.

*A fully synchronous interaction model* was considered for its simplicity. It was rejected for operations involving external EHR APIs because FHIR response times from Epic or NextGen can exceed 30 seconds under load, which would block the HTTP connection, risk client-side timeouts, and degrade the experience for all concurrent users. *A fully asynchronous model* was also considered and rejected because it would introduce unnecessary latency and complexity into interactions where users require immediate feedback — most critically the 2FA verification step during login and the in-app Approve/Deny consent control.

**Consequences:**

*Positive:*
- The Client–Server model with REST APIs aligns natively with the FHIR R4 specification, simplifying integration with Epic and NextGen and reducing the risk of protocol-level implementation errors.
- Deploying as a monolith with in-process module communication eliminates the need for service discovery, inter-service authentication, and distributed tracing, reducing DevOps overhead to a level manageable by a small student team in one month.
- The Layered Architecture's unidirectional dependency rule makes it structurally difficult for data access logic to leak into controllers or for business rules to scatter across the codebase, which directly supports the auditability and separation of concerns required under HIPAA.
- A single PostgreSQL instance makes cross-feature queries straightforward SQL joins and allows ACID transactions to handle multi-step operations atomically — eliminating the need for saga orchestration or compensating transactions across feature boundaries.
- Background job queues for FHIR sync and PDF generation provide built-in retry logic for transient external API failures, improving reliability without requiring the client to re-initiate requests.
- All five decisions favor patterns that the team's chosen frameworks (Spring Boot, Django REST Framework, or Express) enforce or document by default, reducing the learning curve and the risk of structural mistakes under time pressure.

*Negative:*
- The centralized server and single database each represent a single point of failure; mitigation requires load balancing, database replication, and validated backup procedures, all of which add operational overhead beyond the core development work.
- A poorly optimized query in the FHIR sync background job competes for the same database connection pool as the user-facing API, meaning a runaway sync operation can degrade dashboard response times for active clinical users.
- Schema changes to shared tables — particularly the patient and provider tables referenced by all five features — carry regression risk across the entire system and require disciplined database migration management.
- The hybrid interaction model requires the team to implement and maintain two distinct patterns within the same codebase — synchronous REST handlers and an asynchronous job queue — increasing testing surface area and the complexity of error-state design for failed background jobs.
- The Layered Architecture does not automatically enforce boundaries between the five feature domains within each layer; undisciplined cross-feature service calls inside the Business Logic Layer must be caught through code review rather than compiler or framework constraints.
- Adopting a monolith now means that extracting a high-throughput feature — such as real-time lab result streaming if a future phase requires it — will demand deliberate refactoring effort rather than independent redeployment.