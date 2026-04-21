// API Client Configuration and Axios Setup

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse
} from 'axios';
import { normalizeApiBaseUrl, parseTimeout } from './config';

declare global {
  interface Window {
    __apiClient?: AxiosInstance;
  }
}

let apiClientInstance: AxiosInstance | null = null;

/**
 * Initialize API client with auth token provider
 */
export function initializeApiClient(getAuthToken: () => string | null): AxiosInstance {
  const fallbackOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:8000';
  const baseURL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL, fallbackOrigin);
  const timeout = parseTimeout(import.meta.env.VITE_API_TIMEOUT);

  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor: inject auth token
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      let persistedToken: string | null = null;
      try {
        const sessionFromStorage = localStorage.getItem('auth_session');
        const parsedSession = sessionFromStorage ? JSON.parse(sessionFromStorage) : null;
        persistedToken = parsedSession?.session_token ?? null;
      } catch {
        persistedToken = null;
      }
      const token = getAuthToken() || persistedToken || null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log HIPAA audit trail for sensitive API calls
      if (import.meta.env.VITE_HIPAA_AUDIT_ENABLED === 'true') {
        const sensitivePatterns = ['/v1/consent', '/v1/symptoms', '/v1/dashboard', '/v1/alerts'];
        const isSensitive = sensitivePatterns.some(pattern => config.url?.includes(pattern));
        if (isSensitive) {
          console.log(`[HIPAA_AUDIT] ${config.method?.toUpperCase()} ${config.url}`);
        }
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: handle errors
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      const status = error.response?.status;

      if (status === 401) {
        // Unauthorized - clear session and redirect to login
        localStorage.removeItem('auth_session');
        window.location.href = '/auth/login';
        return Promise.reject(new Error('Session expired. Please log in again.'));
      }

      if (status === 403) {
        // Forbidden - redirect to unauthorized page
        window.location.href = '/error/unauthorized';
        return Promise.reject(new Error('You do not have permission to access this resource.'));
      }

      if (status === 202) {
        // 202 Accepted - background job submitted, caller should handle polling
        return Promise.resolve(error.response);
      }

      // Handle other errors
      const errorMessage = (error.response?.data as any)?.message || error.message;
      return Promise.reject(new Error(errorMessage));
    }
  );

  apiClientInstance = client;
  window.__apiClient = client;
  return client;
}

/**
 * Get the API client instance
 */
export function getApiClient(): AxiosInstance {
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Call initializeApiClient first.');
  }
  return apiClientInstance;
}

/**
 * Create API client for testing purposes
 */
export function createMockApiClient(): AxiosInstance {
  return axios.create({
    baseURL: 'http://localhost:8000/api',
    timeout: 30000
  });
}
