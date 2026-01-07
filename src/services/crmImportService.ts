/**
 * CRM Import Service
 * Handles bulk import of contacts, notes, and order history from old CRM systems
 */
import { supabase } from '@/integrations/supabase/client';

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

export interface ImportRow {
  [key: string]: any;
}

export interface ImportOptions {
  businessId: string;
  entityType: string;
  fieldMapping: Record<string, string>;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}

/**
 * Import contacts from Excel/CSV data
 */
export async function importContacts(
  rows: ImportRow[],
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    warnings: [],
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  for (const row of rows) {
    try {
      // Map fields based on fieldMapping
      const contactData: any = {
        business_id: options.businessId,
        created_by: user.id,
      };

      // Map each field
      for (const [sourceField, targetField] of Object.entries(options.fieldMapping)) {
        if (targetField === '__skip__' || !row[sourceField]) continue;
        
        const value = row[sourceField];
        
        // Handle different field types
        switch (targetField) {
          case 'name':
          case 'contact_name':
            contactData.name = String(value).trim();
            contactData.contact_name = String(value).trim();
            break;
          case 'phone':
          case 'contact_phone':
            contactData.phone = String(value).trim();
            contactData.contact_phone = String(value).trim();
            break;
          case 'email':
          case 'contact_email':
            contactData.email = String(value).trim();
            contactData.contact_email = String(value).trim();
            break;
          case 'type':
            contactData.type = String(value).trim();
            break;
          case 'organization':
            contactData.organization = String(value).trim();
            break;
          case 'address':
          case 'address_street':
            contactData.address = String(value).trim();
            contactData.address_street = String(value).trim();
            break;
          case 'city':
          case 'address_city':
            contactData.city = String(value).trim();
            contactData.address_city = String(value).trim();
            break;
          case 'state':
          case 'address_state':
            contactData.state = String(value).trim();
            contactData.address_state = String(value).trim();
            break;
          case 'zip':
          case 'address_zip':
            contactData.zip = String(value).trim();
            contactData.address_zip = String(value).trim();
            break;
          case 'notes':
            contactData.notes = String(value).trim();
            break;
          case 'tags':
            contactData.tags = Array.isArray(value) ? value : String(value).split(',').map(t => t.trim());
            break;
          case 'relationship_status':
            contactData.relationship_status = String(value).trim().toLowerCase();
            break;
          default:
            // Store other fields as-is
            contactData[targetField] = value;
        }
      }

      // Validate required fields
      if (!contactData.name && !contactData.contact_name) {
        result.failed++;
        result.errors.push(`Row ${rows.indexOf(row) + 1}: Missing name`);
        continue;
      }

      // Check for duplicates if skipDuplicates is enabled
      if (options.skipDuplicates && contactData.phone) {
        const { data: existing } = await (supabase as any)
          .from('brand_crm_contacts')
          .select('id')
          .eq('business_id', options.businessId)
          .eq('phone', contactData.phone)
          .limit(1)
          .single();

        if (existing) {
          if (options.updateExisting) {
            // Update existing contact
            const { error } = await (supabase as any)
              .from('brand_crm_contacts')
              .update(contactData)
              .eq('id', existing.id);
            
            if (error) throw error;
            result.success++;
            result.warnings.push(`Row ${rows.indexOf(row) + 1}: Updated existing contact`);
          } else {
            result.failed++;
            result.warnings.push(`Row ${rows.indexOf(row) + 1}: Duplicate contact skipped`);
          }
          continue;
        }
      }

      // Insert new contact
      const { error } = await (supabase as any)
        .from('brand_crm_contacts')
        .insert(contactData);

      if (error) throw error;
      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Row ${rows.indexOf(row) + 1}: ${error.message || 'Unknown error'}`);
    }
  }

  return result;
}

/**
 * Import notes from Excel/CSV data
 */
export async function importNotes(
  rows: ImportRow[],
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    warnings: [],
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  for (const row of rows) {
    try {
      const noteData: any = {
        created_by: user.id,
      };

      // Map fields
      for (const [sourceField, targetField] of Object.entries(options.fieldMapping)) {
        if (targetField === '__skip__' || !row[sourceField]) continue;
        
        const value = row[sourceField];
        
        switch (targetField) {
          case 'entity_type':
            noteData.entity_type = String(value).trim();
            break;
          case 'entity_id':
            noteData.entity_id = String(value).trim();
            break;
          case 'content':
          case 'notes':
            noteData.content = String(value).trim();
            break;
          default:
            noteData[targetField] = value;
        }
      }

      // Validate required fields
      if (!noteData.entity_type || !noteData.entity_id || !noteData.content) {
        result.failed++;
        result.errors.push(`Row ${rows.indexOf(row) + 1}: Missing required fields (entity_type, entity_id, content)`);
        continue;
      }

      // Check if note exists (upsert)
      const { data: existing } = await supabase
        .from('crm_personal_notes')
        .select('id')
        .eq('entity_type', noteData.entity_type)
        .eq('entity_id', noteData.entity_id)
        .limit(1)
        .single();

      if (existing) {
        // Update existing note
        const { error } = await supabase
          .from('crm_personal_notes')
          .update({
            content: noteData.content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
        result.success++;
        result.warnings.push(`Row ${rows.indexOf(row) + 1}: Updated existing note`);
      } else {
        // Insert new note
        const { error } = await supabase
          .from('crm_personal_notes')
          .insert(noteData);

        if (error) throw error;
        result.success++;
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Row ${rows.indexOf(row) + 1}: ${error.message || 'Unknown error'}`);
    }
  }

  return result;
}

