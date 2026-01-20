import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DeviceInfo {
  id: string;
  user_id: string;
  portal_type: 'driver' | 'biker';
  device_name: string | null;
  device_fingerprint: string | null;
  platform: string | null;
  browser: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_trusted: boolean;
  is_revoked: boolean;
}

/**
 * Hook for managing portal device registration and trust
 * Implements device binding for Phase 2 security hardening
 */
export function usePortalDevice(portalType: 'driver' | 'biker') {
  const { user } = useAuth();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate a simple device fingerprint (signal only, not relied upon)
  const generateFingerprint = useCallback(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
    
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      renderer,
    ];
    
    // Simple hash
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }, []);

  // Get platform info
  const getPlatformInfo = useCallback(() => {
    const ua = navigator.userAgent;
    let platform = 'web';
    let browser = 'unknown';
    
    if (/iPhone|iPad|iPod/.test(ua)) platform = 'ios';
    else if (/Android/.test(ua)) platform = 'android';
    
    if (/Chrome/.test(ua)) browser = 'chrome';
    else if (/Safari/.test(ua)) browser = 'safari';
    else if (/Firefox/.test(ua)) browser = 'firefox';
    else if (/Edge/.test(ua)) browser = 'edge';
    
    return { platform, browser };
  }, []);

  // Register or update device
  const registerDevice = useCallback(async () => {
    if (!user) return null;
    
    try {
      const fingerprint = generateFingerprint();
      const { platform, browser } = getPlatformInfo();
      
      // Check if device already exists
      const { data: existing } = await supabase
        .from('portal_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();
      
      if (existing) {
        // Update last seen
        const { data: updated, error: updateError } = await supabase
          .from('portal_devices')
          .update({
            last_seen_at: new Date().toISOString(),
            portal_type: portalType,
          })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        return updated as DeviceInfo;
      }
      
      // Register new device
      const { data: newDevice, error: insertError } = await supabase
        .from('portal_devices')
        .insert({
          user_id: user.id,
          portal_type: portalType,
          device_fingerprint: fingerprint,
          device_name: `${platform} - ${browser}`,
          platform,
          browser,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Log new device event
      await supabase.from('portal_security_events').insert({
        user_id: user.id,
        device_id: newDevice.id,
        portal_type: portalType,
        event_type: 'new_device',
        severity: 'info',
        event_message: 'New device registered',
        metadata: { platform, browser, fingerprint },
      });
      
      return newDevice as DeviceInfo;
    } catch (err) {
      console.error('Device registration failed:', err);
      throw err;
    }
  }, [user, portalType, generateFingerprint, getPlatformInfo]);

  // Check if device is valid (not revoked)
  const validateDevice = useCallback(async (): Promise<boolean> => {
    if (!device) return false;
    
    const { data } = await supabase
      .from('portal_devices')
      .select('is_revoked')
      .eq('id', device.id)
      .single();
    
    return data ? !data.is_revoked : false;
  }, [device]);

  // Initialize device on mount
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (!user) {
        setDevice(null);
        setIsLoading(false);
        return;
      }
      
      try {
        const registeredDevice = await registerDevice();
        if (mounted) {
          setDevice(registeredDevice);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Device registration failed');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    init();
    
    return () => { mounted = false; };
  }, [user, registerDevice]);

  return {
    device,
    isLoading,
    error,
    validateDevice,
    registerDevice,
  };
}
