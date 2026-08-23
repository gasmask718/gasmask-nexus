/**
 * OutreachSwitchboard — the owner/admin control panel for every automation
 * that can reach a customer.
 *
 * Owner's rule (2026-08-23): nothing reaches a customer unless a human
 * flipped a switch. Each row in `outreach_switches` maps to a scheduled
 * job whose edge function calls outreach_allowed(<key>) FIRST and exits
 * when the switch is off. The crons tick harmlessly against closed
 * switches; the gate in the function is the real protection.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OctagonX, PhoneCall, MessageSquare, Shuffle, Clock, Users, AlertTriangle, Timer } from 'lucide-react';
import { toast } from 'sonner';

interface OutreachSwitch {
  key: string;
  label: string;
  what_it_does: string | null;
  channel: string;
  reaches: string | null;
  cron_jobid: number | null;
  cron_schedule: string | null;
  enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  auto_disable_at: string | null;
  last_run_at: string | null;
  last_run_sent: number | null;
  notes: string | null;
}

const DURATION_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: '24 hours', hours: 24 },
  { label: 'Until I turn it off', hours: null },
];

function groupOf(channel: string): 'voice' | 'sms' | 'other' {
  const c = (channel || '').toLowerCase();
  if (c.includes('voice')) return 'voice';
  if (c.includes('sms')) return 'sms';
  return 'other';
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function OutreachSwitchboard() {
  const qc = useQueryClient();
  const [pendingOn, setPendingOn] = useState<OutreachSwitch | null>(null);
  const [confirmStopAll, setConfirmStopAll] = useState(false);

  const { data: switches, isLoading } = useQuery({
    queryKey: ['outreach-switches'],
    refetchInterval: 30_000,
    queryFn: async (): Promise<OutreachSwitch[]> => {
      const { data, error } = await (supabase as any)
        .from('outreach_switches')
        .select('key, label, what_it_does, channel, reaches, cron_jobid, cron_schedule, enabled, enabled_at, enabled_by, auto_disable_at, last_run_at, last_run_sent, notes')
        .order('channel')
        .order('key');
      if (error) throw error;
      return (data || []) as OutreachSwitch[];
    },
  });

  const setSwitch = useMutation({
    mutationFn: async ({ key, on, hours }: { key: string; on: boolean; hours: number | null }) => {
      const { error } = await (supabase as any).rpc('set_outreach', { p_key: key, p_on: on, p_hours: hours });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.on ? `Outreach ON: ${v.key}` : `Outreach OFF: ${v.key}`);
      qc.invalidateQueries({ queryKey: ['outreach-switches'] });
    },
    onError: (e: any) => toast.error(`Switch failed: ${e?.message || e}`),
  });

  const stopAll = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc('stop_all_outreach');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ALL outreach stopped.');
      qc.invalidateQueries({ queryKey: ['outreach-switches'] });
    },
    onError: (e: any) => toast.error(`Stop-all failed: ${e?.message || e}`),
  });

  const voice = (switches || []).filter((s) => groupOf(s.channel) === 'voice');
  const sms = (switches || []).filter((s) => groupOf(s.channel) === 'sms');
  const other = (switches || []).filter((s) => groupOf(s.channel) === 'other');
  const liveCount = (switches || []).filter((s) => s.enabled).length;

  const renderCard = (s: OutreachSwitch, highRisk: boolean) => (
    <Card
      key={s.key}
      className={s.enabled
        ? 'border-destructive/60 bg-destructive/10'
        : 'border-border bg-card'}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {s.label}
              {s.enabled && (
                <Badge variant="destructive" className="uppercase tracking-wide">LIVE</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">{s.what_it_does || '—'}</CardDescription>
          </div>
          <Switch
            checked={s.enabled}
            disabled={setSwitch.isPending || stopAll.isPending}
            onCheckedChange={(on) => {
              if (on) setPendingOn(s);
              else setSwitch.mutate({ key: s.key, on: false, hours: null });
            }}
            aria-label={`Toggle ${s.label}`}
          />
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-1.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Reaches: {s.reaches || '—'}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Schedule: {s.cron_schedule || '—'}</span>
          <span className="inline-flex items-center gap-1">Channel: {s.channel}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>Last ran: {fmt(s.last_run_at)}{s.last_run_sent != null ? ` · sent ${s.last_run_sent}` : ''}</span>
        </div>
        {s.enabled && (
          <div className="flex items-center gap-1.5 text-destructive font-medium pt-1">
            <Timer className="h-3.5 w-3.5" />
            {s.auto_disable_at
              ? `Turns off automatically at ${fmt(s.auto_disable_at)}`
              : 'Stays on until you turn it off'}
          </div>
        )}
        {s.notes && <div className="italic opacity-80">{s.notes}</div>}
        {highRisk && !s.enabled && (
          <div className="flex items-center gap-1.5 text-amber-500/90 pt-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Highest risk: dials people with an AI voice. Arm only while someone is watching it.
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Outreach Switchboard</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Every automation that can call or text a customer runs only while its switch is ON.
            Turning one on asks for a time window — bounded by default. All switches are OFF unless
            someone armed them here.
          </p>
        </div>
        <Button
          variant="destructive"
          size="lg"
          className="font-bold"
          onClick={() => setConfirmStopAll(true)}
          disabled={stopAll.isPending}
        >
          <OctagonX className="h-5 w-5 mr-2" />
          STOP ALL OUTREACH
        </Button>
      </div>

      {liveCount > 0 && (
        <div className="rounded-lg border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm font-medium">
          {liveCount} switch{liveCount === 1 ? ' is' : 'es are'} LIVE right now — customer contact can happen.
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Loading switches…</div>}

      {!isLoading && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-destructive" /> AI VOICE CALLS
              <Badge variant="destructive">highest risk</Badge>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">{voice.map((s) => renderCard(s, true))}</div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> SMS
            </h2>
            <div className="grid gap-3 md:grid-cols-2">{sms.map((s) => renderCard(s, false))}</div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shuffle className="h-5 w-5" /> MIXED / OTHER
            </h2>
            <div className="grid gap-3 md:grid-cols-2">{other.map((s) => renderCard(s, false))}</div>
          </section>
        </>
      )}

      {/* Duration picker when turning a switch ON */}
      <Dialog open={!!pendingOn} onOpenChange={(o) => !o && setPendingOn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn on: {pendingOn?.label}</DialogTitle>
            <DialogDescription>
              How long should this run? It turns itself off automatically when the window ends.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {DURATION_OPTIONS.map((opt) => (
              <Button
                key={opt.label}
                variant={opt.hours === 8 ? 'default' : 'outline'}
                className="justify-start"
                disabled={setSwitch.isPending}
                onClick={() => {
                  if (!pendingOn) return;
                  setSwitch.mutate({ key: pendingOn.key, on: true, hours: opt.hours });
                  setPendingOn(null);
                }}
              >
                {opt.label}
                {opt.hours === 8 && <span className="ml-2 text-xs opacity-70">(recommended)</span>}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingOn(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STOP ALL confirmation */}
      <AlertDialog open={confirmStopAll} onOpenChange={setConfirmStopAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop ALL outreach?</AlertDialogTitle>
            <AlertDialogDescription>
              Every switch turns off immediately. Scheduled jobs will keep ticking but will find their
              switch off and do nothing. Nothing will call or text a customer until you arm a switch again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => stopAll.mutate()}
            >
              Yes — stop everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