/**
 * Import order history from Excel/CSV data
 */
export async function importOrderHistory(
  rows: ImportRow[],
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    warnings: [],
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  for (const row of rows) {
    try {
      const orderData: any = {
        business_id: options.businessId,
        created_by: user.id,
      };

      // Map fields
      for (const [sourceField, targetField] of Object.entries(options.fieldMapping)) {
        if (targetField === '__skip__' || !row[sourceField]) continue;
        
        const value = row[sourceField];
        
        switch (targetField) {
          case 'customer_id':
          case 'contact_id':
            orderData.customer_id = String(value).trim();
            break;
          case 'order_date':
            orderData.order_date = value instanceof Date ? value.toISOString().split('T')[0] : String(value).trim();
            break;
          case 'items':
            orderData.items = typeof value === 'string' ? JSON.parse(value) : value;
            break;
          case 'subtotal':
          case 'total':
            orderData[targetField] = parseFloat(String(value)) || 0;
            break;
          case 'tax':
            orderData.tax = parseFloat(String(value)) || 0;
            break;
          case 'payment_method':
            orderData.payment_method = String(value).trim();
            break;
          case 'notes':
            orderData.notes = String(value).trim();
            break;
          default:
            orderData[targetField] = value;
        }
      }

      // Validate required fields
      if (!orderData.customer_id && !orderData.contact_id) {
        result.failed++;
        result.errors.push(`Row ${rows.indexOf(row) + 1}: Missing customer/contact ID`);
        continue;
      }

      // Use customer_id or contact_id
      const customerId = orderData.customer_id || orderData.contact_id;
      delete orderData.contact_id;

      // Insert order
      const { error } = await supabase
        .from('customer_orders')
        .insert({
          ...orderData,
          customer_id: customerId,
        });

      if (error) throw error;
      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Row ${rows.indexOf(row) + 1}: ${error.message || 'Unknown error'}`);
    }
  }

  return result;
}

/**
 * Generic import function that routes to appropriate import handler
 */
export async function importCRMData(
  rows: ImportRow[],
  options: ImportOptions
): Promise<ImportResult> {
  switch (options.entityType) {
    case 'contact':
    case 'customer':
    case 'partner':
    case 'influencer':
      return importContacts(rows, options);
    
    case 'note':
    case 'notes':
      return importNotes(rows, options);
    
    case 'order':
    case 'orders':
    case 'order_history':
      return importOrderHistory(rows, options);
    
    default:
      throw new Error(`Unsupported entity type: ${options.entityType}`);
  }
}

