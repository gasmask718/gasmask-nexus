/**
 * Upload Schema Definitions
 * Defines required/optional fields, types, and validation rules for each upload type
 */

export interface FieldSchema {
  field: string;
  displayName: string;
  type: 'string' | 'email' | 'phone' | 'date' | 'number' | 'boolean' | 'tags';
  required: boolean;
  autoDerive?: boolean;
  source?: 'excel' | 'system' | 'derived';
  notes?: string;
  validation?: (value: any) => { valid: boolean; error?: string };
}

export interface UploadSchema {
  tableName: string;
  displayName: string;
  description: string;
  fields: FieldSchema[];
  naturalKey: string[];  // Fields that form the unique key
  relatedTables?: string[];
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation (basic - allows various formats)
const phoneRegex = /^[\d\s\-+()]{7,20}$/;

// Date validation (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const uploadSchemas: Record<string, UploadSchema> = {
  stores: {
    tableName: 'stores',
    displayName: 'Stores',
    description: 'Import store/location data with contacts and notes',
    naturalKey: ['name'], // Store name is the primary key - company is optional
    relatedTables: ['store_notes', 'store_contacts'],
    fields: [
      {
        field: 'name',
        displayName: 'Store Name',
        type: 'string',
        required: true,
        source: 'excel',
        notes: 'Primary identifier for the store',
        validation: (v) => v?.trim()?.length > 0 
          ? { valid: true } 
          : { valid: false, error: 'Store name is required' }
      },
      {
        field: 'company',
        displayName: 'Company',
        type: 'string',
        required: false, // OPTIONAL per CRM data model - Person/Store can exist without Company
        source: 'excel',
        notes: 'Legal entity only (e.g., GasMask). Leave blank for individuals or unaffiliated stores.'
        // No validation - blank is acceptable
      },
      {
        field: 'brand',
        displayName: 'Brand',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Commercial brand identity (e.g., Grabba). Separate from Company - stores may carry multiple brands.'
      },
      {
        field: 'address_street',
        displayName: 'Street Address',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'address_city',
        displayName: 'City',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'address_state',
        displayName: 'State',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'address_zip',
        displayName: 'ZIP Code',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'phone',
        displayName: 'Phone',
        type: 'phone',
        required: false,
        source: 'excel',
        validation: (v) => !v || phoneRegex.test(v) 
          ? { valid: true } 
          : { valid: false, error: 'Invalid phone format' }
      },
      {
        field: 'email',
        displayName: 'Email',
        type: 'email',
        required: false,
        source: 'excel',
        validation: (v) => !v || emailRegex.test(v) 
          ? { valid: true } 
          : { valid: false, error: 'Invalid email format' }
      },
      {
        field: 'status',
        displayName: 'Status',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'active, inactive, lead, etc.'
      },
      {
        field: 'open_date',
        displayName: 'Member Since',
        type: 'date',
        required: false,
        autoDerive: true,
        source: 'derived',
        notes: 'Auto-derived from oldest note if not provided',
        validation: (v) => !v || dateRegex.test(v) 
          ? { valid: true } 
          : { valid: false, error: 'Date must be YYYY-MM-DD format' }
      },
      {
        field: 'connected_group_id',
        displayName: 'Connected Store Group',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Links stores together'
      },
      {
        field: 'notes',
        displayName: 'Notes',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Will be copied word-for-word'
      },
      {
        field: 'tags',
        displayName: 'Tags',
        type: 'tags',
        required: false,
        source: 'excel',
        notes: 'Comma-separated, auto-registered globally'
      }
    ]
  },
  
  store_contacts: {
    tableName: 'store_contacts',
    displayName: 'Store Contacts',
    description: 'Import contacts linked to stores',
    naturalKey: ['store_name', 'name', 'phone'],
    relatedTables: ['stores'],
    fields: [
      {
        field: 'store_name',
        displayName: 'Store Name',
        type: 'string',
        required: true,
        source: 'excel',
        notes: 'Must match existing store or be created first',
        validation: (v) => v?.trim()?.length > 0 
          ? { valid: true } 
          : { valid: false, error: 'Store name is required to link contact' }
      },
      {
        field: 'name',
        displayName: 'Contact Name',
        type: 'string',
        required: true,
        source: 'excel',
        validation: (v) => v?.trim()?.length > 0 
          ? { valid: true } 
          : { valid: false, error: 'Contact name is required' }
      },
      {
        field: 'role',
        displayName: 'Role',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'owner, manager, worker, etc.'
      },
      {
        field: 'phone',
        displayName: 'Phone',
        type: 'phone',
        required: true, // REQUIRED - Phone is the primary contact identifier
        source: 'excel',
        notes: 'Primary identity key for contacts. Required for all person records.',
        validation: (v) => {
          if (!v?.trim()) return { valid: false, error: 'Phone number is required for Person records' };
          if (!phoneRegex.test(v)) return { valid: false, error: 'Invalid phone format' };
          // Reject placeholder numbers
          const digits = v.replace(/\D/g, '');
          if (/^(\d)\1+$/.test(digits)) return { valid: false, error: 'Invalid placeholder phone number' };
          if (digits.length < 10) return { valid: false, error: 'Phone number must have at least 10 digits' };
          return { valid: true };
        }
      },
      {
        field: 'email',
        displayName: 'Email',
        type: 'email',
        required: false,
        source: 'excel',
        validation: (v) => !v || emailRegex.test(v) 
          ? { valid: true } 
          : { valid: false, error: 'Invalid email format' }
      },
      {
        field: 'is_primary',
        displayName: 'Primary Contact',
        type: 'boolean',
        required: false,
        source: 'excel',
        notes: 'true/false or yes/no'
      },
      {
        field: 'notes',
        displayName: 'Contact Notes',
        type: 'string',
        required: false,
        source: 'excel'
      }
    ]
  },
  
