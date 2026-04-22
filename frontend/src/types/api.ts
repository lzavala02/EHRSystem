// API Response Types

export interface ApiError {
  error_code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
}

export interface JobResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string; // ISO 8601 UTC
  progress?: number;
}

export interface JobStatusResponse<T> extends JobResponse {
  data?: T;
}

// Authentication Types

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateAccountRequest {
  email: string;
  password: string;
  name: string;
  role: 'Patient' | 'Provider';
}

export interface CreateAccountResponse {
  user_id: string;
  email: string;
  name: string;
  role: 'Patient' | 'Provider';
  created_at: string; // ISO 8601 UTC
}

export interface LoginResponse {
  challenge_id: string;
  expires_at: string; // ISO 8601 UTC
  methods: ('totp' | 'sms')[];
}

export interface TwoFAVerifyRequest {
  challenge_id: string;
  code: string;
}

export interface TwoFAVerifyResponse {
  user_id: string;
  role: 'Patient' | 'Provider' | 'Admin';
  email: string;
  name: string;
  patient_id?: string;
  provider_id?: string;
  session_token: string;
  expires_at: string; // ISO 8601 UTC
}

export interface User {
  user_id: string;
  role: 'Patient' | 'Provider' | 'Admin';
  email: string;
  name: string;
  patient_id?: string;
  provider_id?: string;
  session_token: string;
  expires_at: string;
}

// Consent Types

export interface ConsentRequest {
  request_id: string;
  patient_id: string;
  provider_id: string;
  provider_name: string;
  provider_specialty: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Denied';
  requested_at: string; // ISO 8601 UTC
}

export interface ConsentDecisionRequest {
  decision: 'Approve' | 'Deny';
}

export interface ConsentDecisionResponse {
  request_id: string;
  status: 'Approved' | 'Denied';
  responded_at: string; // ISO 8601 UTC
}

export interface AuthorizationDocument {
  document_id: string;
  request_id: string;
  secure_url: string;
  generated_at: string; // ISO 8601 UTC
  expires_at?: string;
}

// Dashboard Types

export interface Provider {
  provider_id: string;
  provider_name: string;
  specialty: string;
  clinic_affiliation: string;
}

export interface MedicalRecord {
  record_id: string;
  category: string;
  value_description: string;
  recorded_at: string; // ISO 8601 UTC
  system_id: string;
  system_name: string;
}

export interface MissingDataField {
  field_name: string;
  reason: string;
}

export interface DashboardPatientProfile {
  height: number | null;
  weight: number | null;
  vaccination_record: string | null;
  family_history: string | null;
}

export interface DashboardSourceSystem {
  system_id: string;
  system_name: string;
}

export interface DashboardSnapshot {
  patient_id: string;
  patient_profile: DashboardPatientProfile;
  source_systems: DashboardSourceSystem[];
  providers: Provider[];
  medical_history: MedicalRecord[];
  missing_data: MissingDataField[];
}

export interface SyncStatus {
  category: string;
  last_synced_at: string; // ISO 8601 UTC
  system_id: string;
  system_name: string;
}

export interface DashboardSyncStatus {
  patient_id: string;
  sync_status: SyncStatus[];
}

// Symptom Types

export interface Trigger {
  trigger_id: string;
  trigger_name: string;
}

export interface Treatment {
  treatment_id: string;
  product_name: string;
  type: 'OTC' | 'Vitamin' | 'Skincare';
}

export interface SymptomLog {
  log_id: string;
  patient_id: string;
  symptom_description: string;
  severity_scale: number;
  triggers: Trigger[];
  otc_treatments: string[];
  created_at: string; // ISO 8601 UTC
}

export interface SymptomLogCreateRequest {
  patient_id: string;
  symptom_description: string;
  severity_scale: number;
  trigger_ids: string[];
  otc_treatments: string[];
}

export interface SymptomLogCreateResponse {
  log_id: string;
  patient_id: string;
  created_at: string;
}

export interface SymptomLogListResponse {
  logs: SymptomLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface TriggerChecklist {
  trigger_id: string;
  trigger_name: string;
  category: string;
}

// Alert Types

export interface Alert {
  alert_id: string;
  alert_type: 'NegativeTrend' | 'Negative Trend' | 'SyncConflict' | 'Data Conflict';
  patient_id: string;
  provider_id?: string;
  description: string;
  status: 'Active' | 'Resolved';
  triggered_at: string; // ISO 8601 UTC
}

export interface AlertListResponse {
  alerts: Alert[];
  total: number;
  page: number;
  page_size: number;
}

export interface SyncConflictItem {
  category: string;
  system_name: string;
  local_value: string;
  remote_value: string;
  detected_at: string;
  requires_manual_resolution: boolean;
}

export interface SyncConflictListResponse {
  patient_id: string;
  conflicts: SyncConflictItem[];
  total: number;
}

export interface SyncConflictResolveRequest {
  category: string;
  system_name: string;
  resolution: 'accept_local' | 'accept_remote';
}

// Report Types

export interface ReportJob {
  report_id: string;
  patient_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface TrendReportRequest {
  patient_id: string;
  period_start: string; // ISO 8601 UTC
  period_end: string; // ISO 8601 UTC
}

export interface TrendReportResponse {
  report_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  job_id: string;
}

export interface ReportData {
  report_id: string;
  patient_id: string;
  generated_at: string;
  secure_url: string;
  expires_at?: string;
}

// Quick-Share Types

export interface QuickShareRequest {
  patient_id: string;
  from_provider_id: string;
  to_provider_id: string;
  report_id: string;
  message?: string;
}

export interface QuickShareResponse {
  share_id: string;
  status: 'pending';
  created_at: string;
}

// Patient List (Provider View)

export interface PatientListItem {
  patient_id: string;
  patient_name: string;
  primary_condition: string;
  last_visit: string; // ISO 8601 UTC
}

export interface PatientListResponse {
  patients: PatientListItem[];
  total: number;
  page: number;
  page_size: number;
}
