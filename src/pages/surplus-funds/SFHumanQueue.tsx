import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Sparkles, CheckCircle2, XCircle, Clock, RotateCw, FileText } from 'lucide-react';

const SF_ACCENT = '#BA7517';

type Lead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  county: string;
  state: string | null;
  surplus_amount: number | null;
  notes: string | null;
  ai_summary: string | null;
  call_transcript: string | null;
  call_outcome: string | null;
  last_called_at: string | null;
  callback_time: string | null;
  call_count: number | null;
  status: string | null;
};

function scriptFor(lead: Lead) {
  const name = lead.first_name || 'there';
  const amount = lead.surplus_amount ? `$${Number(lead.surplus_amount).toLocaleString()}` : 'unclaimed funds';
  return `Hi ${name}, this is [your name] following up on the call you got about ${amount} from ${lead.county} County. You asked us to call back — do you have a quick minute to walk through how this works?`;
}

const TALKING_POINTS = [
  'Funds are sitting with the county — they don\'t come to you automatically',
  'We do all the paperwork, court filings, and attorney coordination',
  'You pay $0 up front — we only get paid when YOU get paid',
  'Typical timeline: 60–120 days from agreement to check in hand',
  'Next step is a 5-min agreement so we can file on your behalf',
];

export function SFHumanQueue() {
  const [queue, setQueue] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Lead | null>(null);
  const [notes, setNotes] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('surplus_funds_leads')
      .select('id,first_name,last_name,phone,county,state,surplus_amount,notes,ai_summary,call_transcript,call_outcome,last_called_at,callback_time,call_count,status')
      .eq('status', 'callback_requested')
      .order('callback_time', { ascending: true, nullsFirst: false })
      .limit(100);
    setQueue((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const open = (lead: Lead) => {
    setActive(lead);
    setNotes('');
    const def = new Date(Date.now() + 24 * 3600 * 1000);
    def.setMinutes(0, 0, 0);
    setCallbackAt(def.toISOString().slice(0, 16));
  };

  const close = () => { setActive(null); setNotes(''); };

  const appendNote = (existing: string | null, line: string) => {
    const stamp = `[${new Date().toLocaleString()}] ${line}`;
    return existing ? `${existing}\n${stamp}` : stamp;
  };

  const disposition = async (kind: 'interested' | 'no_answer' | 'callback' | 'not_interested') => {
    if (!active) return;
    setSaving(true);
    try {
      const baseLine =
        kind === 'interested' ? `Interested. ${notes || 'Wants to move forward.'}` :
        kind === 'no_answer' ? `No answer — auto-retry in 4h. ${notes}` :
        kind === 'callback' ? `Callback scheduled for ${new Date(callbackAt).toLocaleString()}. ${notes}` :
        `Not interested. ${notes || 'Declined.'}`;

      const patch: any = {
        notes: appendNote(active.notes, baseLine),
        last_called_at: new Date().toISOString(),
        call_outcome: kind,
        updated_at: new Date().toISOString(),
      };

      if (kind === 'interested') {
        patch.status = 'interested';
        patch.interest_level = 'high';
        patch.recommended_action = 'send_contract';
        patch.callback_time = null;
      } else if (kind === 'no_answer') {
        patch.status = 'callback_requested';
        patch.callback_time = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
      } else if (kind === 'callback') {
        patch.status = 'callback_requested';
        patch.callback_time = new Date(callbackAt).toISOString();
      } else {
        patch.status = 'not_interested';
        patch.interest_level = 'low';
        patch.callback_time = null;
      }

      const { error } = await supabase.from('surplus_funds_leads').update(patch).eq('id', active.id);
      if (error) throw error;

      toast.success(
        kind === 'interested' ? '🔥 Marked interested — contract task created' :
        kind === 'no_answer' ? '⏰ Auto-retry scheduled in 4 hours' :
        kind === 'callback' ? '📅 Callback scheduled' :
        '✓ Lead marked done'
      );
      close();
      refresh();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="border-yellow-500/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            👤 Human Callback Queue
            {queue.length > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 border">
                {queue.length} pending
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={refresh}><RotateCw className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading queue…</p>
          ) : queue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">✅ No callbacks pending — Bland AI handles new leads automatically.</p>
          ) : (
            <div className="space-y-2">
              {queue.map(l => {
                const due = l.callback_time ? new Date(l.callback_time) : null;
                const overdue = due && due.getTime() < Date.now();
                return (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-md border border-border/60 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{l.first_name} {l.last_name}</span>
                        <Badge variant="outline" className="text-[10px]">{l.state} · {l.county}</Badge>
                        {l.surplus_amount && (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 border text-[10px]">
                            ${Number(l.surplus_amount).toLocaleString()}
                          </Badge>
                        )}
                        {overdue && <Badge className="bg-red-500/20 text-red-300 border-red-500/40 border text-[10px]">OVERDUE</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {l.phone || 'No phone'} · last call: {l.last_called_at ? new Date(l.last_called_at).toLocaleString() : '—'}
                        {due && ` · due: ${due.toLocaleString()}`}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => open(l)} style={{ backgroundColor: SF_ACCENT }}>
                      <Phone className="h-3 w-3 mr-1" />Start Call
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={o => !o && close()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {active?.first_name} {active?.last_name} — Callback
            </DialogTitle>
          </DialogHeader>

          {active && (
            <div className="space-y-4">
              {/* Lead info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-md bg-muted/30">
                <div><div className="text-[10px] uppercase text-muted-foreground">Phone</div><div className="font-mono text-sm">{active.phone || '—'}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">County</div><div className="text-sm">{active.county}, {active.state}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Amount</div><div className="text-sm font-bold text-emerald-400">${Number(active.surplus_amount ?? 0).toLocaleString()}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Call #</div><div className="text-sm">{(active.call_count ?? 0) + 1}</div></div>
              </div>

              {/* Click to call */}
              {active.phone && (
                <a href={`tel:${active.phone}`} className="block">
                  <Button className="w-full" size="lg" style={{ backgroundColor: SF_ACCENT }}>
                    <Phone className="h-4 w-4 mr-2" />Tap to dial {active.phone}
                  </Button>
                </a>
              )}

              {/* AI summary from previous Bland call */}
              {(active.ai_summary || active.call_transcript) && (
                <div className="p-3 rounded-md border border-purple-500/30 bg-purple-500/5">
                  <div className="flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-purple-400" /><span className="text-xs font-semibold text-purple-300">AI Summary — Previous Bland Call</span></div>
                  <p className="text-sm whitespace-pre-wrap">{active.ai_summary || active.call_transcript?.slice(0, 600) + '…'}</p>
                </div>
              )}

              {/* Script */}
              <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-amber-400" /><span className="text-xs font-semibold text-amber-300">Script — read this</span></div>
                <p className="text-sm italic">"{scriptFor(active)}"</p>
              </div>

              {/* Talking points */}
              <div className="p-3 rounded-md border border-border/60">
                <div className="text-xs font-semibold mb-2">Key talking points</div>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  {TALKING_POINTS.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>

              {/* Previous notes */}
              {active.notes && (
                <div className="p-3 rounded-md bg-muted/30 max-h-32 overflow-auto">
                  <div className="text-xs font-semibold mb-1">Previous notes</div>
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{active.notes}</pre>
                </div>
              )}

              {/* Disposition */}
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <label className="text-xs font-semibold">Call notes</label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What happened on the call?" rows={3} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button onClick={() => disposition('interested')} disabled={saving} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-4 w-4 mr-1" />Interested
                  </Button>
                  <Button onClick={() => disposition('no_answer')} disabled={saving} variant="outline">
                    <Clock className="h-4 w-4 mr-1" />No Answer (4h)
                  </Button>
                  <div className="col-span-2 md:col-span-1 flex gap-1">
                    <Input type="datetime-local" value={callbackAt} onChange={e => setCallbackAt(e.target.value)} className="text-xs" />
                  </div>
                  <Button onClick={() => disposition('callback')} disabled={saving || !callbackAt} variant="outline">
                    <RotateCw className="h-4 w-4 mr-1" />Schedule Callback
                  </Button>
                  <Button onClick={() => disposition('not_interested')} disabled={saving} variant="outline" className="col-span-2 md:col-span-4 border-red-500/40 text-red-400 hover:bg-red-500/10">
                    <XCircle className="h-4 w-4 mr-1" />Not Interested — Mark Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
