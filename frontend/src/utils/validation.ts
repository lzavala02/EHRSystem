// Form validation utilities

export const validationRules = {
  email: {
    pattern: {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address'
    }
  },
  password: {
    minLength: {
      value: 8,
      message: 'Password must be at least 8 characters'
    },
    pattern: {
      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      message: 'Password must contain uppercase, lowercase, and number'
    }
  },
  totp: {
    pattern: {
      value: /^\d{6}$/,
      message: 'TOTP code must be 6 digits'
    }
  },
  severity: {
    min: {
      value: 1,
      message: 'Severity must be between 1-10'
    },
    max: {
      value: 10,
      message: 'Severity must be between 1-10'
    }
  },
  symptomDescription: {
    minLength: {
      value: 10,
      message: 'Description must be at least 10 characters'
    },
    maxLength: {
      value: 500,
      message: 'Description must not exceed 500 characters'
    }
  }
};

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Invalid email format';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain lowercase letter';
  if (!/\d/.test(password)) return 'Password must contain a number';
  return null;
}

export function validateTotpCode(code: string): string | null {
  if (!code) return 'Code is required';
  if (!/^\d{6}$/.test(code)) return 'Code must be 6 digits';
  return null;
}

export function validateSeverity(severity: number): string | null {
  if (severity < 1 || severity > 10) {
    return 'Severity must be between 1 and 10';
  }
  return null;
}
