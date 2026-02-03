import { supabase } from '@/integrations/supabase/client';
import { OSRole } from '@/config/osNavigation';

export interface Invitation {
  id: string;
  email: string;
  phone?: string;
  role: OSRole;
  invite_token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  metadata?: Record<string, any>;
  assigned_brand_id?: string;
  assigned_store_id?: string;
}

export interface CreateInvitationParams {
  email: string;
  phone?: string;
  role: OSRole;
  assigned_brand_id?: string;
  assigned_store_id?: string;
  expires_hours?: number;
}

/**
 * Generate a secure invite token
 */
function generateInviteToken(): string {
  return crypto.randomUUID();
}

/**
 * Create a new invitation
 */
export async function createInvitation(params: CreateInvitationParams): Promise<{ invitation: Invitation | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { invitation: null, error: 'Not authenticated' };
  }

  const token = generateInviteToken();
  const expiresHours = params.expires_hours || 72;
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

  const insertData = {
    email: params.email.toLowerCase().trim(),
    phone: params.phone || null,
    role: params.role as any,
    invite_token: token,
    invited_by: user.id,
    expires_at: expiresAt,
    metadata: {
      assigned_brand_id: params.assigned_brand_id,
      assigned_store_id: params.assigned_store_id,
    }
  };

  const { data, error } = await supabase
    .from('user_invitations')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Invitation creation error:', error);
    return { invitation: null, error: error.message };
  }

  return { invitation: data as unknown as Invitation, error: null };
}

/**
 * Validate an invitation token
 */
export async function validateInviteToken(token: string): Promise<{ invitation: Invitation | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_invitations')
    .select('*')
    .eq('invite_token', token)
    .single();

  if (error || !data) {
    return { invitation: null, error: 'Invalid invitation token' };
  }

  const invitation = data as unknown as Invitation;

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return { invitation: null, error: 'This invitation has expired' };
  }

  // Check if already used
  if (invitation.accepted_at) {
    return { invitation: null, error: 'This invitation has already been used' };
  }

  return { invitation, error: null };
}

/**
 * Mark invitation as accepted
 */
export async function markInvitationAccepted(token: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('user_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('invite_token', token);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Get all invitations (admin only)
 */
export async function getInvitations(): Promise<{ invitations: Invitation[]; error: string | null }> {
  const { data, error } = await supabase
    .from('user_invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { invitations: [], error: error.message };
  }

  return { invitations: (data || []) as unknown as Invitation[], error: null };
}

/**
 * Delete an invitation
 */
export async function deleteInvitation(id: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('user_invitations')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Generate the invite link URL
 */
export function getInviteLink(token: string): string {
  return `${window.location.origin}/signup?token=${token}`;
}

/**
 * Role display names for UI
 */
export const INVITE_ROLES: { value: OSRole; label: string; description: string }[] = [
  { value: 'biker', label: 'Biker / Store Checker', description: 'Field sales, store checks, footwork' },
  { value: 'driver', label: 'Driver', description: 'Deliveries & route management' },
  { value: 'ambassador', label: 'Ambassador', description: 'Store acquisition & relationships' },
  { value: 'production', label: 'Production', description: 'Inventory, warehouse, fulfillment' },
  { value: 'va', label: 'Virtual Assistant', description: 'CRM, communications, operations support' },
  { value: 'csr', label: 'Customer Service Rep', description: 'Call center & customer support' },
  { value: 'accountant', label: 'Accountant', description: 'Financial operations & payroll' },
  { value: 'wholesaler', label: 'Wholesaler', description: 'Wholesale ordering & distribution' },
  { value: 'store', label: 'Store Owner', description: 'Store portal access' },
];
