# Data Design - Entities and Relationships for Chronic Disease Management System

## Patient
* Patient ID (PK)
* Full Name
* Height
* Weight
* Family History
* Vaccination Record
* Two-Factor Authentication (2FA) Status
* Primary Provider ID (FK)

## Healthcare Provider
* Provider ID (PK)
* Name
* Specialty (e.g., Dermatology, PCP)
* Clinic/Facility Affiliation 

## EHR System
* System ID (PK)
* System Name (e.g., Epic, NextGen)
* Standard Protocol (FHIR, HL7)
* Last Synced Timestamp

## Medical Record Item
* Record ID (PK)
* Patient ID (FK)
* System ID (FK)
* Data Category (e.g., Medications, Labs, Vitals)
* Value/Description
* Timestamp

## Symptom Log
* Log ID (PK)
* Patient ID (FK)
* Symptom Description (Scales, Redness, Joint Aches)
* Severity Scale
* Date/Time of Log

## Trigger
* Trigger ID (PK)
* Trigger Name (e.g., Stress, Lack of Sleep, Scented Products)

## Treatment
* Treatment ID (PK)
* Product Name (e.g., Aveeno)
* Type (OTC, Vitamin, Skincare)

## Access Request
* Request ID (PK)
* Patient ID (FK)
* Provider ID (FK)
* Status (Pending, Approved, Denied)
* Digital Authorization Document (HIPAA-compliant)
* Request Timestamp

## Alert
* Alert ID (PK)
* Alert Type (Data Conflict, Negative Trend)
* Description
* Resolution Status
* Patient ID (FK)
* Provider ID (FK)
* System ID (FK)

---

## Relationships
* One **Patient** can have many **Medical Record Items**.
* One **Patient** can have many **Symptom Logs**.
* One **Patient** can have many **Access Requests**.
* One **Healthcare Provider** can manage many **Patients**.
* One **Healthcare Provider** can issue many **Access Requests**.
* One **EHR System** can provide many **Medical Record Items**.
* One **Symptom Log** can have many **Triggers**.
* One **Symptom Log** can have many **Treatments**.
* One **Patient** or **Provider** can receive many **Alerts**.
* One **EHR System** can generate many **Alerts** (Synchronization Conflicts).
