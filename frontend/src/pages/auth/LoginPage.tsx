import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert, SuccessAlert } from '../../components/Alerts';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validatePassword } from '../../utils/validation';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, createAccount, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Patient' | 'Provider'>('Patient');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  const isCreateMode = mode === 'create';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSuccessMessage(null);

    // Validate
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const nameError = isCreateMode && !name.trim() ? 'Name is required' : null;

    if (emailError || passwordError || nameError) {
      setFieldErrors({
        name: nameError || undefined,
        email: emailError || undefined,
        password: passwordError || undefined
      });
      return;
    }

    setLoading(true);
    try {
      if (isCreateMode) {
        await createAccount({
          name: name.trim(),
          email,
          password,
          role
        });
        setSuccessMessage('Account created. Please sign in with your new credentials.');
        setMode('signin');
        setPassword('');
        return;
      }

      const result = await login({ email, password });
      // Redirect to 2FA verification
      sessionStorage.setItem('challenge_id', result.challenge_id);
      navigate('/auth/2fa-verify');
    } catch {
      // Error handled by useAuth hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-clinical-900 mb-1">
        {isCreateMode ? 'Create Account' : 'Sign In'}
      </h2>
      <p className="text-sm text-clinical-600 mb-6">
        {isCreateMode ? 'Set up your new portal access.' : 'Use your credentials to continue.'}
      </p>

      {successMessage && <SuccessAlert message={successMessage} />}
      {error && <ErrorAlert message={error} />}

      {isCreateMode && (
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-clinical-700 mb-1">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-500 ${
              fieldErrors.name ? 'border-health-danger' : 'border-clinical-300'
            }`}
          />
          {fieldErrors.name && (
            <p className="text-health-danger text-sm mt-1">{fieldErrors.name}</p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-clinical-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clinic.com"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-500 ${
            fieldErrors.email ? 'border-health-danger' : 'border-clinical-300'
          }`}
        />
        {fieldErrors.email && (
          <p className="text-health-danger text-sm mt-1">{fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-clinical-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-500 ${
            fieldErrors.password ? 'border-health-danger' : 'border-clinical-300'
          }`}
        />
        {fieldErrors.password && (
          <p className="text-health-danger text-sm mt-1">{fieldErrors.password}</p>
        )}
      </div>

      {isCreateMode && (
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-clinical-700 mb-1">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'Patient' | 'Provider')}
            className="w-full px-3 py-2 border border-clinical-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-500"
          >
            <option value="Patient">Patient</option>
            <option value="Provider">Provider</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-clinical-600 text-white rounded-lg font-medium hover:bg-clinical-700 disabled:opacity-50 transition"
      >
        {loading
          ? isCreateMode
            ? 'Creating account...'
            : 'Signing in...'
          : isCreateMode
            ? 'Create Account'
            : 'Sign In'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(isCreateMode ? 'signin' : 'create');
          setFieldErrors({});
          setSuccessMessage(null);
        }}
        className="w-full py-2 border border-clinical-300 text-clinical-700 rounded-lg font-medium hover:bg-clinical-50 transition"
      >
        {isCreateMode ? 'I already have an account' : 'Create a new account'}
      </button>

      {!isCreateMode && (
        <button
          type="button"
          onClick={() => navigate('/auth/2fa-verify')}
          className="w-full py-2 text-clinical-600 text-sm hover:text-clinical-800 transition"
        >
          Continue 2FA challenge
        </button>
      )}
    </form>
  );
}
