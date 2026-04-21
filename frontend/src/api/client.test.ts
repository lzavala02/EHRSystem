import { normalizeApiBaseUrl, parseTimeout } from './config';

describe('api runtime config helpers', () => {
  test('parseTimeout uses safe defaults and boundaries', () => {
    expect(parseTimeout(undefined)).toBe(30000);
    expect(parseTimeout('bad-value')).toBe(30000);
    expect(parseTimeout('500')).toBe(30000);
    expect(parseTimeout('35000')).toBe(35000);
    expect(parseTimeout('999999')).toBe(120000);
  });

  test('normalizeApiBaseUrl enforces /api suffix and removes trailing slash', () => {
    expect(normalizeApiBaseUrl('https://staging.example.com', window.location.origin)).toBe(
      'https://staging.example.com/api'
    );
    expect(normalizeApiBaseUrl('https://staging.example.com/api', window.location.origin)).toBe(
      'https://staging.example.com/api'
    );
    expect(normalizeApiBaseUrl('https://staging.example.com/api/', window.location.origin)).toBe(
      'https://staging.example.com/api'
    );
  });

  test('normalizeApiBaseUrl falls back to same-origin /api when unset', () => {
    expect(normalizeApiBaseUrl(undefined, window.location.origin)).toBe(
      `${window.location.origin}/api`
    );
  });
});
