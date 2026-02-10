/**
 * Upload Schema Definitions
 * Defines required/optional fields, types, and validation rules for each upload type
 */

export interface FieldSchema {
  field: string;
  displayName: string;
  type: 'string'; // ALL fields are strings for simplicity - no type coercion
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

// ALL DATA IS TREATED AS STRINGS - No format validation for simplicity
// This prevents import failures due to format mismatches

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
        required: false,
        source: 'excel',
        notes: 'Optional. Address is the only required identifier.',
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
        required: true,
        source: 'excel',
        notes: 'Required field. Store can be identified by address even without a name.'
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
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'email',
        displayName: 'Email',
        type: 'string',
        required: false,
        source: 'excel'
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
        field: 'type',
        displayName: 'Store Type',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'bodega, smoke_shop, gas_station, wholesaler, other'
      },
      {
        field: 'open_date',
        displayName: 'Member Since',
        type: 'string',
        required: false,
        autoDerive: true,
        source: 'derived',
        notes: 'Auto-derived from oldest note if not provided'
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
        notes: 'Will be copied word-for-word (General notes)'
      },
      {
        field: 'gasmask_notes',
        displayName: 'GasMask Notes',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Brand-specific notes for GasMask'
      },
      {
        field: 'hotmama_notes',
        displayName: 'Hot Mama Notes',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Brand-specific notes for Hot Mama'
      },
      {
        field: 'hotscolatti_notes',
        displayName: 'Hot Scolatti Notes',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Brand-specific notes for Hot Scolatti'
      },
      {
        field: 'grabba_notes',
        displayName: 'Grabba R Us Notes',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Brand-specific notes for Grabba R Us'
      },
      {
        field: 'tags',
        displayName: 'Tags',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Comma-separated, auto-registered globally'
      },
      {
        field: 'starter_kit',
        displayName: 'Starter Kit',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Yes/No or True/False - enables Starter Kit signal in Tube Intelligence'
      },
      {
        field: 'primary_contact_name',
        displayName: 'Primary Contact Name',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'alt_phone',
        displayName: 'Alt Phone',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'neighborhood',
        displayName: 'Neighborhood',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'boro',
        displayName: 'Borough',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'wholesaler_name',
        displayName: 'Wholesaler',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'sells_flowers',
        displayName: 'Sells Flowers',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Yes/No or True/False'
      },
      {
        field: 'prime_time_energy',
        displayName: 'Prime Time Energy',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Yes/No or True/False'
      },
      {
        field: 'payment_type',
        displayName: 'Payment Type',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'cash, card, zelle, etc.'
      },
      {
        field: 'special_information',
        displayName: 'Special Information',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'notes_overview',
        displayName: 'Notes Overview',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'store_code',
        displayName: 'Store Code',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'market_code',
        displayName: 'Market Code',
        type: 'string',
        required: false,
        source: 'excel'
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
        type: 'string', // Treat phone as string - no format validation
        required: true, // REQUIRED - Phone is the primary contact identifier
        source: 'excel',
        notes: 'Primary identity key for contacts. Required for all person records.',
        validation: (v) => {
          if (!v?.toString().trim()) return { valid: false, error: 'Phone number is required for Person records' };
          return { valid: true };
        }
      },
      {
        field: 'email',
        displayName: 'Email',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'is_primary',
        displayName: 'Primary Contact',
        type: 'string',
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
        notes: 'Will be preserved exactly - HTML content is allowed and rendered',
        validation: (v) => {
          if (!v?.trim()) return { valid: false, error: 'Note text cannot be empty' };
          return { valid: true };
        }
      },
      {
        field: 'note_date',
        displayName: 'Note Date',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Date format. Uses current date if empty.'
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
        type: 'string', // Treat phone as string - no format validation
        required: false, // Optional at row level - but required if contact_name is provided
        source: 'excel',
        notes: 'Primary identity key. Required when contact_name is provided.'
        // No validation - accept any string value
      },
      {
        field: 'contact_email',
        displayName: 'Contact Email',
        type: 'string',
        required: false,
        source: 'excel'
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
        type: 'string',
        required: false,
        source: 'excel'
      },
      // Tags
      {
        field: 'tags',
        displayName: 'Tags',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Pipe-separated (e.g., Tag1 | Tag2) or comma-separated'
      },
      // Member since
      {
        field: 'member_since',
        displayName: 'Member Since',
        type: 'string',
        required: false,
        autoDerive: true,
        source: 'derived'
      }
    ]
  },

  invoices: {
    tableName: 'invoices',
    displayName: 'Invoices',
    description: 'Import invoices matched to existing stores by client name',
    naturalKey: ['client_name', 'title'],
    relatedTables: ['store_master'],
    fields: [
      {
        field: 'client_name',
        displayName: 'Client Name',
        type: 'string',
        required: true,
        source: 'excel',
        notes: 'Must match an existing store name in the system',
        validation: (v) => v?.trim()?.length > 0 
          ? { valid: true } 
          : { valid: false, error: 'Client name is required' }
      },
      {
        field: 'title',
        displayName: 'Title',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Invoice title or description'
      },
      {
        field: 'amount',
        displayName: 'Amount',
        type: 'string',
        required: true,
        source: 'excel',
        notes: 'Total amount of the invoice',
        validation: (v) => {
          if (!v) return { valid: false, error: 'Amount is required' };
          const num = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
          return !isNaN(num) ? { valid: true } : { valid: false, error: 'Amount must be a number' };
        }
      },
      {
        field: 'payment_status',
        displayName: 'Payment Status',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'paid, unpaid, partial, refunded'
      },
      {
        field: 'payment_method',
        displayName: 'Payment Method',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Cash, Card, Zelle, etc.'
      },
      {
        field: 'due_date',
        displayName: 'Due Date',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Date format. Uses current date if empty.'
      },
      {
        field: 'created_at',
        displayName: 'Created At',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Invoice creation date'
      },
      {
        field: 'notes',
        displayName: 'Notes',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'client_phone',
        displayName: 'Client Phone',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Used as fallback for store matching'
      },
      {
        field: 'client_address',
        displayName: 'Client Address',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'Used as fallback for store matching'
      },
      {
        field: 'client_tags',
        displayName: 'Client Tags',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'reference',
        displayName: 'Reference',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'External reference number'
      },
      {
        field: 'currency',
        displayName: 'Currency',
        type: 'string',
        required: false,
        source: 'excel',
        notes: 'USD by default'
      },
      {
        field: 'issued_by',
        displayName: 'Issued By',
        type: 'string',
        required: false,
        source: 'excel'
      },
      {
        field: 'brand',
        displayName: 'Brand',
        type: 'string',
        required: false,
        source: 'excel'
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
