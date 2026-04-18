import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode
} from 'react';
import {
  User,
  LoginRequest,
  TwoFAVerifyRequest,
  CreateAccountRequest,
  CreateAccountResponse
} from '../types/api';
import { getApiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (request: LoginRequest) => Promise<{ challenge_id: string }>;
  createAccount: (request: CreateAccountRequest) => Promise<CreateAccountResponse>;
  verify2FA: (request: TwoFAVerifyRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('auth_session');
    if (storedSession) {
      try {
        const sessionData = JSON.parse(storedSession);
        // Check if session is expired
        const expiresAt = new Date(sessionData.expires_at);
        if (expiresAt > new Date()) {
          setUser(sessionData);
        } else {
          localStorage.removeItem('auth_session');
        }
      } catch (e) {
        localStorage.removeItem('auth_session');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (request: LoginRequest) => {
      setError(null);
      try {
        const apiClient = getApiClient();
        const response = await apiClient.post('/v1/auth/login', request);
        // Response expects { challenge_id, expires_at, methods }
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        throw err;
      }
    },
    []
  );

  const createAccount = useCallback(
    async (request: CreateAccountRequest) => {
      setError(null);
      try {
        const apiClient = getApiClient();
        const response = await apiClient.post<CreateAccountResponse>('/v1/auth/register', request);
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Account creation failed';
        setError(message);
        throw err;
      }
    },
    []
  );

  const verify2FA = useCallback(
    async (request: TwoFAVerifyRequest) => {
      setError(null);
      try {
        const apiClient = getApiClient();
        const response = await apiClient.post('/v1/auth/2fa/verify', request);
        const userData = response.data as User;
        setUser(userData);
        localStorage.setItem('auth_session', JSON.stringify(userData));
      } catch (err) {
        const message = err instanceof Error ? err.message : '2FA verification failed';
        setError(message);
        throw err;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const apiClient = getApiClient();
      await apiClient.post('/v1/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    setUser(null);
    localStorage.removeItem('auth_session');
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        createAccount,
        verify2FA,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
