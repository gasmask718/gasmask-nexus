import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PortalDevice {
  id: string;
  user_id: string;
  portal_type: 'driver' | 'biker';
  device_name: string | null;
  platform: string | null;
  browser: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_trusted: boolean;
  is_revoked: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

interface PortalSession {
  id: string;
  user_id: string;
  portal_type: 'driver' | 'biker';
  device_id: string | null;
  issued_at: string;
  access_expires_at: string;
  last_activity_at: string | null;
  ip_address: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

interface UserSecurityState {
  id: string;
  user_id: string;
  password_changed_at: string | null;
  role_changed_at: string | null;
  force_logout_at: string | null;
  portal_frozen_at: string | null;
  portal_frozen_by: string | null;
  portal_frozen_reason: string | null;
  max_active_devices: number;
  require_step_up_auth: boolean;
}

/**
 * Admin hook for managing portal security controls
 * Emergency controls for the Security Console
 */
export function usePortalSecurityAdmin() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all devices for a user
  const getUserDevices = useCallback(async (userId: string): Promise<PortalDevice[]> => {
    const { data, error } = await supabase
      .from('portal_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });

    if (error) throw error;
    return data as PortalDevice[];
  }, []);

  // Fetch all active sessions for a user
  const getUserSessions = useCallback(async (userId: string): Promise<PortalSession[]> => {
    const { data, error } = await supabase
      .from('portal_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('issued_at', { ascending: false });

    if (error) throw error;
    return data as PortalSession[];
  }, []);

  // Get user security state
  const getUserSecurityState = useCallback(async (userId: string): Promise<UserSecurityState | null> => {
    const { data, error } = await supabase
      .from('portal_user_security_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data as UserSecurityState | null;
  }, []);

  // Revoke a device
  const revokeDevice = useCallback(async (deviceId: string, reason?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('revoke_portal_device', {
        _device_id: deviceId,
        _reason: reason || null,
      });

      if (error) throw error;
      return data as boolean;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke device');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Force logout a user
  const forceLogout = useCallback(async (userId: string, reason?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('force_portal_logout', {
        _target_user_id: userId,
        _reason: reason || null,
      });

      if (error) throw error;
      return data as boolean;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to force logout');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Freeze portal access
  const freezePortalAccess = useCallback(async (userId: string, reason: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('freeze_portal_access', {
        _target_user_id: userId,
        _reason: reason,
      });

      if (error) throw error;
      return data as boolean;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to freeze portal access');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unfreeze portal access
  const unfreezePortalAccess = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('portal_user_security_state')
        .update({
          portal_frozen_at: null,
          portal_frozen_by: null,
          portal_frozen_reason: null,
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Log the unfreeze event
      await supabase.from('portal_security_events').insert({
        user_id: userId,
        event_type: 'portal_unfrozen',
        severity: 'info',
        event_message: 'Portal access restored by admin',
        metadata: { admin_id: user?.id },
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unfreeze portal access');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Trust a device
  const trustDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('portal_devices')
        .update({
          is_trusted: true,
          trusted_at: new Date().toISOString(),
          trusted_by: user?.id,
        })
        .eq('id', deviceId);

      if (error) throw error;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trust device');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isLoading,
    error,
    getUserDevices,
    getUserSessions,
    getUserSecurityState,
    revokeDevice,
    forceLogout,
    freezePortalAccess,
    unfreezePortalAccess,
    trustDevice,
  };
}
