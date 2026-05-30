/**
 * Field Governance Types
 * 
 * Strict types for the field governance pipeline.
 */

// Field roles that MUST go through governance
export const FIELD_ROLES = ['driver', 'biker', 'ambassador'] as const;
export type FieldRole = typeof FIELD_ROLES[number];

// All roles including admin (for type safety)
export type AllRoles = FieldRole | 'admin' | 'va' | 'owner' | 'ceo' | 'accountant' | 'production' | 'csr';

// Entity types that can be governed (must match field_entity_type enum in DB)
export type FieldEntityType = 
  | 'brand_sticker'
  | 'tube_inventory'
  | 'invoice'
  | 'invoice_line_item'
  | 'visit_log'
  | 'order_note'
  | 'store_update'
  | 'store_contact'
  | 'wholesaler_association'
  | 'connected_store'
  | 'store_questionnaire'
  | 'new_store';

// Action types
export type FieldActionType = 'create' | 'update' | 'delete';

// Update method — HOW the field change was made (chain-of-custody)
export const UPDATE_METHODS = ['in_person', 'call', 'text', 'system'] as const;
export type UpdateMethod = typeof UPDATE_METHODS[number];

// Submission source detection
export type SubmissionSource = 
  | 'driver_portal'
  | 'biker_portal'
  | 'ambassador_portal'
  | 'admin_panel'
  | 'mobile'
  | 'desktop'
  | 'unknown';

/**
 * Payload for submitting a field change through governance
 */
export interface FieldSubmissionPayload {
  // Required
  store_id: string;
  entity_type: FieldEntityType;
  action_type: FieldActionType;
  payload_after: Record<string, unknown>;
  
  // Optional
  entity_id?: string;
  payload_before?: Record<string, unknown>;
  submission_source?: SubmissionSource;
  update_method?: UpdateMethod;
}

/**
 * Result of a governed field mutation
 */
export interface FieldGovernanceResult {
  success: boolean;
  submissionId: string | null;
  error?: string;
  errorCode?: string;
  // Whether the change was auto-applied (current mode) or pending review
  status: 'applied' | 'pending_review' | 'rejected' | 'error';
}

/**
 * Check if a role is a field role (must go through governance)
 */
export function isFieldRole(role: string | null | undefined): role is FieldRole {
  if (!role) return false;
  return FIELD_ROLES.includes(role as FieldRole);
}

/**
 * Detect submission source based on current context
 */
export function getSubmissionSource(role?: string): SubmissionSource {
  // Check URL path for portal detection
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  
  if (path.includes('/portal/driver')) return 'driver_portal';
  if (path.includes('/portal/biker')) return 'biker_portal';
  if (path.includes('/portal/ambassador')) return 'ambassador_portal';
  
  // Check for mobile viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  if (role === 'driver') return isMobile ? 'mobile' : 'driver_portal';
  if (role === 'biker') return isMobile ? 'mobile' : 'biker_portal';
  if (role === 'ambassador') return isMobile ? 'mobile' : 'ambassador_portal';
  if (role === 'admin' || role === 'owner' || role === 'va') return 'admin_panel';
  
  return isMobile ? 'mobile' : 'desktop';
}
