export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FieldValidation extends ValidationResult {
  field: string;
}

export class FormValidator {
  private rules: Record<string, ValidationRule> = {};
  private values: Record<string, any> = {};
  private errors: Record<string, string[]> = {};

  constructor(rules: Record<string, ValidationRule>) {
    this.rules = rules;
  }

  // Validate a single field
  validateField(field: string, value: any): FieldValidation {
    const rule = this.rules[field];
    if (!rule) {
      return { field, isValid: true, errors: [] };
    }

    const errors: string[] = [];

    // Required validation
    if (rule.required && (value === null || value === undefined || value === '')) {
      errors.push(`${this.getFieldDisplayName(field)} is required`);
    }

    // Only validate other rules if field has value or is required
    if (value !== null && value !== undefined && value !== '') {
      // String validations
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${this.getFieldDisplayName(field)} must be at least ${rule.minLength} characters`);
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${this.getFieldDisplayName(field)} cannot exceed ${rule.maxLength} characters`);
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${this.getFieldDisplayName(field)} format is invalid`);
        }
      }

      // Number validations
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${this.getFieldDisplayName(field)} must be at least ${rule.min}`);
        }

        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${this.getFieldDisplayName(field)} cannot exceed ${rule.max}`);
        }
      }

      // Custom validation
      if (rule.custom) {
        const customError = rule.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    const isValid = errors.length === 0;
    this.errors[field] = errors;
    this.values[field] = value;

    return { field, isValid, errors };
  }

  // Validate all fields
  validateAll(values: Record<string, any>): ValidationResult {
    const allErrors: string[] = [];
    let isValid = true;

    for (const [field, value] of Object.entries(values)) {
      const validation = this.validateField(field, value);
      if (!validation.isValid) {
        isValid = false;
        allErrors.push(...validation.errors);
      }
    }

    return { isValid, errors: allErrors };
  }

  // Get errors for a specific field
  getFieldErrors(field: string): string[] {
    return this.errors[field] || [];
  }

  // Get all errors
  getAllErrors(): Record<string, string[]> {
    return { ...this.errors };
  }

  // Clear errors for a field
  clearFieldErrors(field: string): void {
    delete this.errors[field];
  }

  // Clear all errors
  clearAllErrors(): void {
    this.errors = {};
  }

  private getFieldDisplayName(field: string): string {
    // Convert camelCase to display name
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

// Pre-defined validation rules for common fields
export const CommonValidationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255
  },

  password: {
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, // At least one lowercase, uppercase, and digit
  },

  phone: {
    required: true,
    pattern: /^\+?[\d\s\-\(\)]{10,}$/,
  },

  fullName: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-'\.]+$/,
  },

  bio: {
    required: true,
    minLength: 20,
    maxLength: 500,
  },

  hourlyRate: {
    required: true,
    min: 10,
    max: 200,
    custom: (value: number) => {
      if (!Number.isInteger(value)) {
        return 'Hourly rate must be a whole number';
      }
      return null;
    }
  },

  serviceRadius: {
    required: true,
    min: 1,
    max: 50,
  },

  zipCode: {
    required: true,
    pattern: /^\d{5}(-\d{4})?$/,
  },
};

// Profile completion validation
export const ProfileValidationRules = {
  fullName: CommonValidationRules.fullName,
  email: CommonValidationRules.email,
  phone: CommonValidationRules.phone,
  bio: CommonValidationRules.bio,
  hourlyRate: CommonValidationRules.hourlyRate,
  serviceRadius: CommonValidationRules.serviceRadius,
  profilePhoto: {
    required: true,
    custom: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Profile photo is required';
      }
      // Validate image URL or file format
      if (!value.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !value.startsWith('data:image/')) {
        return 'Invalid image format';
      }
      return null;
    }
  },
};

// Real-time validation hook for React components
export const useFormValidation = (rules: Record<string, ValidationRule>) => {
  const validator = new FormValidator(rules);

  const validateField = (field: string, value: any) => {
    return validator.validateField(field, value);
  };

  const validateForm = (values: Record<string, any>) => {
    return validator.validateAll(values);
  };

  const getFieldErrors = (field: string) => {
    return validator.getFieldErrors(field);
  };

  const clearErrors = (field?: string) => {
    if (field) {
      validator.clearFieldErrors(field);
    } else {
      validator.clearAllErrors();
    }
  };

  return {
    validateField,
    validateForm,
    getFieldErrors,
    clearErrors,
  };
};

// Helper function for debounced validation
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T => {
  let timeout: NodeJS.Timeout;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
};