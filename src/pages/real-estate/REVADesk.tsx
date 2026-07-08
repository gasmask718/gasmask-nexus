import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Play } from 'lucide-react';

const RE_ACCENT = '#3B6D11';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'follow_up_call', label: 'Follow-Up Calls' },
  { value: 'appointment_set', label: 'Appointments' },
  { value: 'property_research', label: 'Research' },
  { value: 'completed', label: 'Completed' },
] as const;

const DEFAULT_SCRIPTS: Record<string, (lead: any) => string> = {
  follow_up_call: (l) =>
    `Hi ${l.first_name ?? 'there'}, this is your name calling from Dynasty Wholesale. I'm following up on a conversation our team had with you recently about your property.\n\nDo you have 2-3 minutes to chat?`,
  appointment_set: (l) =>
    `Hi ${l.first_name ?? 'there'}, I'm calling to confirm our appointment to discuss your property at ${l.property_address ?? 'your property'}.\n\nWe're very interested and would like to make you an offer. When is a good time to connect this week?`,
  seller_callback: (l) =>
    `Hi ${l.first_name ?? 'there'}, you requested a callback from our team. I'm reaching out to get you connected with our acquisitions manager.\n\nDo you have a few minutes now?`,
};

const DISPOSITIONS = [
  { value: 'interested', label: '✅ Interested — Set Appointment', cls: 'bg-green-600 hover:bg-green-700' },
  { value: 'callback', label: '📅 Callback — Call Back Later', cls: 'bg-yellow-600 hover:bg-yellow-700' },
  { value: 'not_interested', label: '🚫 Not Interested', cls: 'bg-red-600 hover:bg-red-700' },
  { value: 'voicemail', label: '📵 No Answer — Left Voicemail', cls: 'bg-slate-600 hover:bg-slate-700' },
  { value: 'no_answer', label: '❌ No Answer — No Voicemail', cls: 'bg-slate-700 hover:bg-slate-800' },
  { value: 'wrong_number', label: '🔀 Wrong Number', cls: 'bg-orange-600 hover:bg-orange-700' },
];

