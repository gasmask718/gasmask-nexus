import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  storeId: string;
  relationshipStatus: string | null;
}

const DEFAULTS: Record<string, number | null> = {
  'Active (Good)': 14,
  'Follow-up (secure relationship)': 7,
  'Need promo (bring samples)': 10,
  'Selling slow': 21,
  'Non-active (New - need to speak)': 30,
  'Not interested': null,
  'Not interested - sold in past': null,
  'No tobacco': null,
  'Closed permanently': null,
};

export function StoreCadenceOverrideCard({ storeId, relationshipStatus }: Props) {
  const qc = useQueryClient();
  const fallback = DEFAULTS[relationshipStatus || ''] ?? 30;

  const { data: policy, isLoading } = useQuery({
    queryKey: ['store-cadence-policy', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_cadence_policy')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data as any;
    },
  });

  const [days, setDays] = useState<number | ''>('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (policy) {
      setDays(policy.cadence_days ?? '');
      setEnabled(policy.enabled ?? true);
    }
  }, [policy]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        store_id: storeId,
        cadence_days: days === '' ? null : Number(days),
        enabled,
        updated_at: new Date().toISOString(),
      };
      if (policy?.id) {
        const { error } = await (supabase as any).from('store_cadence_policy').update(payload).eq('id', policy.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('store_cadence_policy').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Cadence saved');
      qc.invalidateQueries({ queryKey: ['store-cadence-policy', storeId] });
    },
    onError: (e: any) => toast.error(e.message || 'Save failed'),
  });

  const effective = days !== '' ? Number(days) : fallback;
  const isOverride = days !== '' && Number(days) !== fallback;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-primary" />
          Visit Cadence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Default for "{relationshipStatus || 'no status'}"</span>
              <Badge variant="outline">
                {fallback === null ? 'skip' : `${fallback}d`}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cadence-enabled">Cadence active</Label>
              <Switch id="cadence-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div>
              <Label htmlFor="cadence-days" className="text-xs text-muted-foreground">
                Override (blank = use default)
              </Label>
              <Input
                id="cadence-days"
                type="number"
                min={1}
                max={365}
                placeholder={`${fallback ?? 'skip'}`}
                value={days}
                onChange={(e) => setDays(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div className="text-sm flex justify-between border-t pt-3">
              <span className="text-muted-foreground">Effective</span>
              <span className="font-medium">
                Every {effective}d {isOverride && <Badge variant="secondary" className="ml-1 text-[10px]">override</Badge>}
              </span>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full" size="sm">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save cadence'}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              The nightly cron promotes this store into the route follow-up queue when this many days have
              passed since the last visit.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
