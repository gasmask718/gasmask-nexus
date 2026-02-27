import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, Shield, Clock, Phone, Bot, Target } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VoiceProviderSelector } from '@/components/communication/VoiceProviderSelector';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

interface DialerSettingsData {
  default_voice_provider: string;
  default_voice_mode: string;
  amd_sensitivity: string;
  predictive_multiplier: number;
  max_concurrent_dials: number;
  max_attempts_per_day: number;
  retry_delay_minutes: number;
  ai_voicemail_script: string;
  ai_prescreen_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_timezone: string;
  after_hours_behavior: string;
  enable_test_mode: boolean;
  target_mode_enabled: boolean;
  target_profit_7d: number | null;
}

const defaults: DialerSettingsData = {
  default_voice_provider: 'auto',
  default_voice_mode: 'balanced',
  amd_sensitivity: 'medium',
  predictive_multiplier: 5,
  max_concurrent_dials: 10,
  max_attempts_per_day: 3,
  retry_delay_minutes: 30,
  ai_voicemail_script: '',
  ai_prescreen_enabled: false,
  business_hours_start: '09:00',
  business_hours_end: '18:00',
  business_timezone: 'America/New_York',
  after_hours_behavior: 'stop',
  enable_test_mode: true,
  target_mode_enabled: false,
  target_profit_7d: null,
};

export default function DialerSettingsPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DialerSettingsData>(defaults);

  const { data: existing } = useQuery({
    queryKey: ['dialer-settings', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_settings')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        default_voice_provider: existing.default_voice_provider || defaults.default_voice_provider,
        default_voice_mode: (existing as any).default_voice_mode || defaults.default_voice_mode,
        amd_sensitivity: existing.amd_sensitivity || defaults.amd_sensitivity,
        predictive_multiplier: Number(existing.predictive_multiplier) || defaults.predictive_multiplier,
        max_concurrent_dials: existing.max_concurrent_dials || defaults.max_concurrent_dials,
        max_attempts_per_day: existing.max_attempts_per_day || defaults.max_attempts_per_day,
        retry_delay_minutes: existing.retry_delay_minutes || defaults.retry_delay_minutes,
        ai_voicemail_script: existing.ai_voicemail_script || '',
        ai_prescreen_enabled: existing.ai_prescreen_enabled || false,
        business_hours_start: existing.business_hours_start || defaults.business_hours_start,
        business_hours_end: existing.business_hours_end || defaults.business_hours_end,
        business_timezone: existing.business_timezone || defaults.business_timezone,
        after_hours_behavior: existing.after_hours_behavior || defaults.after_hours_behavior,
        enable_test_mode: existing.enable_test_mode ?? true,
        target_mode_enabled: (existing as any).target_mode_enabled ?? false,
        target_profit_7d: (existing as any).target_profit_7d ?? null,
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentBusiness?.id) throw new Error('No business selected');
      const payload = {
        ...form,
        business_id: currentBusiness.id,
        updated_at: new Date().toISOString(),
        target_profit_7d: form.target_profit_7d || null,
      };
      
      if (existing) {
        const { error } = await supabase
          .from('dialer_settings')
          .update(payload as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dialer_settings')
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Dialer settings saved');
      queryClient.invalidateQueries({ queryKey: ['dialer-settings'] });
      queryClient.invalidateQueries({ queryKey: ['dialer-settings-integrity'] });
    },
    onError: (e: any) => toast.error(`Failed to save: ${e.message}`),
  });

  const update = (key: keyof DialerSettingsData, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" /> Dialer Settings
          </h2>
          <p className="text-muted-foreground">Configure predictive dialer behavior</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" /> Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dialer Engine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Dialer Engine</CardTitle>
            <CardDescription>Core dialing parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <VoiceProviderSelector
              provider={form.default_voice_provider}
              onProviderChange={v => update('default_voice_provider', v)}
              mode={form.default_voice_mode}
              onModeChange={v => update('default_voice_mode', v)}
              label="Default Voice Provider"
            />
            <div className="space-y-2">
              <Label>AMD Sensitivity</Label>
              <Select value={form.amd_sensitivity} onValueChange={v => update('amd_sensitivity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (fewer false positives)</SelectItem>
                  <SelectItem value="medium">Medium (balanced)</SelectItem>
                  <SelectItem value="high">High (aggressive detection)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Predictive Multiplier</Label>
                <Input type="number" step="0.5" min="1" max="20" value={form.predictive_multiplier} onChange={e => update('predictive_multiplier', Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Calls per agent (÷ answer rate)</p>
              </div>
              <div className="space-y-2">
                <Label>Max Concurrent Dials</Label>
                <Input type="number" min="1" max="50" value={form.max_concurrent_dials} onChange={e => update('max_concurrent_dials', Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Attempts/Day</Label>
                <Input type="number" min="1" max="10" value={form.max_attempts_per_day} onChange={e => update('max_attempts_per_day', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Retry Delay (min)</Label>
                <Input type="number" min="5" max="180" value={form.retry_delay_minutes} onChange={e => update('retry_delay_minutes', Number(e.target.value))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Business Hours</CardTitle>
            <CardDescription>When the dialer is allowed to call</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.business_hours_start} onChange={e => update('business_hours_start', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.business_hours_end} onChange={e => update('business_hours_end', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={form.business_timezone} onValueChange={v => update('business_timezone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern (NYC/NJ)</SelectItem>
                  <SelectItem value="America/Chicago">Central</SelectItem>
                  <SelectItem value="America/Denver">Mountain</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>After-Hours Behavior</Label>
              <Select value={form.after_hours_behavior} onValueChange={v => update('after_hours_behavior', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stop">Stop dialing</SelectItem>
                  <SelectItem value="voicemail_only">Voicemail drops only</SelectItem>
                  <SelectItem value="queue_for_tomorrow">Queue for tomorrow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Target Mode */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Target-Driven Profit Mode</CardTitle>
            <CardDescription>Set a 7-day profit target and let the engine steer toward it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Enable Target Mode</Label>
                <p className="text-xs text-muted-foreground">Engine will accelerate or stabilize to hit your target</p>
              </div>
              <Switch checked={form.target_mode_enabled} onCheckedChange={v => update('target_mode_enabled', v)} />
            </div>
            {form.target_mode_enabled && (
              <div className="space-y-2">
                <Label>7-Day Profit Target ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 5000"
                  value={form.target_profit_7d ?? ''}
                  onChange={e => update('target_profit_7d', e.target.value ? Number(e.target.value) : null)}
                />
                <p className="text-xs text-muted-foreground">
                  The engine will compare projected profit against this target each cycle and adjust intensity accordingly.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> AI Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>AI Pre-Screen (Gatekeeper)</Label>
                <p className="text-xs text-muted-foreground">AI asks "Are you the owner?" before bridging</p>
              </div>
              <Switch checked={form.ai_prescreen_enabled} onCheckedChange={v => update('ai_prescreen_enabled', v)} />
            </div>
            <div className="space-y-2">
              <Label>AI Voicemail Script</Label>
              <Textarea
                placeholder="Hi, this is calling regarding your store inventory..."
                value={form.ai_voicemail_script}
                onChange={e => update('ai_voicemail_script', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Safety */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Safety Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Test Mode</Label>
                <p className="text-xs text-muted-foreground">Simulates calls without making real provider calls</p>
              </div>
              <Switch checked={form.enable_test_mode} onCheckedChange={v => update('enable_test_mode', v)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
