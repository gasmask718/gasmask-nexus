import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Rocket, Target, Shield, Settings, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type WizardStep = 'basics' | 'audience' | 'compliance' | 'launch';

export default function CampaignBuilderPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('basics');

  const [form, setForm] = useState({
    name: '',
    description: '',
    campaignWeight: '1.0',
    // Audience
    storeFilter: 'all',
    region: '',
    maxTargets: '500',
    // Compliance
    maxAttempts: '3',
    retryDelayMinutes: '60',
    respectQuietHours: true,
    respectDnc: true,
  });

  const steps: { key: WizardStep; label: string; icon: typeof Target }[] = [
    { key: 'basics', label: 'Basics', icon: Settings },
    { key: 'audience', label: 'Audience', icon: Target },
    { key: 'compliance', label: 'Compliance', icon: Shield },
    { key: 'launch', label: 'Launch', icon: Rocket },
  ];

  const currentStepIdx = steps.findIndex(s => s.key === step);
  const canProceed = step === 'basics' ? form.name.trim().length > 0 : true;

  // Count available stores for preview
  const { data: storeCount } = useQuery({
    queryKey: ['store-count-preview', currentBusiness?.id, form.storeFilter, form.region],
    queryFn: async () => {
      let q = supabase
        .from('store_master')
        .select('id', { count: 'exact', head: true })
        .eq('do_not_call', false) as any;

      if (currentBusiness?.id) {
        q = q.eq('business_id', currentBusiness.id);
      }
      if (form.region) {
        q = q.ilike('state', `%${form.region}%`);
      }
      const { count } = await q;
      return count || 0;
    },
    enabled: !!currentBusiness?.id && step === 'audience',
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!currentBusiness?.id) throw new Error('No business selected');

      // 1. Create campaign
      const { data: campaign, error } = await supabase
        .from('dialer_campaigns')
        .insert({
          business_id: currentBusiness.id,
          name: form.name,
          description: form.description || null,
          status: 'active',
          campaign_weight: parseFloat(form.campaignWeight) || 1.0,
        })
        .select('id')
        .single();

      if (error) throw error;

      // 2. Seed queue from stores
      let storeQuery = supabase
        .from('store_master')
        .select('id, store_name, owner_name, phone, brand_id')
        .eq('do_not_call', false)
        .not('phone', 'is', null)
        .limit(parseInt(form.maxTargets) || 500);

      if (form.region) {
        storeQuery = storeQuery.ilike('state', `%${form.region}%`);
      }

      const { data: stores } = await storeQuery;

      if (stores && stores.length > 0) {
        const queueItems = stores.map((store, idx) => ({
          store_id: store.id,
          contact_name: store.store_name || store.owner_name || 'Unknown',
          phone_number: store.phone!,
          business_id: currentBusiness.id,
          campaign_id: campaign.id,
          priority_score: 50 + Math.floor(Math.random() * 30),
          status: 'queued',
        }));

        // Batch insert
        const batchSize = 100;
        for (let i = 0; i < queueItems.length; i += batchSize) {
          const batch = queueItems.slice(i, i + batchSize);
          await supabase.from('outbound_call_queue').insert(batch);
        }

        // Update campaign totals
        await supabase.from('dialer_campaigns').update({
          total_targets: stores.length,
        }).eq('id', campaign.id);
      }

      return { campaignId: campaign.id, targetCount: stores?.length || 0 };
    },
    onSuccess: (data) => {
      toast.success(`🚀 Campaign launched! ${data.targetCount} targets queued`);
      queryClient.invalidateQueries({ queryKey: ['console-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['console-queue'] });
      navigate('/communication/dialer-console');
    },
    onError: (err: any) => toast.error(`Launch failed: ${err.message}`),
  });

  return (
    <div className="w-full min-h-full max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Rocket className="h-5 w-5" /> Campaign Builder
      </h2>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                step === s.key ? 'bg-primary text-primary-foreground' : i < currentStepIdx ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < currentStepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
              {s.label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6 space-y-5">
          {step === 'basics' && (
            <>
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input placeholder="e.g. Q1 Reorder Outreach" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Campaign goal..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Priority Weight</Label>
                <Input type="number" step="0.1" value={form.campaignWeight} onChange={e => setForm(f => ({ ...f, campaignWeight: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Higher weight = more slots allocated by engine</p>
              </div>
            </>
          )}

          {step === 'audience' && (
            <>
              <div className="space-y-2">
                <Label>Store Filter</Label>
                <Select value={form.storeFilter} onValueChange={v => setForm(f => ({ ...f, storeFilter: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive / Lapsed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Region Filter (state)</Label>
                <Input placeholder="e.g. NY, NJ" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Max Targets</Label>
                <Input type="number" value={form.maxTargets} onChange={e => setForm(f => ({ ...f, maxTargets: e.target.value }))} />
              </div>
              {storeCount !== undefined && (
                <Badge variant="outline" className="text-sm">
                  <Target className="h-3.5 w-3.5 mr-1" /> ~{storeCount} stores match
                </Badge>
              )}
            </>
          )}

          {step === 'compliance' && (
            <>
              <div className="space-y-2">
                <Label>Max Attempts Per Contact</Label>
                <Input type="number" value={form.maxAttempts} onChange={e => setForm(f => ({ ...f, maxAttempts: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Retry Delay (minutes)</Label>
                <Input type="number" value={form.retryDelayMinutes} onChange={e => setForm(f => ({ ...f, retryDelayMinutes: e.target.value }))} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Respect Quiet Hours</Label>
                <Switch checked={form.respectQuietHours} onCheckedChange={c => setForm(f => ({ ...f, respectQuietHours: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enforce DNC Registry</Label>
                <Switch checked={form.respectDnc} onCheckedChange={c => setForm(f => ({ ...f, respectDnc: c }))} />
              </div>
            </>
          )}

          {step === 'launch' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Review & Launch</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> {form.name}</div>
                <div><span className="text-muted-foreground">Weight:</span> {form.campaignWeight}</div>
                <div><span className="text-muted-foreground">Max Targets:</span> {form.maxTargets}</div>
                <div><span className="text-muted-foreground">Max Attempts:</span> {form.maxAttempts}</div>
                <div><span className="text-muted-foreground">Region:</span> {form.region || 'All'}</div>
                <div><span className="text-muted-foreground">Quiet Hours:</span> {form.respectQuietHours ? '✅' : '❌'}</div>
              </div>
              <Separator />
              <Button
                onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending}
                className="w-full gap-2"
                size="lg"
              >
                <Rocket className="h-5 w-5" />
                {launchMutation.isPending ? 'Launching...' : 'Launch Campaign'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nav Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentStepIdx === 0}
          onClick={() => setStep(steps[currentStepIdx - 1].key)}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step !== 'launch' && (
          <Button
            disabled={!canProceed}
            onClick={() => setStep(steps[currentStepIdx + 1].key)}
            className="gap-2"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