  store_notes: {
    tableName: 'store_notes',
    displayName: 'Store Notes',
    description: 'Import historical notes for stores',
    naturalKey: ['store_name', 'note_text', 'note_date'],
    relatedTables: ['stores'],
    fields: [
      {
        field: 'store_name',
        displayName: 'Store Name',
        type: 'string',
        required: true,
        source: 'excel',
        notes: 'Must match existing store',
        validation: (v) => v?.trim()?.length > 0 
          ? { valid: true } 
          : { valid: false, error: 'Store name is required' }
      },
      {
        field: 'note_text',
        displayName: 'Note Text',
        type: 'string',
        required: true,
        source: 'excel',
        notes: 'Will be preserved exactly - no HTML allowed',
        validation: (v) => {
          if (!v?.trim()) return { valid: false, error: 'Note text cannot be empty' };
          if (/<[^>]*>/.test(v)) return { valid: false, error: 'HTML tags not allowed in notes' };
          return { valid: true };
        }
      },
      {
        field: 'note_date',
        displayName: 'Note Date',
        type: 'date',
        required: false,
        source: 'excel',
        notes: 'YYYY-MM-DD format. Uses current date if empty.',
        validation: (v) => !v || dateRegex.test(v) 
          ? { valid: true } 
          : { valid: false, error: 'Date must be YYYY-MM-DD format' }
      },
      {
        field: 'created_by_name',
        displayName: 'Created By',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Name of person who created the note'
      }
    ]
  },
  
  combined_crm: {
    tableName: 'combined',
    displayName: 'Combined CRM Upload',
    description: 'Import stores, contacts, and notes in one file',
    naturalKey: ['store_name'],
    relatedTables: ['stores', 'store_contacts', 'store_notes'],
    fields: [
      // Store fields
      {
        field: 'store_name',
        displayName: 'Store Name',
        type: 'string',
        required: true,
        source: 'excel',
        validation: (v) => v?.trim()?.length > 0 
          ? { valid: true } 
          : { valid: false, error: 'Store name is required' }
      },
      {
        field: 'company',
        displayName: 'Company',
        type: 'string',
        required: false, // OPTIONAL - legal entity only, not required for individuals
        source: 'excel',
        notes: 'Legal entity only. Leave blank for individuals or unaffiliated stores.'
      },
      {
        field: 'brand',
        displayName: 'Brand',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Commercial brand (e.g., Grabba). Separate from Company.'
      },
      {
        field: 'address',
        displayName: 'Address',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'city',
        displayName: 'City',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'state',
        displayName: 'State',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'zip',
        displayName: 'ZIP',
        type: 'string',
        required: false,
        source: 'excel'
      },
      // Contact fields
      {
        field: 'contact_name',
        displayName: 'Contact Name',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'contact_phone',
        displayName: 'Contact Phone',
        type: 'phone',
        required: true, // REQUIRED - Phone is the primary contact identifier
        source: 'excel',
        notes: 'Primary identity key. Required when creating contact records.',
        validation: (v) => {
          if (!v?.trim()) return { valid: false, error: 'Phone number is required for Person records' };
          if (!phoneRegex.test(v)) return { valid: false, error: 'Invalid phone format' };
          // Reject placeholder numbers
          const digits = v.replace(/\D/g, '');
          if (/^(\d)\1+$/.test(digits)) return { valid: false, error: 'Invalid placeholder phone number' };
          if (digits.length < 10) return { valid: false, error: 'Phone number must have at least 10 digits' };
          return { valid: true };
        }
      },
      {
        field: 'contact_email',
        displayName: 'Contact Email',
        type: 'email',
        required: false,
        source: 'excel',
        validation: (v) => !v || emailRegex.test(v) 
          ? { valid: true } 
          : { valid: false, error: 'Invalid email format' }
      },
      {
        field: 'contact_role',
        displayName: 'Contact Role',
        type: 'string',
        required: false,
        source: 'excel'
      },
      // Notes
      {
        field: 'notes',
        displayName: 'Notes',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'note_date',
        displayName: 'Note Date',
        type: 'date',
        required: false,
        source: 'excel',
        validation: (v) => !v || dateRegex.test(v) 
          ? { valid: true } 
          : { valid: false, error: 'Date must be YYYY-MM-DD format' }
      },
      // Tags
      {
        field: 'tags',
        displayName: 'Tags',
        type: 'tags',
        required: false,
        source: 'excel',
        notes: 'Comma-separated'
      },
      // Member since
      {
        field: 'member_since',
        displayName: 'Member Since',
        type: 'date',
        required: false,
        autoDerive: true,
        source: 'derived'
      }
    ]
  }
};

export function getSchemaByType(type: string): UploadSchema | undefined {
  return uploadSchemas[type];
}

export function getRequiredFields(schema: UploadSchema): FieldSchema[] {
  return schema.fields.filter(f => f.required);
}

export function getOptionalFields(schema: UploadSchema): FieldSchema[] {
  return schema.fields.filter(f => !f.required);
}
