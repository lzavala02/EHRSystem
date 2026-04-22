type ValidationDetailItem = {
  msg?: string;
  message?: string;
  loc?: Array<string | number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatDetailItem(item: ValidationDetailItem): string | null {
  const message =
    typeof item.msg === 'string'
      ? item.msg
      : typeof item.message === 'string'
        ? item.message
        : null;

  if (!message) return null;

  if (!Array.isArray(item.loc) || item.loc.length === 0) {
    return message;
  }

  const path = item.loc.map((segment) => String(segment)).join('.');
  return `${path}: ${message}`;
}

export function parseApiErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (!isRecord(payload)) {
    return fallbackMessage;
  }

  const detail = payload.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string' && first.trim()) {
      return first;
    }

    if (isRecord(first)) {
      const formatted = formatDetailItem(first as ValidationDetailItem);
      if (formatted) {
        return formatted;
      }
    }
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return fallbackMessage;
}