/**
 * OS-Grade Schema Contract Enforcement
 * 
 * This module defines the allowed fields for each entity type.
 * UI forms should ONLY submit fields that are declared here.
 * Any field not in this contract will be stripped before database write.
 */

// Wholesaler schema contract - only these fields can be written to database
export const WHOLESALER_SCHEMA = {
  // Core identity
  name: { type: 'string', required: true },
  legal_business_name: { type: 'string', required: false },
  dba_name: { type: 'string', required: false },
  
  // Contacts
  contact_name: { type: 'string', required: false },
  phone: { type: 'string', required: false },
  email: { type: 'string', required: false },
  backup_contact_name: { type: 'string', required: false },
  backup_contact_phone: { type: 'string', required: false },
  
  // Status
  status: { type: 'string', required: false },
  risk_level: { type: 'string', required: false },
  
  // Legal
  tax_id: { type: 'string', required: false },
  license_number: { type: 'string', required: false },
  
  // Location intelligence (NEW)
  city: { type: 'string', required: false },
  state: { type: 'string', required: false },
  borough: { type: 'string', required: false },
  neighborhoods: { type: 'array', required: false },
  location_notes: { type: 'string', required: false },
  address: { type: 'string', required: false },
  zip_code: { type: 'string', required: false },
  
  // Business
  pricing_tier: { type: 'string', required: false },
  margin_agreement: { type: 'number', required: false },
  payment_terms: { type: 'string', required: false },
  moq: { type: 'number', required: false },
  notes: { type: 'string', required: false },
  
  // Geography
  region: { type: 'string', required: false },
  territories: { type: 'array', required: false },
} as const;

export type WholesalerSchemaField = keyof typeof WHOLESALER_SCHEMA;

/**
 * Strips any fields from the update object that are not in the schema contract.
 * This prevents "column not found" errors from the database.
 */
export function sanitizeWholesalerUpdate(
  data: Record<string, any>
): Record<string, any> {
  const allowedFields = Object.keys(WHOLESALER_SCHEMA);
  const sanitized: Record<string, any> = {};
  
  for (const key of Object.keys(data)) {
    if (allowedFields.includes(key)) {
      const value = data[key];
      // Only include non-empty values (null/undefined are acceptable for optional fields)
      if (value !== '' || WHOLESALER_SCHEMA[key as WholesalerSchemaField]?.required) {
        sanitized[key] = value === '' ? null : value;
      }
    } else {
      console.warn(`[Schema Contract] Stripped unknown field: ${key}`);
    }
  }
  
  return sanitized;
}

/**
 * Validates that all required fields are present before submission.
 */
export function validateWholesalerUpdate(
  data: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [field, config] of Object.entries(WHOLESALER_SCHEMA)) {
    if (config.required && (!data[field] || data[field] === '')) {
      errors.push(`${field} is required`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Store schema contract
export const STORE_SCHEMA = {
  store_name: { type: 'string', required: true },
  address: { type: 'string', required: false },
  city: { type: 'string', required: false },
  state: { type: 'string', required: false },
  zip_code: { type: 'string', required: false },
  borough: { type: 'string', required: false },
  neighborhood: { type: 'string', required: false },
  phone: { type: 'string', required: false },
  email: { type: 'string', required: false },
  status: { type: 'string', required: false },
  brand: { type: 'string', required: false },
  region: { type: 'string', required: false },
  notes: { type: 'string', required: false },
} as const;

export function sanitizeStoreUpdate(
  data: Record<string, any>
): Record<string, any> {
  const allowedFields = Object.keys(STORE_SCHEMA);
  const sanitized: Record<string, any> = {};
  
  for (const key of Object.keys(data)) {
    if (allowedFields.includes(key)) {
      const value = data[key];
      if (value !== '') {
        sanitized[key] = value === '' ? null : value;
      }
    }
  }
  
  return sanitized;
}
