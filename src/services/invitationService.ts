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
  action: 'invite_created' | 'invite_accepted' | 'invite_expired' | 'invite_revoked' | 'invite_resent',
  inviteId: string,
  metadata?: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // Use a generic insert that works with any audit table structure
    await supabase.from('security_audit_log').insert({
      user_id: user?.id || null,
      action: action,
      resource_type: 'invitation',
      resource_id: inviteId,
      metadata: metadata || {}
    } as any);
  } catch (err) {
    console.error('Failed to log invite audit:', err);
    // Don't fail the main operation for audit log failures
  }
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

  // Audit log
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
    // Don't fail the invitation creation if email fails
  }

  return { invitation: data as unknown as Invitation, error: null, emailSent };
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
    return { invitation: null, error: 'Invite not found' };
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
export async function acceptInvitation(
  token: string, 
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  // First validate
  const { invitation, error: validateError } = await validateInviteToken(token);
  if (validateError || !invitation) {
    return { success: false, error: validateError || 'Invalid invitation' };
  }

  // Mark as accepted
  const { error: updateError } = await supabase
    .from('user_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('invite_token', token);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Note: Role-specific assignment tables (biker_store_assignments, driver_route_assignments, etc.)
  // would be created here if those tables exist. For now, the metadata is stored on the invitation
  // and can be used by the application to create assignments as needed.

  // Audit log
  await logInviteAudit('invite_accepted', invitation.id, {
    user_id: userId,
    role: invitation.role,
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
    .update({ accepted_at: new Date().toISOString() })
    .eq('invite_token', token);

  if (error) {
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
      expires_at: newExpiry
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
 * Delete an invitation permanently
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
