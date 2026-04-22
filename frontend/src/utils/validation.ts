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

export function validateSymptomDescription(description: string): string | null {
  if (!description) return 'Description is required';
  if (description.length < 10) return 'Description must be at least 10 characters';
  if (description.length > 500) return 'Description must not exceed 500 characters';
  return null;
}

export function validatePsoriasisLanguage(description: string): string | null {
  const psoriasisTerms = [
    "psoriasis",
    "plaque",
    "itching",
    "scaling",
    "redness"
  ];
  const normalized = description.toLowerCase().trim();
  if (!psoriasisTerms.some(term => normalized.includes(term))) {
    return 'Description must reference psoriasis-oriented symptoms';
  }
  return null;
}

export function validateSelectedTrigger(trigger: string): string | null {
  const validTriggers = [
    "stress",
    "lack of sleep",
    "scented products",
    "dry weather",
    "skin injury",
    "infection",
    "smoking",
    "alcohol"
  ];
  if (!validTriggers.includes(trigger.toLowerCase().trim())) {
    return 'Invalid trigger selected';
  }
  return null;
}

export function validateOTCTreatment(treatment: string, severity: number): string | null {
  const normalizedTreatment = treatment.toLowerCase().trim();

  if (severity >= 8 && !normalizedTreatment) {
    return 'At least one OTC treatment is required when severity is 8 or higher';
  }

  if (!normalizedTreatment) {
    return null;
  }

  return null;
}
