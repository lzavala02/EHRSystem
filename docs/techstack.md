# ADR-001: Tech Stack Selection for Patient EHR Subsystem — Chronic Disease Management

**Status:** Accepted

---

## Context

A small outpatient clinic requires a Patient Health Record (EHR) Subsystem for Chronic Disease Management. The system must support five feature modules: patient record management, EHR synchronization with Epic and NextGen via FHIR R4 adapters, symptom logging, consent management, and configurable alerting.

The architecture is defined as a React single-page application (or mobile client) communicating with a centralized backend over HTTPS REST APIs. The backend is a monolith organized using Layered Architecture (Presentation → Business Logic → Data Access), deployed as a single unit with no independent module scaling in this phase. All modules share a single PostgreSQL database. Background jobs handle EHR synchronization and PDF report generation asynchronously, returning HTTP 202 acknowledgments while a job queue manages execution and retries. Cross-cutting concerns — authentication, 2FA enforcement, RBAC, and HIPAA audit logging — are implemented once in the Business Logic Layer and applied uniformly.

Key constraints include HIPAA compliance requirements, FHIR R4 interoperability with Epic and NextGen, the need for ACID-compliant transactions across feature domains, and a small clinic operating budget that favors convention over extensive custom infrastructure.

---

## Decision

**Selected stack: Python / Django (Stack 2)**

The backend will be built with Django and Django REST Framework (DRF), using Celery with Redis as the background job queue. The frontend will be a React + Vite single-page application communicating over HTTPS REST. The single shared database will be PostgreSQL. Deployment will target an AWS environment with a signed HIPAA Business Associate Agreement (BAA).

The full selected stack is:

**Presentation layer**
- React + Vite (SPA thin client)
- React Native (mobile client, if required)
- DRF serializers as the REST interface contract

**Business Logic layer**
- Django + Django REST Framework (RBAC enforcement, FHIR adapter orchestration, workflow services)
- Celery (background job execution and retry logic for EHR sync and PDF generation)
- django-allauth with TOTP-based 2FA (authentication and two-factor enforcement)
- fhirclient / hl7 Python libraries (FHIR R4 adapter calls to Epic and NextGen)
- django-axes (brute-force protection and login auditing)
- django-audit-log (HIPAA-compliant audit trail)

**Data Access layer**
- Django ORM (repository and model layer, ACID transactions)
- PostgreSQL (single shared database instance)
- Redis (Celery broker)

**Deployment target**
- AWS (EC2 or ECS) with HIPAA BAA
- RDS PostgreSQL for managed database
- ElastiCache Redis for Celery broker

---

## Alternatives Considered

### Stack 1 — Node.js / TypeScript (Express.js + Prisma + BullMQ)

This stack is the most widely adopted for new outpatient clinic software and offers an end-to-end JavaScript/TypeScript experience. Express.js organizes cleanly into the three-layer monolith. Prisma provides type-safe PostgreSQL access with migration management. BullMQ backed by Redis directly satisfies the HTTP 202 + background job pattern described in the architecture.

It was not selected because the FHIR and HL7 library ecosystem for Node.js is less mature than Python's. Integrating with Epic and NextGen FHIR R4 endpoints would rely more heavily on raw HTTP calls rather than well-supported library abstractions, increasing integration risk. HIPAA audit tooling also requires more custom implementation compared to Django's established packages.

### Stack 3 — Java / Spring Boot (Spring MVC + Spring Data JPA + HAPI FHIR)

This stack is the enterprise standard for HL7-native systems. HAPI FHIR is the gold-standard FHIR R4 library — used by Epic's own sandbox — and Spring Security provides mature MFA, RBAC, and method-level security annotations that align closely with the architecture's cross-cutting concern requirements. Spring Batch handles the async job pattern.

It was not selected due to higher initial setup cost and verbosity relative to a small clinic's scope and team size. The benefits of HAPI FHIR are partially offset by the fact that both Epic and NextGen expose standard FHIR R4 REST endpoints that Python's fhirclient library handles adequately. Spring Boot introduces significant boilerplate that would slow iteration in the early development phase without proportional compliance benefit.

---

## Consequences

### Positive

- Django's built-in ORM transaction support directly satisfies the ACID requirement for cross-feature atomic operations (e.g., recording a consent approval and generating the HIPAA authorization document in the same transaction).
- The django-allauth, django-axes, and django-audit-log packages provide battle-tested, HIPAA-aligned authentication, 2FA enforcement, and audit logging out of the box, reducing the amount of custom security infrastructure that must be built and maintained.
- Celery + Redis mirrors the Bull/Celery job queue requirement specified in the architecture almost exactly. The HTTP 202 acknowledgment pattern, status polling endpoint, and retry logic are well-documented Celery patterns with extensive production references.
- Django's layered project structure (views → services → models) maps naturally onto the Presentation → Business Logic → Data Access layered architecture with strict unidirectional dependency enforcement.
- Python's fhirclient and hl7 libraries provide FHIR R4 resource parsing and serialization, reducing the complexity of Epic and NextGen adapter implementation.
- AWS with a HIPAA BAA covers the full infrastructure stack (compute, managed PostgreSQL via RDS, managed Redis via ElastiCache), simplifying the compliance boundary.
- Django REST Framework's permission classes and throttling provide a consistent enforcement point for RBAC across all five feature modules.

### Negative

- Python is slower at runtime than Node.js or Java for CPU-bound tasks. This is unlikely to be a bottleneck for a small outpatient clinic workload, but it is a consideration if the system scales to high-volume concurrent requests.
- Django's synchronous request model (WSGI) means long-running synchronous operations can block worker threads. The architecture mitigates this by dispatching long operations to Celery, but the team must maintain discipline to avoid synchronous calls to external EHR APIs within the request cycle.
- The FHIR R4 ecosystem in Python, while adequate, is not as comprehensive as HAPI FHIR in Java. Edge cases in Epic's and NextGen's FHIR implementations may require custom parsing logic that a Java stack would handle through the HAPI library.
- React Native for the mobile client introduces a JavaScript layer that is decoupled from the Python backend, requiring the team to maintain two language environments if mobile development is in scope.
- Celery introduces operational complexity (worker processes, Redis broker management, dead-letter queue monitoring) that must be accounted for in deployment, monitoring, and on-call runbooks.