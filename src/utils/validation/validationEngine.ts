// Phase 12 - Global Unified Validation System

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  autoFixes: AutoFix[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: ValidationSeverity;
  originalValue?: unknown;
  suggestedValue?: unknown;
}

export interface AutoFix {
  field: string;
  originalValue: unknown;
  fixedValue: unknown;
  fixType: string;
}

// Phone normalization
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// Email normalization
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  let normalized = email.trim().toLowerCase();
  // Fix common typos
  normalized = normalized.replace(/,com$/, '.com');
  normalized = normalized.replace(/\.con$/, '.com');
  normalized = normalized.replace(/\.cpm$/, '.com');
  return normalized;
}

// Name sanitization
export function sanitizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/[^\w\s'-]/g, '') // Remove special chars except hyphen and apostrophe
    .replace(/\s+/g, ' ')
    .trim();
}

// Address normalization
export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone format
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\d{3}-\d{3}-\d{4}$/;
  return phoneRegex.test(phone);
}

// Validate ZIP code
export function isValidZip(zip: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

// Validate state abbreviation
export function isValidState(state: string): boolean {
  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];
  return states.includes(state.toUpperCase());
}

// Entity-specific validation
export interface EntityValidationConfig {
  requiredFields: string[];
  phoneFields?: string[];
  emailFields?: string[];
  numericFields?: string[];
  moneyFields?: string[];
  dateFields?: string[];
}

const ENTITY_CONFIGS: Record<string, EntityValidationConfig> = {
  companies: {
    requiredFields: ['name'],
    phoneFields: ['phone'],
    emailFields: ['email'],
  },
  stores: {
    requiredFields: ['name'],
    phoneFields: ['phone'],
    emailFields: ['email'],
  },
  contacts: {
    requiredFields: ['name'],
    phoneFields: ['phone'],
    emailFields: ['email'],
  },
  wholesalers: {
    requiredFields: ['name'],
    phoneFields: ['phone'],
    emailFields: ['email'],
  },
  ambassadors: {
    requiredFields: ['user_id', 'tracking_code'],
  },
  drivers: {
    requiredFields: ['name'],
    phoneFields: ['phone'],
    emailFields: ['email'],
  },
  invoices: {
    requiredFields: ['amount'],
    moneyFields: ['amount', 'paid_amount'],
  },
  orders: {
    requiredFields: ['store_id'],
    moneyFields: ['total_amount'],
    numericFields: ['quantity'],
  },
  inventory: {
    requiredFields: ['brand'],
    numericFields: ['tubes_on_hand', 'boxes'],
  },
  production_batches: {
    requiredFields: ['brand'],
    numericFields: ['tubes_produced', 'boxes_produced'],
  },
};

