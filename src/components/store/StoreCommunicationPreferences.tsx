import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, MessageSquare, Phone, Mail, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  storeId: string;
}

type Prefs = {
  sms_opt_in: boolean;
  call_opt_in: boolean;
  email_opt_in: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  preferred_channel: string | null;
  notes: string | null;
};

const DEFAULTS: Prefs = {
  sms_opt_in: true,
  call_opt_in: true,
  email_opt_in: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: 'America/New_York',
  preferred_channel: null,
  notes: null,
};

export function StoreCommunicationPreferences({ storeId }: Props) {
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['store-comm-prefs', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_communication_preferences')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setPrefs({
        sms_opt_in: data.sms_opt_in,
        call_opt_in: data.call_opt_in,
        email_opt_in: data.email_opt_in,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
        timezone: data.timezone ?? 'America/New_York',
        preferred_channel: data.preferred_channel,
        notes: data.notes,
      });
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { store_id: storeId, ...prefs };
      const { error } = await supabase
        .from('store_communication_preferences')
        .upsert(payload, { onConflict: 'store_id' });
      if (error) throw error;
      toast.success('Communication preferences saved');
      qc.invalidateQueries({ queryKey: ['store-comm-prefs', storeId] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Communication Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChannelToggle
            icon={<MessageSquare className="h-4 w-4" />}
            label="SMS opt-in"
            checked={prefs.sms_opt_in}
            onChange={(v) => setPrefs((p) => ({ ...p, sms_opt_in: v }))}
          />
          <ChannelToggle
            icon={<Phone className="h-4 w-4" />}
            label="Phone calls opt-in"
            checked={prefs.call_opt_in}
            onChange={(v) => setPrefs((p) => ({ ...p, call_opt_in: v }))}
          />
          <ChannelToggle
            icon={<Mail className="h-4 w-4" />}
            label="Email opt-in"
            checked={prefs.email_opt_in}
            onChange={(v) => setPrefs((p) => ({ ...p, email_opt_in: v }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Quiet hours start
            </Label>
            <Input
              type="time"
              value={prefs.quiet_hours_start ?? ''}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, quiet_hours_start: e.target.value || null }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Quiet hours end
            </Label>
            <Input
              type="time"
              value={prefs.quiet_hours_end ?? ''}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, quiet_hours_end: e.target.value || null }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Timezone</Label>
            <Input
              value={prefs.timezone}
              onChange={(e) => setPrefs((p) => ({ ...p, timezone: e.target.value }))}
              placeholder="America/New_York"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Preferred channel</Label>
            <Select
              value={prefs.preferred_channel ?? 'none'}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, preferred_channel: v === 'none' ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="none">No preference</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="call">Phone call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={2}
              value={prefs.notes ?? ''}
              onChange={(e) => setPrefs((p) => ({ ...p, notes: e.target.value || null }))}
              placeholder="e.g. Owner prefers Spanish, only contact after 10am."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelToggle({
  icon, label, checked, onChange,
}: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 p-3">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
