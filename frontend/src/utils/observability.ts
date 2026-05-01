export type FrontendObservabilityEvent =
  | 'sync_retrieval_failed'
  | 'alerts_retrieval_failed';

export interface FrontendObservabilityPayload {
  event: FrontendObservabilityEvent;
  scope: string;
  incidentId: string;
  endpoint: string;
  message: string;
  occurredAt: string;
}

export function reportFrontendObservabilityEvent(
  payload: FrontendObservabilityPayload
): void {
  // Keep this intentionally lightweight for Day 6: local telemetry + event broadcast.
  console.error('[FRONTEND_OBSERVABILITY]', payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('frontend-observability', {
        detail: payload
      })
    );
  }
}
