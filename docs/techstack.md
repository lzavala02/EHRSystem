# Tech Stack Comparison for Small Clinic EHR Subsystem

**Status:** Accepted

## Context
This decision evaluates three backend tech stacks for a web application Patient Health Record (EHR) subsystem focused on chronic disease management in a small outpatient clinic. The priorities are healthcare interoperability, compliance-friendly auditing, background job handling, maintainability, and a realistic upgrade path as the product grows.

## Decision
Choose **Java / Spring Boot** as the primary stack if the clinic expects strong FHIR/HL7 integration needs, stricter audit/security requirements, and a likely path toward enterprise-grade architecture. Choose **Python / Django** if the team wants the best balance of speed, conventions, and healthcare-oriented ecosystem support. Choose **Node.js / TypeScript** only if the team is strongly JavaScript-native and the interoperability requirements are lighter.

## Alternatives Considered

### Stack 1 — Node.js / TypeScript
**AI Support Strength:** High  
**Popularity & Community Answers:** High  
**Ecosystem Maturity:** Medium  
**Deployment Simplicity:** High  
**Path to Next Architecture:** Medium  

This stack is attractive because it keeps the whole system in one language and makes a three-layer monolith straightforward to build and deploy. Prisma and BullMQ are a clean fit for typed PostgreSQL access and async job patterns. The main limitation is that healthcare interoperability tooling is less mature than in Python or Java, so FHIR-heavy work will often depend more on external vendor endpoints than on a deep local ecosystem.

### Stack 2 — Python / Django
**AI Support Strength:** High  
**Popularity & Community Answers:** High  
**Ecosystem Maturity:** High  
**Deployment Simplicity:** Medium  
**Path to Next Architecture:** Medium  

This stack is the best balanced option for a small clinic team that wants convention, productivity, and strong healthcare-oriented libraries. Django’s ORM, admin, and authentication patterns reduce implementation effort, while Celery and Redis fit the background-job model well. It is slightly more verbose and less “single-language simple” than Node.js, but it offers stronger support for compliance and FHIR/HL7 workflows.

### Stack 3 — Java / Spring Boot
**AI Support Strength:** Medium  
**Popularity & Community Answers:** High  
**Ecosystem Maturity:** High  
**Deployment Simplicity:** Medium  
**Path to Next Architecture:** High  

This stack is the strongest choice for long-term maintainability, enterprise integrations, and FHIR-centric healthcare architecture. Spring Security aligns well with RBAC and MFA requirements, Spring Batch covers background processing patterns, and HAPI FHIR is the most credible local FHIR library option. It has a higher setup and verbosity cost, but it is the most future-proof for a compliance-heavy codebase.

## Consequences

### Positive
- The recommended structure matches the operational reality of a small outpatient clinic, where compliance, auditability, and interoperability matter more than novelty.
- Spring Boot provides the best path toward future enterprise integration and deeper FHIR support.
- Django remains a strong fallback if the team values speed and convention over Java’s heavier structure.
- Node.js/TypeScript can still be a good choice when team skills and deployment simplicity are the dominant concerns.

### Negative
- Spring Boot increases initial implementation effort and requires more framework familiarity.
- Django is not as lightweight as Node.js for teams that want a fully JavaScript-based stack.
- Node.js/TypeScript has weaker native healthcare interoperability maturity, which may increase custom integration work.
- Any of the three stacks will still require careful HIPAA-aligned design decisions outside the framework itself.