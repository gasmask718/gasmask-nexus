import { supabase } from '@/integrations/supabase/client';
import { OSRole } from '@/config/osNavigation';

export type InviteStatus = 'sent' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  email: string;
  phone?: string;
  role: OSRole;
  invite_token: string;
  invited_by: string;
  invite_status: InviteStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
  metadata?: Record<string, any>;
  assigned_brand_id?: string;
  assigned_store_id?: string;
  assigned_route_id?: string;
  assigned_warehouse_id?: string;
}

export interface CreateInvitationParams {
  email: string;
  phone?: string;
  role: OSRole;
  assigned_brand_id?: string;
  assigned_store_id?: string;
  assigned_route_id?: string;
  assigned_warehouse_id?: string;
  expires_hours?: number;
}

/**
 * Generate a secure invite token
 */
function generateInviteToken(): string {
  return crypto.randomUUID();
}

/**
 * Log invite audit events
 */
async function logInviteAudit(
  action: 'invite_created' | 'invite_accepted' | 'invite_expired' | 'invite_revoked' | 'invite_resent' | 'access_granted' | 'access_revoked',
  inviteId: string,
  metadata?: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('security_audit_log').insert({
      user_id: user?.id || null,
      action: action,
      resource_type: 'invitation',
      resource_id: inviteId,
      metadata: metadata || {}
    } as any);
  } catch (err) {
    console.error('Failed to log invite audit:', err);
  }
}

/**
 * Compute the effective status of an invitation
 * (handles expired status which is time-based, not stored)
 */
export function getEffectiveStatus(invitation: Invitation): InviteStatus {
  if (invitation.invite_status === 'revoked') return 'revoked';
  if (invitation.invite_status === 'accepted') return 'accepted';
  if (new Date(invitation.expires_at) < new Date()) return 'expired';
  return 'sent';
}

/**
 * Create a new invitation
 */
export async function createInvitation(params: CreateInvitationParams): Promise<{ invitation: Invitation | null; error: string | null; emailSent?: boolean }> {
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
    invite_status: 'sent' as any,
    expires_at: expiresAt,
    metadata: {
      assigned_brand_id: params.assigned_brand_id,
      assigned_store_id: params.assigned_store_id,
      assigned_route_id: params.assigned_route_id,
      assigned_warehouse_id: params.assigned_warehouse_id,
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

  await logInviteAudit('invite_created', data.id, { 
    email: params.email, 
    role: params.role,
    invited_by: user.id 
  });

  // Send invitation email via edge function
  let emailSent = false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const response = await supabase.functions.invoke('send-user-invite', {
        body: {
          email: params.email.toLowerCase().trim(),
          role: params.role,
          inviteToken: token,
          expiresAt: expiresAt,
        }
      });

      if (response.error) {
        console.error('Failed to send invitation email:', response.error);
      } else if (response.data?.success) {
        emailSent = true;
        console.log('✅ Invitation email sent successfully to', params.email);
      }
    }
  } catch (emailError) {
    console.error('Error sending invitation email:', emailError);
  }

  return { invitation: data as unknown as Invitation, error: null, emailSent };
}

/**
 * Validate an invitation token
 */
export async function validateInviteToken(token: string): Promise<{ invitation: Invitation | null; error: string | null }> {
  // Token-scoped lookup (security definer RPC) — the table itself is not
  // readable by anonymous visitors.
  const { data, error } = await (supabase as any)
    .rpc('validate_invite_token_public', { _token: token });

  const row = Array.isArray(data) ? data[0] : data;

  if (error || !row) {
    return { invitation: null, error: 'Invite not found' };
  }

  const invitation = row as unknown as Invitation;


  // Check if revoked
  if (invitation.invite_status === 'revoked') {
    return { invitation: null, error: 'This invitation has been revoked' };
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return { invitation: null, error: 'This invitation has expired' };
  }

  // Check if already used
  if (invitation.accepted_at || invitation.invite_status === 'accepted') {
    return { invitation: null, error: 'This invitation has already been used' };
  }

  return { invitation, error: null };
}

/**
 * Accept invitation — records acceptance with full audit trail
 * CRITICAL: This is the canonical acceptance function.
 */
export async function acceptInvitation(
  token: string, 
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  const { invitation, error: validateError } = await validateInviteToken(token);
  if (validateError || !invitation) {
    return { success: false, error: validateError || 'Invalid invitation' };
  }

  // Mark as accepted with user ID
  const { error: updateError } = await supabase
    .from('user_invitations')
    .update({ 
      accepted_at: new Date().toISOString(),
      accepted_user_id: userId,
      invite_status: 'accepted' as any,
    })
    .eq('invite_token', token);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Log acceptance
  await logInviteAudit('invite_accepted', invitation.id, {
    user_id: userId,
    role: invitation.role,
    email: invitation.email
  });

  // Log access granted
  await logInviteAudit('access_granted', invitation.id, {
    user_id: userId,
    role: invitation.role,
    portal: invitation.role,
    email: invitation.email
  });

  return { success: true, error: null };
}

/**
 * Legacy function for backward compatibility
 */
export async function markInvitationAccepted(token: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('user_invitations')
    .update({ 
      accepted_at: new Date().toISOString(),
      invite_status: 'accepted' as any,
    })
    .eq('invite_token', token);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Revoke user access via RPC (non-destructive)
 * Removes role, marks invite as revoked, logs audit
 */
export async function revokeUserAccess(
  inviteId: string, 
  reason?: string
): Promise<{ success: boolean; error: string | null; result?: any }> {
  const { data, error } = await supabase.rpc('revoke_user_access', {
    _invite_id: inviteId,
    _reason: reason || null,
  });

  if (error) {
    console.error('Revoke access error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null, result: data };
}

/**
 * Reinstate revoked access via RPC
 */
export async function reinstateUserAccess(
  inviteId: string
): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('reinstate_user_access', {
    _invite_id: inviteId,
  });

  if (error) {
    console.error('Reinstate access error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Resend invitation (regenerate token + extend expiry)
 */
export async function resendInvitation(id: string): Promise<{ invitation: Invitation | null; error: string | null }> {
  const newToken = generateInviteToken();
  const newExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('user_invitations')
    .update({ 
      invite_token: newToken, 
      expires_at: newExpiry,
      invite_status: 'sent' as any,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { invitation: null, error: error.message };
  }

  await logInviteAudit('invite_resent', id);
  return { invitation: data as unknown as Invitation, error: null };
}

/**
 * Get all invitations with inviter profile info (admin only)
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
 * Delete an invitation permanently (only for unsent/pending invites)
 * GOVERNANCE: Accepted/revoked invites should NEVER be deleted for audit trail
 */
export async function deleteInvitation(id: string): Promise<{ success: boolean; error: string | null }> {
  // Only allow deletion of 'sent' invites (not accepted/revoked)
  const { data: invite } = await supabase
    .from('user_invitations')
    .select('invite_status')
    .eq('id', id)
    .single();

  if (invite && (invite as any).invite_status !== 'sent') {
    return { success: false, error: 'Cannot delete accepted or revoked invitations. Use revoke instead.' };
  }

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
 * Send invitation email via edge function
 */
export async function sendInviteEmail(email: string, role: string, inviteLink: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('send-user-invite', {
    body: {
      email: email.toLowerCase().trim(),
      role,
      inviteToken: inviteLink.split('token=')[1] || '',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    }
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to send email');
  }

  if (!response.data?.success) {
    throw new Error('Email delivery failed');
  }
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