const PRIORITY_TONE: Record<string, string> = {
  urgent: 'bg-red-600 text-white animate-pulse',
  high: 'bg-orange-600 text-white',
  normal: 'bg-blue-600 text-white',
  low: 'bg-gray-600 text-white',
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

export default function REVADesk() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState({ today: 0, completed: 0, urgent: 0, appts: 0 });
  const [filter, setFilter] = useState<string>('all');
  const [completedToday, setCompletedToday] = useState<any[]>([]);

  const [active, setActive] = useState<{ task: any; lead: any } | null>(null);
  const [notes, setNotes] = useState('');
  const [disposition, setDisposition] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = async () => {
    const showCompleted = filter === 'completed';
    let q = supabase.from('re_va_tasks').select('*, re_leads(id, first_name, last_name, phone, property_address, city, state, lead_source, interest_score, ai_summary, call_count)');
    if (showCompleted) q = q.eq('status', 'completed');
    else q = q.in('status', ['queued', 'in_progress']);
    if (!showCompleted && filter !== 'all') {
      if (filter === 'urgent') q = q.eq('priority', 'urgent');
      else q = q.eq('task_type', filter);
    }
    const { data } = await q.order('due_at', { ascending: true, nullsFirst: false }).limit(50);
    setTasks(data ?? []);
  };

  const loadStats = async () => {
    const since = startOfToday();
    const [t, c, u, a, cdone] = await Promise.all([
      supabase.from('re_va_tasks').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('re_va_tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', since),
      supabase.from('re_va_tasks').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').eq('status', 'queued'),
      supabase.from('re_va_tasks').select('id', { count: 'exact', head: true }).eq('task_type', 'appointment_set').gte('created_at', since),
      supabase.from('re_va_tasks').select('*, re_leads(first_name, last_name)').eq('status', 'completed').gte('completed_at', since).order('completed_at', { ascending: false }).limit(20),
    ]);
    setStats({ today: t.count ?? 0, completed: c.count ?? 0, urgent: u.count ?? 0, appts: a.count ?? 0 });
    setCompletedToday(cdone.data ?? []);
  };

  useEffect(() => { loadQueue(); }, [filter]);
  useEffect(() => { loadStats(); }, []);

  const startTask = async (task: any) => {
    await supabase.from('re_va_tasks').update({ status: 'in_progress' }).eq('id', task.id);
    setActive({ task, lead: task.re_leads });
    setNotes(task.notes ?? '');
    setDisposition(null);
  };

  const escalate = async () => {
    if (!active) return;
    const { task, lead } = active;
    const message = `🚨 VA Escalation!\nLead: ${lead?.first_name ?? ''} ${lead?.last_name ?? ''}\nPhone: ${lead?.phone ?? '—'}\nProperty: ${lead?.property_address ?? '—'}\nTask: ${task.task_type}\nVA Notes: ${notes}`;
    try {
      const { error } = await supabase.functions.invoke('send-sms', {
        body: { phone_numbers: ['+19295007046'], message, purpose: 're_va_escalation' },
      });
      if (error) throw error;
      toast.success('David has been notified!');
    } catch (e: any) {
      toast.error(`Escalation failed: ${e.message}`);
    }
  };

  const completeTask = async () => {
    if (!active || !disposition) { toast.error('Pick a disposition first.'); return; }
    setSubmitting(true);
    try {
      const { task, lead } = active;
      await supabase.from('re_va_tasks').update({
        status: 'completed', completed_at: new Date().toISOString(), notes,
      }).eq('id', task.id);
      if (lead?.id) {
        await supabase.from('re_leads').update({
          status: disposition, last_called_at: new Date().toISOString(),
        }).eq('id', lead.id);
      }
      if (disposition === 'interested' && lead?.id) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString();
        await supabase.from('re_va_tasks').insert({
          lead_id: lead.id,
          task_type: 'appointment_set',
          priority: 'urgent',
          status: 'queued',
          script: DEFAULT_SCRIPTS.appointment_set(lead),
          due_at: tomorrow,
          notes: 'Seller interested on follow-up call. Set appointment.',
        });
        toast.success('Task complete! New appointment task created — urgent.');
      } else {
        toast.success('Task completed.');
      }
      setActive(null);
      loadQueue(); loadStats();
    } catch (e: any) {
      toast.error(`Complete failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const script = useMemo(() => {
    if (!active) return '';
    if (active.task.script) return active.task.script;
    const fn = DEFAULT_SCRIPTS[active.task.task_type];
    return fn ? fn(active.lead ?? {}) : '';
  }, [active]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: RE_ACCENT }}>👥 VA Desk</h1>
        <p className="text-muted-foreground">Your call queue and scripts</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Today's Tasks", val: stats.today },
          { label: 'Completed', val: stats.completed },
          { label: 'Urgent', val: stats.urgent },
          { label: 'Appointments Set', val: stats.appts },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4"><div className="text-2xl font-bold">{s.val}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>📋 Your Queue</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={setFilter} className="mb-3">
            <TabsList>{FILTERS.map(f => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}</TabsList>
          </Tabs>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tasks here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left p-2">Priority</th><th className="text-left p-2">Lead</th><th className="text-left p-2">Phone</th><th className="text-left p-2">Address</th><th className="text-left p-2">Task</th><th className="text-left p-2">Due</th><th className="text-left p-2">Action</th></tr>
                </thead>
                <tbody>
                  {tasks.map(t => {
                    const l = t.re_leads ?? {};
                    return (
                      <tr key={t.id} className="border-b border-border/50">
                        <td className="p-2"><Badge className={PRIORITY_TONE[t.priority] ?? 'bg-gray-500'}>{t.priority}</Badge></td>
                        <td className="p-2">{l.first_name} {l.last_name}</td>
                        <td className="p-2"><a href={`tel:${l.phone}`} className="text-blue-400">{l.phone ?? '—'}</a></td>
                        <td className="p-2 text-xs">{l.property_address}, {l.city} {l.state}</td>
                        <td className="p-2 text-xs">{t.task_type?.replace(/_/g, ' ')}</td>
                        <td className="p-2 text-xs text-muted-foreground">{t.due_at ? new Date(t.due_at).toLocaleString() : '—'}</td>
                        <td className="p-2">
                          {t.status === 'completed' ? <Badge variant="outline">done</Badge> :
                            <Button size="sm" onClick={() => startTask(t)}><Play className="h-3 w-3 mr-1" />Start</Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>✅ Completed Today</CardTitle></CardHeader>
        <CardContent>
          {completedToday.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nothing completed yet today.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left p-2">Task</th><th className="text-left p-2">Lead</th><th className="text-left p-2">Notes</th><th className="text-left p-2">Time</th></tr></thead>
              <tbody>
                {completedToday.map(t => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="p-2 text-xs">{t.task_type}</td>
                    <td className="p-2">{t.re_leads?.first_name} {t.re_leads?.last_name}</td>
                    <td className="p-2 text-xs truncate max-w-[260px]">{t.notes}</td>
                    <td className="p-2 text-xs text-muted-foreground">{t.completed_at ? new Date(t.completed_at).toLocaleTimeString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!active} onOpenChange={o => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Active Call</SheetTitle></SheetHeader>
          {active && (
            <div className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-4 space-y-1 text-sm">
                  <div className="font-semibold text-lg">{active.lead?.first_name} {active.lead?.last_name}</div>
                  <a href={`tel:${active.lead?.phone}`} className="text-2xl font-bold text-blue-400">{active.lead?.phone ?? '—'}</a>
                  <div className="text-xs text-muted-foreground">{active.lead?.property_address}, {active.lead?.city} {active.lead?.state}</div>
                  <div className="text-xs">Source: {active.lead?.lead_source ?? '—'} · Score: {active.lead?.interest_score ?? '—'} · Calls: {active.lead?.call_count ?? 0}</div>
                  {active.lead?.ai_summary && <div className="text-xs mt-2 p-2 bg-muted/40 rounded">{active.lead.ai_summary}</div>}
                </CardContent>
              </Card>

              <div>
                <div className="text-xs font-semibold mb-1 text-muted-foreground">SCRIPT</div>
                <Textarea readOnly value={script} className="h-40 text-xs" />
              </div>

              <div>
                <div className="text-xs font-semibold mb-2 text-muted-foreground">DISPOSITION</div>
                <div className="grid gap-2">
                  {DISPOSITIONS.map(d => (
                    <Button key={d.value} type="button" size="lg" onClick={() => setDisposition(d.value)} className={`${d.cls} text-white min-h-[44px] ${disposition === d.value ? 'ring-2 ring-white' : ''}`}>
                      {d.label}
                    </Button>
                  ))}
                  <Button type="button" size="lg" onClick={escalate} className="bg-purple-600 hover:bg-purple-700 border-2 border-purple-400 text-white min-h-[44px]">🚨 Escalate to David</Button>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-1 text-muted-foreground">NOTES</div>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add call notes here..." />
              </div>

              <Button onClick={completeTask} disabled={submitting || !disposition} className="w-full" style={{ backgroundColor: RE_ACCENT }}>
                <Phone className="h-4 w-4 mr-1" />{submitting ? 'Saving...' : '✅ Complete Task'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
