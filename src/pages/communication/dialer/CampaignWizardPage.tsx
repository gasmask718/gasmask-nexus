import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Target, Users, Settings, FileText, Rocket,
  ChevronRight, ChevronLeft, CheckCircle2
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { VoiceProviderSelector } from '@/components/communication/VoiceProviderSelector';

const STEPS = [
  { label: 'Campaign Info', icon: Target },
  { label: 'Audience', icon: Users },
  { label: 'Dialing Rules', icon: Settings },
  { label: 'Script & Dispositions', icon: FileText },
  { label: 'Launch', icon: Rocket },
];

export default function CampaignWizardPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const bizId = currentBusiness?.id;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    description: '',
    mode: 'mixed',
    max_attempts: 3,
    retry_backoff_minutes: 30,
    amd_enabled: true,
    call_window_start: '09:00',
    call_window_end: '17:00',
    max_concurrent: 5,
    talk_track: '',
    state_filter: 'all',
    callable_only: true,
    voice_provider: 'auto',
    voice_mode: 'balanced',
  });

  // Fetch audience count
  const { data: audienceCount = 0 } = useQuery({
    queryKey: ['audience-count', bizId, form.mode, form.state_filter, form.callable_only],
    queryFn: async () => {
      let query = supabase.from('v_callable_entities' as any).select('entity_id', { count: 'exact', head: true });

      if (form.mode === 'stores') query = query.eq('entity_type', 'store');
      if (form.mode === 'prospects') query = query.eq('entity_type', 'prospect');
      if (form.callable_only) query = query.eq('callable_now', true);
      if (form.state_filter !== 'all') query = query.eq('state', form.state_filter);

      const { count } = await query;
      return count || 0;
    },
    enabled: !!bizId,
  });

  // Launch campaign mutation
  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!bizId) throw new Error('No business');

      // Create campaign
      const { data: campaign, error: campErr } = await supabase
        .from('dialer_campaigns')
        .insert({
          business_id: bizId,
          name: form.name,
          description: form.description || null,
          status: 'active',
          max_attempts: form.max_attempts,
          amd_enabled: form.amd_enabled,
          max_concurrent_calls: form.max_concurrent,
        } as any)
        .select('id')
        .single();
      if (campErr) throw campErr;

      // Seed queue from audience
      let query = supabase
        .from('v_callable_entities' as any)
        .select('entity_type, entity_id, display_name, phone_e164')
        .eq('callable_now', true);

      if (form.mode === 'stores') query = query.eq('entity_type', 'store');
      if (form.mode === 'prospects') query = query.eq('entity_type', 'prospect');
      if (form.state_filter !== 'all') query = query.eq('state', form.state_filter);

      const { data: audience } = await query.limit(500);
      if (!audience?.length) throw new Error('No callable entities found');

      const items = (audience as any[]).map((e: any, i: number) => ({
        business_id: bizId,
        phone_number: e.phone_e164,
        contact_name: e.display_name,
        store_id: e.entity_type === 'store' ? e.entity_id : null,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        source_reason: e.entity_type === 'store' ? 'active_store' : 'prospect',
        campaign_id: campaign.id,
        priority_score: Math.max(1, 100 - i),
        status: 'queued',
      }));

      const batchSize = 50;
      for (let i = 0; i < items.length; i += batchSize) {
        await supabase.from('outbound_call_queue').insert(items.slice(i, i + batchSize) as any);
      }

      return { campaignId: campaign.id, seeded: items.length };
    },
    onSuccess: (data) => {
      toast.success(`Campaign launched! ${data.seeded} contacts seeded to queue.`);
      queryClient.invalidateQueries({ queryKey: ['outbound-call-queue'] });
      navigate('/communication/dialer-console');
    },
    onError: (err: any) => toast.error(`Launch failed: ${err.message}`),
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="w-full min-h-full max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6" /> Campaign Wizard
        </h2>
        <p className="text-sm text-muted-foreground">Create a dialer campaign, select your audience, and launch.</p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                i === step ? 'text-primary' : i < step ? 'text-green-600' : 'text-muted-foreground'
              }`}
            >
              {i < step ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <s.icon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Q1 Store Reorders" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Outreach for..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={v => update('mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stores">Active Stores Only</SelectItem>
                    <SelectItem value="prospects">Prospects Only</SelectItem>
                    <SelectItem value="mixed">Mixed (Both)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="p-4 border rounded-lg bg-muted/30 text-center">
                <p className="text-3xl font-bold text-primary">{audienceCount}</p>
                <p className="text-sm text-muted-foreground">Estimated callable entities</p>
              </div>
              <div className="space-y-2">
                <Label>State Filter</Label>
                <Select value={form.state_filter} onValueChange={v => update('state_filter', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="NY">New York</SelectItem>
                    <SelectItem value="NJ">New Jersey</SelectItem>
                    <SelectItem value="CT">Connecticut</SelectItem>
                    <SelectItem value="PA">Pennsylvania</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.callable_only} onCheckedChange={v => update('callable_only', v)} />
                <Label className="text-sm">Callable only (has phone + not DNC)</Label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input type="number" value={form.max_attempts} onChange={e => update('max_attempts', parseInt(e.target.value) || 1)} />
                </div>
                <div className="space-y-2">
                  <Label>Retry Backoff (min)</Label>
                  <Input type="number" value={form.retry_backoff_minutes} onChange={e => update('retry_backoff_minutes', parseInt(e.target.value) || 15)} />
                </div>
                <div className="space-y-2">
                  <Label>Call Window Start</Label>
                  <Input type="time" value={form.call_window_start} onChange={e => update('call_window_start', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Call Window End</Label>
                  <Input type="time" value={form.call_window_end} onChange={e => update('call_window_end', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Max Concurrent Calls</Label>
                <Input type="number" value={form.max_concurrent} onChange={e => update('max_concurrent', parseInt(e.target.value) || 1)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.amd_enabled} onCheckedChange={v => update('amd_enabled', v)} />
                <Label className="text-sm">AMD (Answering Machine Detection)</Label>
              </div>
              <div className="p-3 border rounded-lg">
                <VoiceProviderSelector
                  provider={form.voice_provider}
                  onProviderChange={v => update('voice_provider', v)}
                  mode={form.voice_mode}
                  onModeChange={v => update('voice_mode', v)}
                  label="Voice Engine for Campaign"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Talk Track / Script (optional)</Label>
                <Textarea value={form.talk_track} onChange={e => update('talk_track', e.target.value)} rows={5} placeholder="Hi, this is [agent] from [company]..." />
              </div>
              <p className="text-xs text-muted-foreground">
                Dispositions will be available during the call in the Console. Configure disposition codes in Dialer Settings.
              </p>
            </>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Launch Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Campaign</p>
                  <p className="font-medium">{form.name || '(unnamed)'}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Mode</p>
                  <p className="font-medium capitalize">{form.mode}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Audience</p>
                  <p className="font-medium">{audienceCount} entities</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Concurrency</p>
                  <p className="font-medium">{form.max_concurrent} calls</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">AMD</p>
                  <p className="font-medium">{form.amd_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Max Attempts</p>
                  <p className="font-medium">{form.max_attempts}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => {
              if (step === 0 && !form.name.trim()) {
                toast.error('Campaign name is required');
                return;
              }
              setStep(s => s + 1);
            }}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => launchMutation.mutate()}
            disabled={launchMutation.isPending || !form.name.trim() || audienceCount === 0}
            className="gap-1 bg-green-600 hover:bg-green-700"
          >
            <Rocket className="h-4 w-4" />
            {launchMutation.isPending ? 'Launching...' : `Launch Campaign (${audienceCount})`}
          </Button>
        )}
      </div>
    </div>
  );
}
