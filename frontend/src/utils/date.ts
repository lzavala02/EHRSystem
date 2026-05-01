// Utility functions for date/time handling (UTC)

/**
 * Format UTC timestamp to readable string with timezone indicator
 * @param isoString ISO 8601 UTC timestamp
 * @returns Formatted string like "Apr 17, 2026 14:32 UTC"
 */
export function formatUtcTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  }) + ' UTC';
}

/**
 * Get relative time (e.g., "2 hours ago")
 * @param isoString ISO 8601 UTC timestamp
 * @returns Relative time string
 */
export function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatUtcTimestamp(isoString);
}

/**
 * Check if timestamp is stale (> N hours)
 * @param isoString ISO 8601 UTC timestamp
 * @param staleThresholdHours Default 24 hours
 */
export function isStale(isoString: string, staleThresholdHours = 24): boolean {
  const date = new Date(isoString);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / 3600000;
  return diffHours > staleThresholdHours;
}

/**
 * Convert Date to ISO 8601 UTC string
 * @param date JavaScript Date object
 * @returns ISO 8601 UTC string
 */
export function toUtcIsoString(date: Date): string {
  return date.toISOString();
}

/**
 * Get start of day (UTC) for a given date
 */
export function getUtcDayStart(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Get end of day (UTC) for a given date
 */
export function getUtcDayEnd(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}
