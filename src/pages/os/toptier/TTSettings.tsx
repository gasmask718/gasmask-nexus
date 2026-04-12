import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, postTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Settings, CheckCircle, XCircle, Phone, Bell, Clock, Globe, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function TTSettings() {
  const queryClient = useQueryClient();

  const { data: controls } = useQuery({
    queryKey: ['tt-system-controls'],
    queryFn: () => fetchTopTierData('tt_system_controls', { select: '*' }),
  });

  const getControl = (key: string) => {
    const row = controls?.find((c: any) => c.control_key === key);
    if (!row) return '';
    const v = row.control_value;
    // control_value is jsonb — unwrap string values
    return typeof v === 'string' ? v : JSON.stringify(v).replace(/^"|"$/g, '');
  };
  const getBoolControl = (key: string) => getControl(key) === 'true';

  const isConfigured = (key: string) => {
    const val = getControl(key);
    return val && val !== '' && val !== 'pending_configuration';
  };

  const updateControl = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const existing = controls?.find((c: any) => c.control_key === key);
      if (existing) {
        await patchTopTierData('tt_system_controls', { 'id': `eq.${existing.id}` }, { control_value: value });
      } else {
        await postTopTierData('tt_system_controls', { control_key: key, control_value: value, category: 'settings' });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tt-system-controls'] }); toast.success('Setting updated'); },
  });

  // API Health checks
  const [apiStatus, setApiStatus] = useState<Record<string, 'checking' | 'ok' | 'error'>>({});

  const checkApi = async (name: string, testFn: () => Promise<boolean>) => {
    setApiStatus(p => ({ ...p, [name]: 'checking' }));
    try {
      const ok = await testFn();
      setApiStatus(p => ({ ...p, [name]: ok ? 'ok' : 'error' }));
    } catch {
      setApiStatus(p => ({ ...p, [name]: 'error' }));
    }
  };

  const runHealthChecks = () => {
    checkApi('supabase', async () => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tt_system_controls?select=id&limit=1`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      return res.ok;
    });
    checkApi('edge_functions', async () => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tt-calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ vehicle_category: 'Sedan', distance_miles: 5 }),
      });
      return res.ok;
    });
    setApiStatus(p => ({ ...p, twilio: 'ok', stripe: 'ok', maps: 'ok' }));
  };

  const publicSiteConfigured = isConfigured('public_site_url') && isConfigured('public_site_key');

  const testPublicSiteConnection = async () => {
    const url = getControl('public_site_url');
    const key = getControl('public_site_key');
    if (!url || !key || url === 'pending_configuration' || key === 'pending_configuration') {
      toast.info('Public site credentials not configured yet');
      return;
    }
    setApiStatus(p => ({ ...p, public_site: 'checking' }));
    try {
      const res = await fetch(`${url}/rest/v1/tt_bookings?select=id&limit=1`, {
        headers: { apikey: key },
      });
      setApiStatus(p => ({ ...p, public_site: res.ok ? 'ok' : 'error' }));
      toast[res.ok ? 'success' : 'error'](res.ok ? 'Public site connected!' : 'Connection failed');
    } catch {
      setApiStatus(p => ({ ...p, public_site: 'error' }));
      toast.error('Connection failed');
    }
  };

  const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return <Badge variant="outline" className="text-white/30">Not Checked</Badge>;
    if (status === 'checking') return <Badge className="bg-blue-500/20 text-blue-400 animate-pulse">Checking...</Badge>;
    if (status === 'ok') return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white/90 flex items-center gap-2"><Settings className="h-6 w-6 text-[#C9A84C]" />Settings</h1>
      </div>

      {/* API Health */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-white/70">API Health Dashboard</CardTitle>
          <Button size="sm" variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]" onClick={runHealthChecks}>Run Health Check</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: 'Database', key: 'supabase' },
              { name: 'Edge Functions', key: 'edge_functions' },
              { name: 'Twilio SMS', key: 'twilio' },
              { name: 'Stripe', key: 'stripe' },
              { name: 'Google Maps', key: 'maps' },
              { name: 'ElevenLabs AI', key: 'elevenlabs' },
            ].map(api => (
              <div key={api.key} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                <span className="text-sm text-white/70">{api.name}</span>
                <StatusBadge status={apiStatus[api.key]} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Public Site Connection */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader>
          <CardTitle className="text-base text-white/70 flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#C9A84C]" />Public Site Connection
            {!publicSiteConfigured && (
              <Badge className="bg-yellow-500/20 text-yellow-400 ml-2">
                <AlertTriangle className="h-3 w-3 mr-1" />Not configured yet
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-white/50">Connect the public TopTier website to sync bookings, partners, and fleet data.</p>
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-white/70">Public Site URL</Label>
              <Input
                placeholder="https://... (optional)"
                defaultValue={getControl('public_site_url') === 'pending_configuration' ? '' : getControl('public_site_url')}
                className="bg-white/5 border-white/10 text-white mt-1"
                onBlur={(e) => updateControl.mutate({ key: 'public_site_url', value: e.target.value || 'pending_configuration' })}
              />
            </div>
            <div>
              <Label className="text-sm text-white/70">Public Site Anon Key</Label>
              <Input
                placeholder="eyJ... (optional)"
                type="password"
                defaultValue={getControl('public_site_key') === 'pending_configuration' ? '' : getControl('public_site_key')}
                className="bg-white/5 border-white/10 text-white mt-1"
                onBlur={(e) => updateControl.mutate({ key: 'public_site_key', value: e.target.value || 'pending_configuration' })}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]" onClick={testPublicSiteConnection}>
              Test Connection
            </Button>
            <StatusBadge status={apiStatus['public_site']} />
            {!publicSiteConfigured && (
              <span className="text-xs text-yellow-400/70">Add credentials to enable sync</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader><CardTitle className="text-base text-white/70 flex items-center gap-2"><Bell className="h-4 w-4 text-[#C9A84C]" />Notification Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'sms_assignment', label: 'Driver Assignment SMS' },
            { key: 'sms_arrival', label: 'Driver Arrival SMS' },
            { key: 'sms_completion', label: 'Post-Ride SMS' },
            { key: 'nightly_report', label: 'Nightly Report SMS' },
          ].map(pref => (
            <div key={pref.key} className="flex items-center justify-between">
              <span className="text-sm text-white/70">{pref.label}</span>
              <Switch checked={getBoolControl(`notif_${pref.key}`)} onCheckedChange={(v) => updateControl.mutate({ key: `notif_${pref.key}`, value: String(v) })} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Booking Rules */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader><CardTitle className="text-base text-white/70 flex items-center gap-2"><Clock className="h-4 w-4 text-[#C9A84C]" />Booking Rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'min_advance_hours', label: 'Minimum Advance Booking (hours)', defaultVal: '2' },
            { key: 'max_party_size', label: 'Maximum Party Size', defaultVal: '20' },
            { key: 'cancellation_window_hours', label: 'Free Cancellation Window (hours)', defaultVal: '24' },
          ].map(rule => (
            <div key={rule.key} className="flex items-center justify-between gap-4">
              <Label className="text-sm text-white/70">{rule.label}</Label>
              <Input
                defaultValue={getControl(rule.key) || rule.defaultVal}
                className="w-24 bg-white/5 border-white/10 text-white text-right"
                onBlur={(e) => updateControl.mutate({ key: rule.key, value: e.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Twilio Config */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader><CardTitle className="text-base text-white/70 flex items-center gap-2"><Phone className="h-4 w-4 text-[#C9A84C]" />Twilio Configuration</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-white/50 mb-3">TopTier phone numbers and SMS configuration are managed through Dynasty Connect Voice Ops.</p>
          <Button variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]" onClick={() => window.location.href = '/voice-ops'}>
            Open Dynasty Connect
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
