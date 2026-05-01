import { normalizeApiBaseUrl, parseTimeout } from './config';
import { parseApiErrorMessage } from './errorParsing';

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

describe('parseApiErrorMessage', () => {
  test('returns detail when backend sends a plain detail string', () => {
    expect(parseApiErrorMessage({ detail: 'At least one trigger is required' }, 'fallback')).toBe(
      'At least one trigger is required'
    );
  });

  test('returns formatted first validation error from detail array', () => {
    expect(
      parseApiErrorMessage(
        {
          detail: [
            {
              loc: ['body', 'severity_scale'],
              msg: 'Input should be less than or equal to 10',
              type: 'less_than_equal'
            }
          ]
        },
        'fallback'
      )
    ).toBe('body.severity_scale: Input should be less than or equal to 10');
  });

  test('falls back to message if detail is missing', () => {
    expect(parseApiErrorMessage({ message: 'Request failed' }, 'fallback')).toBe('Request failed');
  });

  test('returns fallback when payload has no recognized fields', () => {
    expect(parseApiErrorMessage({ foo: 'bar' }, 'fallback')).toBe('fallback');
  });
});
