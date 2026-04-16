import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  userEmail: string;
}

export const DevKillSwitch = ({ userEmail }: Props) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const channel = supabase
      .channel('kill-switch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_portal_config' }, fetchStatus)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from('developer_portal_config')
      .select('config_value')
      .eq('config_key', 'maintenance_mode')
      .single();
    if (data) {
      setEnabled((data.config_value as any)?.enabled === true);
    }
    setLoading(false);
  };

  const toggle = async () => {
    const newState = !enabled;
    const payload = {
      enabled: newState,
      message: 'System under maintenance. Please check back soon.',
      activated_by: userEmail,
      activated_at: newState ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from('developer_portal_config')
      .update({ config_value: payload as any, updated_by: userEmail })
      .eq('config_key', 'maintenance_mode');

    if (!error) {
      // Log action
      await supabase.from('developer_audit_log').insert({
        action: newState ? 'KILL_SWITCH_ON' : 'KILL_SWITCH_OFF',
        actor_email: userEmail,
        target_table: 'developer_portal_config',
        details: payload as any,
      });
      setEnabled(newState);
      toast[newState ? 'warning' : 'success'](
        newState ? '🔴 MAINTENANCE MODE ACTIVATED' : '🟢 System back online'
      );
    }
  };

  if (loading) return null;

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-4 py-1.5 rounded text-[10px] uppercase tracking-widest font-bold transition-all ${
        enabled
          ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_20px_rgba(255,0,0,0.15)] hover:bg-red-500/30 animate-pulse'
          : 'bg-[#1a1a2e] text-[#555] border border-[#2a2a3e] hover:text-[#00ff88] hover:border-[#00ff88]/30'
      }`}
    >
      {enabled ? (
        <>
          <ShieldOff className="w-3.5 h-3.5" />
          LOCKDOWN ACTIVE — CLICK TO DISABLE
        </>
      ) : (
        <>
          <Shield className="w-3.5 h-3.5" />
          EMERGENCY LOCKDOWN
        </>
      )}
    </button>
  );
};
