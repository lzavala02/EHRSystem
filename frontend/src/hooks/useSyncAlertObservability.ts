import { useEffect, useMemo, useRef } from 'react';
import {
  reportFrontendObservabilityEvent,
  FrontendObservabilityEvent
} from '../utils/observability';

interface UseSyncAlertObservabilityOptions {
  scope: string;
  syncError?: Error | null;
  alertsError?: Error | null;
}

interface UseSyncAlertObservabilityResult {
  syncIncidentId: string | null;
  alertsIncidentId: string | null;
}

function generateIncidentId(scope: string, event: FrontendObservabilityEvent): string {
  const sanitizedScope = scope.replace(/\s+/g, '-').toLowerCase();
  return `${event}:${sanitizedScope}:${Date.now().toString(36)}`;
}

export function useSyncAlertObservability(
  options: UseSyncAlertObservabilityOptions
): UseSyncAlertObservabilityResult {
  const { scope, syncError, alertsError } = options;

  const syncIncidentRef = useRef<string | null>(null);
  const alertsIncidentRef = useRef<string | null>(null);
  const lastSyncMessageRef = useRef<string | null>(null);
  const lastAlertsMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!syncError) {
      return;
    }
    if (lastSyncMessageRef.current === syncError.message) {
      return;
    }

    const incidentId = generateIncidentId(scope, 'sync_retrieval_failed');
    syncIncidentRef.current = incidentId;
    lastSyncMessageRef.current = syncError.message;

    reportFrontendObservabilityEvent({
      event: 'sync_retrieval_failed',
      scope,
      incidentId,
      endpoint: '/v1/dashboard/patients/{patient_id}/sync-status',
      message: syncError.message,
      occurredAt: new Date().toISOString()
    });
  }, [scope, syncError]);

  useEffect(() => {
    if (!alertsError) {
      return;
    }
    if (lastAlertsMessageRef.current === alertsError.message) {
      return;
    }

    const incidentId = generateIncidentId(scope, 'alerts_retrieval_failed');
    alertsIncidentRef.current = incidentId;
    lastAlertsMessageRef.current = alertsError.message;

    reportFrontendObservabilityEvent({
      event: 'alerts_retrieval_failed',
      scope,
      incidentId,
      endpoint: '/v1/alerts',
      message: alertsError.message,
      occurredAt: new Date().toISOString()
    });
  }, [scope, alertsError]);

  return useMemo(
    () => ({
      syncIncidentId: syncIncidentRef.current,
      alertsIncidentId: alertsIncidentRef.current
    }),
    [syncError, alertsError]
  );
}
