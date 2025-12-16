import { supabase } from '@/integrations/supabase/client';

export interface ProductInput {
  name: string;
  brand_id?: string | null;
  category?: string | null;
  type: string;
  unit_type: string;
  sku?: string | null;
  status?: string;
  suggested_retail_price?: number;
  wholesale_price?: number;
  cost?: number;
  min_order_qty?: number;
  bulk_discount_rules?: any[];
  taxable?: boolean;
  units_per_box?: number;
  units_per_pack?: number;
  track_inventory?: boolean;
  low_stock_threshold?: number;
  available_to_stores?: boolean;
  available_to_wholesalers?: boolean;
  available_to_ambassadors?: boolean;
  available_direct?: boolean;
  available_for_promotions?: boolean;
  short_description?: string;
  description?: string;
  strength_level?: string;
  flavor_notes?: string;
  image_url?: string | null;
  documents?: string[];
  suggested_upsell_product_id?: string | null;
  suggested_crosssell_product_id?: string | null;
  target_store_type?: string | null;
  ai_notes?: string;
  age_restricted?: boolean;
  requires_license?: boolean;
  internal_notes?: string;
  is_active?: boolean;
}

export interface ProductValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates product input before database operations
 */
export function validateProduct(input: Partial<ProductInput>): ProductValidationResult {
  const errors: string[] = [];

  if (!input.name?.trim()) {
    errors.push('Product name is required');
  }

  if (!input.type?.trim()) {
    errors.push('Product type is required');
  }

  if (!input.unit_type?.trim()) {
    errors.push('Unit type is required');
  }

  // Wholesale price is required by database schema (NOT NULL)
  if (input.wholesale_price === undefined || input.wholesale_price === null) {
    errors.push('Wholesale price is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a new product with full validation
 * @throws Error if validation fails or database operation fails
 */
export async function createProduct(input: ProductInput): Promise<{ id: string }> {
  // Validate session first
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    console.error('AUTH ERROR: No active session', { sessionError });
    throw new Error('You must be signed in to create products');
  }

  // Validate input
  const validation = validateProduct(input);
  if (!validation.valid) {
    console.error('VALIDATION ERROR:', validation.errors);
    throw new Error(validation.errors.join(', '));
  }

  // Prepare payload - ensure required fields have values
  const payload = {
    name: input.name.trim(),
    brand_id: input.brand_id || null,
    category: input.category?.trim() || null,
    type: input.type.trim(),
    unit_type: input.unit_type.trim(),
    sku: input.sku?.trim() || null,
    status: input.status || 'active',
    suggested_retail_price: input.suggested_retail_price ?? 0,
    wholesale_price: input.wholesale_price ?? 0,
    cost: input.cost ?? 0,
    min_order_qty: input.min_order_qty ?? 1,
    bulk_discount_rules: input.bulk_discount_rules ?? [],
    taxable: input.taxable ?? true,
    units_per_box: input.units_per_box ?? 1,
    units_per_pack: input.units_per_pack ?? 1,
    track_inventory: input.track_inventory ?? true,
    low_stock_threshold: input.low_stock_threshold ?? 10,
    available_to_stores: input.available_to_stores ?? true,
    available_to_wholesalers: input.available_to_wholesalers ?? true,
    available_to_ambassadors: input.available_to_ambassadors ?? false,
    available_direct: input.available_direct ?? false,
    available_for_promotions: input.available_for_promotions ?? true,
    short_description: input.short_description?.trim() || null,
    description: input.description?.trim() || null,
    strength_level: input.strength_level?.trim() || null,
    flavor_notes: input.flavor_notes?.trim() || null,
    image_url: input.image_url || null,
    documents: input.documents ?? [],
    suggested_upsell_product_id: input.suggested_upsell_product_id || null,
    suggested_crosssell_product_id: input.suggested_crosssell_product_id || null,
    target_store_type: input.target_store_type?.trim() || null,
    ai_notes: input.ai_notes?.trim() || null,
    age_restricted: input.age_restricted ?? true,
    requires_license: input.requires_license ?? true,
    internal_notes: input.internal_notes?.trim() || null,
    is_active: input.is_active ?? (input.status === 'active'),
  };

  console.log('PRODUCT INSERT PAYLOAD:', {
    user_id: sessionData.session.user.id,
    payload,
  });

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('PRODUCT INSERT FAILED:', {
      error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  console.log('PRODUCT INSERT SUCCESS:', data);
  return data;
}

/**
 * Updates an existing product with full validation
 * @throws Error if validation fails or database operation fails
 */
export async function updateProduct(productId: string, input: Partial<ProductInput>): Promise<{ id: string }> {
  if (!productId) {
    throw new Error('Product ID is required for update');
  }

  // Validate session first
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    console.error('AUTH ERROR: No active session', { sessionError });
    throw new Error('You must be signed in to update products');
  }

  // Build update payload - only include fields that are provided
  const payload: Record<string, any> = {};

  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.brand_id !== undefined) payload.brand_id = input.brand_id || null;
  if (input.category !== undefined) payload.category = input.category?.trim() || null;
  if (input.type !== undefined) payload.type = input.type.trim();
  if (input.unit_type !== undefined) payload.unit_type = input.unit_type.trim();
  if (input.sku !== undefined) payload.sku = input.sku?.trim() || null;
  if (input.status !== undefined) {
    payload.status = input.status;
    payload.is_active = input.status === 'active';
  }
  if (input.suggested_retail_price !== undefined) payload.suggested_retail_price = input.suggested_retail_price;
  if (input.wholesale_price !== undefined) payload.wholesale_price = input.wholesale_price;
  if (input.cost !== undefined) payload.cost = input.cost;
  if (input.min_order_qty !== undefined) payload.min_order_qty = input.min_order_qty;
  if (input.bulk_discount_rules !== undefined) payload.bulk_discount_rules = input.bulk_discount_rules;
  if (input.taxable !== undefined) payload.taxable = input.taxable;
  if (input.units_per_box !== undefined) payload.units_per_box = input.units_per_box;
  if (input.units_per_pack !== undefined) payload.units_per_pack = input.units_per_pack;
  if (input.track_inventory !== undefined) payload.track_inventory = input.track_inventory;
  if (input.low_stock_threshold !== undefined) payload.low_stock_threshold = input.low_stock_threshold;
  if (input.available_to_stores !== undefined) payload.available_to_stores = input.available_to_stores;
  if (input.available_to_wholesalers !== undefined) payload.available_to_wholesalers = input.available_to_wholesalers;
  if (input.available_to_ambassadors !== undefined) payload.available_to_ambassadors = input.available_to_ambassadors;
  if (input.available_direct !== undefined) payload.available_direct = input.available_direct;
  if (input.available_for_promotions !== undefined) payload.available_for_promotions = input.available_for_promotions;
  if (input.short_description !== undefined) payload.short_description = input.short_description?.trim() || null;
  if (input.description !== undefined) payload.description = input.description?.trim() || null;
  if (input.strength_level !== undefined) payload.strength_level = input.strength_level?.trim() || null;
  if (input.flavor_notes !== undefined) payload.flavor_notes = input.flavor_notes?.trim() || null;
  if (input.image_url !== undefined) payload.image_url = input.image_url || null;
  if (input.documents !== undefined) payload.documents = input.documents;
  if (input.suggested_upsell_product_id !== undefined) payload.suggested_upsell_product_id = input.suggested_upsell_product_id || null;
  if (input.suggested_crosssell_product_id !== undefined) payload.suggested_crosssell_product_id = input.suggested_crosssell_product_id || null;
  if (input.target_store_type !== undefined) payload.target_store_type = input.target_store_type?.trim() || null;
  if (input.ai_notes !== undefined) payload.ai_notes = input.ai_notes?.trim() || null;
  if (input.age_restricted !== undefined) payload.age_restricted = input.age_restricted;
  if (input.requires_license !== undefined) payload.requires_license = input.requires_license;
  if (input.internal_notes !== undefined) payload.internal_notes = input.internal_notes?.trim() || null;

  console.log('PRODUCT UPDATE PAYLOAD:', {
    user_id: sessionData.session.user.id,
    productId,
    payload,
  });

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', productId)
    .select('id')
    .single();

  if (error) {
    console.error('PRODUCT UPDATE FAILED:', {
      error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  console.log('PRODUCT UPDATE SUCCESS:', data);
  return data;
}

/**
 * Fetches a single product by ID
 */
export async function getProduct(productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id, name)')
    .eq('id', productId)
    .single();

  if (error) {
    console.error('PRODUCT FETCH FAILED:', error);
    throw error;
  }

  return data;
}

/**
 * Fetches all products with optional filtering
 */
export async function getProducts(filters?: { brand_id?: string; status?: string; category?: string }) {
  let query = supabase
    .from('products')
    .select('*, brand:brands(id, name)')
    .order('name');

  if (filters?.brand_id) {
    query = query.eq('brand_id', filters.brand_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('PRODUCTS FETCH FAILED:', error);
    throw error;
  }

  return data || [];
}
