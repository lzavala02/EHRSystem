import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../../components/Alerts';
import { useAuth } from '../../context/AuthContext';
import { validateTotpCode } from '../../utils/validation';

export function TwoFAPage() {
  const navigate = useNavigate();
  const { verify2FA, error } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const challengeId = sessionStorage.getItem('challenge_id');

  if (!challengeId) {
    return (
      <div className="text-center">
        <p className="text-health-danger mb-4">Session expired. Please login again.</p>
        <button
          onClick={() => navigate('/auth/login')}
          className="px-4 py-2 bg-clinical-600 text-white rounded-lg hover:bg-clinical-700"
        >
          Back to Login
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    const validationError = validateTotpCode(code);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setLoading(true);
    try {
      const authenticatedUser = await verify2FA({ challenge_id: challengeId, code });
      sessionStorage.removeItem('challenge_id');
      if (authenticatedUser.role === 'Provider' || authenticatedUser.role === 'Admin') {
        navigate('/provider/patients');
      } else {
        navigate('/patient/dashboard');
      }
    } catch {
      // Error handled by useAuth hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-clinical-900 mb-2">Two-Factor Authentication</h2>
      <p className="text-clinical-600 text-sm mb-6">
        Enter the 6-digit code from your authenticator app
      </p>

      {error && <ErrorAlert message={error} />}

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-clinical-700 mb-1">
          Authentication Code
        </label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          placeholder="000000"
          className={`w-full px-3 py-2 border rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-clinical-500 ${
            fieldError ? 'border-health-danger' : 'border-clinical-300'
          }`}
        />
        {fieldError && (
          <p className="text-health-danger text-sm mt-1">{fieldError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full py-2 bg-clinical-600 text-white rounded-lg font-medium hover:bg-clinical-700 disabled:opacity-50 transition"
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={() => navigate('/auth/login')}
        className="w-full py-2 border border-clinical-300 text-clinical-600 rounded-lg font-medium hover:bg-clinical-50 transition"
      >
        Back to Login
      </button>
    </form>
  );
}