export function validateEntity(
  entityType: string,
  data: Record<string, unknown>
): ValidationResult {
  const config = ENTITY_CONFIGS[entityType];
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const autoFixes: AutoFix[] = [];

  if (!config) {
    return { isValid: true, errors: [], warnings: [], autoFixes: [] };
  }

  // Check required fields
  for (const field of config.requiredFields) {
    const value = data[field];
    if (value === null || value === undefined || value === '') {
      errors.push({
        field,
        message: `${field} is required`,
        severity: 'error',
      });
    }
  }

  // Validate phone fields
  for (const field of config.phoneFields || []) {
    const value = data[field] as string;
    if (value) {
      const normalized = normalizePhone(value);
      if (normalized !== value) {
        autoFixes.push({
          field,
          originalValue: value,
          fixedValue: normalized,
          fixType: 'phone_normalization',
        });
      }
      if (!isValidPhone(normalized) && normalized.length > 0) {
        warnings.push({
          field,
          message: `Invalid phone format for ${field}`,
          severity: 'warning',
          originalValue: value,
          suggestedValue: normalized,
        });
      }
    }
  }

  // Validate email fields
  for (const field of config.emailFields || []) {
    const value = data[field] as string;
    if (value) {
      const normalized = normalizeEmail(value);
      if (normalized !== value) {
        autoFixes.push({
          field,
          originalValue: value,
          fixedValue: normalized,
          fixType: 'email_normalization',
        });
      }
      if (!isValidEmail(normalized)) {
        errors.push({
          field,
          message: `Invalid email format for ${field}`,
          severity: 'error',
          originalValue: value,
        });
      }
    }
  }

  // Validate numeric fields
  for (const field of config.numericFields || []) {
    const value = data[field];
    if (value !== null && value !== undefined) {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({
          field,
          message: `${field} must be a number`,
          severity: 'error',
          originalValue: value,
        });
      } else if (num < 0) {
        warnings.push({
          field,
          message: `${field} is negative`,
          severity: 'warning',
          originalValue: value,
        });
      }
    }
  }

  // Validate money fields
  for (const field of config.moneyFields || []) {
    const value = data[field];
    if (value !== null && value !== undefined) {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({
          field,
          message: `${field} must be a valid amount`,
          severity: 'error',
          originalValue: value,
        });
      } else if (num < 0) {
        errors.push({
          field,
          message: `${field} cannot be negative`,
          severity: 'error',
          originalValue: value,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    autoFixes,
  };
}

// Cross-entity validation
export interface CrossEntityCheck {
  entityType: string;
  field: string;
  relatedEntity: string;
  relatedField: string;
  message: string;
}

export const CROSS_ENTITY_RULES: CrossEntityCheck[] = [
  {
    entityType: 'stores',
    field: 'company_id',
    relatedEntity: 'companies',
    relatedField: 'id',
    message: 'Store must be linked to a company',
  },
  {
    entityType: 'orders',
    field: 'store_id',
    relatedEntity: 'stores',
    relatedField: 'id',
    message: 'Order must be linked to a store',
  },
  {
    entityType: 'invoices',
    field: 'order_id',
    relatedEntity: 'orders',
    relatedField: 'id',
    message: 'Invoice must be linked to an order',
  },
  {
    entityType: 'inventory',
    field: 'brand',
    relatedEntity: 'brands',
    relatedField: 'name',
    message: 'Inventory must be linked to a brand',
  },
  {
    entityType: 'deliveries',
    field: 'driver_id',
    relatedEntity: 'drivers',
    relatedField: 'id',
    message: 'Delivery must be assigned to a driver',
  },
  {
    entityType: 'deliveries',
    field: 'store_id',
    relatedEntity: 'stores',
    relatedField: 'id',
    message: 'Delivery must be linked to a store',
  },
];

// Apply auto-fixes to data
export function applyAutoFixes(
  data: Record<string, unknown>,
  autoFixes: AutoFix[]
): Record<string, unknown> {
  const fixed = { ...data };
  for (const fix of autoFixes) {
    fixed[fix.field] = fix.fixedValue;
  }
  return fixed;
}

// Get validation status badge
export type ValidationStatus = 'verified' | 'warning' | 'critical' | 'unknown';

export function getValidationStatus(result: ValidationResult): ValidationStatus {
  if (result.errors.length > 0) return 'critical';
  if (result.warnings.length > 0) return 'warning';
  if (result.isValid) return 'verified';
  return 'unknown';
}

// Detect duplicates
export function detectDuplicates<T extends Record<string, unknown>>(
  items: T[],
  fields: string[]
): { duplicates: T[][]; unique: T[] } {
  const seen = new Map<string, T[]>();
  const unique: T[] = [];

  for (const item of items) {
    const key = fields.map(f => String(item[f] || '').toLowerCase()).join('|');
    if (seen.has(key)) {
      seen.get(key)!.push(item);
    } else {
      seen.set(key, [item]);
      unique.push(item);
    }
  }

  const duplicates = Array.from(seen.values()).filter(group => group.length > 1);
  return { duplicates, unique };
}
