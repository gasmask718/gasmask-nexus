import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Headphones, Phone, Clock, User, AlertTriangle, DollarSign
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

interface DispositionCode {
  id: string;
  code: string;
  label: string;
  category: string;
  requires_followup: boolean;
  followup_delay_minutes: number | null;
  marks_do_not_call: boolean;
  creates_invoice_draft: boolean;
}

export default function LiveCallPanel() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [dispositionModal, setDispositionModal] = useState<{ sessionId: string; contactName: string } | null>(null);
  const [dispForm, setDispForm] = useState({
    disposition_code_id: '',
    notes: '',
    revenue_amount: '',
    decision_maker_name: '',
    competitor_mentioned: '',
    best_call_time: '',
    custom_followup: false,
    custom_followup_at: '',
  });

  // Active sessions with 3-second auto-refresh
  const { data: sessions = [] } = useQuery({
    queryKey: ['live-call-sessions', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_call_sessions')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .is('ended_at', null)
        .order('connected_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 3000,
  });

  // Disposition codes
  const { data: dispositionCodes = [] } = useQuery({
    queryKey: ['disposition-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_disposition_codes')
        .select('*')
        .eq('is_current', true)
        .order('category', { ascending: true });
      if (error) throw error;
      return (data || []) as DispositionCode[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!currentBusiness?.id) return;
    const channel = supabase
      .channel('live-sessions-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_call_sessions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-call-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['recent-call-sessions'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentBusiness?.id, queryClient]);

  const { data: recentSessions = [] } = useQuery({
    queryKey: ['recent-call-sessions', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_call_sessions')
        .select('*, dialer_disposition_codes(code, label, category)')
        .eq('business_id', currentBusiness?.id)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Disposition mutation via edge function
  const dispositionMutation = useMutation({
    mutationFn: async () => {
      if (!dispositionModal) throw new Error('No session selected');
      const { data, error } = await supabase.functions.invoke('apply-call-disposition', {
        body: {
          session_id: dispositionModal.sessionId,
          disposition_code_id: dispForm.disposition_code_id,
          notes: dispForm.notes || null,
          revenue_amount: dispForm.revenue_amount ? parseFloat(dispForm.revenue_amount) : null,
          decision_maker_name: dispForm.decision_maker_name || null,
          competitor_mentioned: dispForm.competitor_mentioned || null,
          best_call_time: dispForm.best_call_time || null,
          custom_followup_at: dispForm.custom_followup && dispForm.custom_followup_at 
            ? new Date(dispForm.custom_followup_at).toISOString() : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const msg = data?.do_not_call_flagged 
        ? '⛔ Disposed — Store flagged DO NOT CALL' 
        : data?.followup_id 
          ? '✅ Disposed — Follow-up scheduled' 
          : '✅ Call disposed — agent entering wrap-up';
      toast.success(msg);
      setDispositionModal(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['live-call-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-call-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dialer-agents'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-call-queue'] });
    },
    onError: (err: any) => toast.error(`Disposition failed: ${err.message}`),
  });

  const resetForm = () => setDispForm({
    disposition_code_id: '', notes: '', revenue_amount: '', decision_maker_name: '',
    competitor_mentioned: '', best_call_time: '', custom_followup: false, custom_followup_at: '',
  });

  const selectedDisp = dispositionCodes.find(d => d.id === dispForm.disposition_code_id);

  const formatDuration = (connectedAt: string) => {
    const diff = Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'positive': return 'text-green-600 border-green-500/30 bg-green-500/10';
      case 'negative': return 'text-red-600 border-red-500/30 bg-red-500/10';
      case 'admin': return 'text-orange-600 border-orange-500/30 bg-orange-500/10';
      default: return 'text-blue-600 border-blue-500/30 bg-blue-500/10';
    }
  };

  return (
    <div className="w-full min-h-full space-y-6">
      {/* Mode Banner — dynamically reflects current telephony mode */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Live Call Panel — Calls may be simulated or real depending on telephony mode</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Headphones className="h-6 w-6" /> Live Call Panel
        </h2>
        <p className="text-muted-foreground">Active bridged calls — structured disposition system (auto-refreshes every 3s)</p>
      </div>

      {/* Active Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sessions.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent className="py-12 text-center">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Active Calls</h3>
              <p className="text-sm text-muted-foreground mt-1">Start the bulk dialer to begin connecting to humans</p>
            </CardContent>
          </Card>
        ) : (
          sessions.map(session => (
            <Card key={session.id} className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                    {session.contact_name || 'Unknown Contact'}
                  </CardTitle>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDuration(session.connected_at)}
                  </Badge>
                </div>
                {(session as any).phone_number && (
                  <p className="text-xs text-muted-foreground">{(session as any).phone_number}</p>
                )}
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    resetForm();
                    setDispositionModal({ sessionId: session.id, contactName: session.contact_name || 'Unknown' });
                  }}
                >
                  End Call & Dispose
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent calls</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recentSessions.map(session => {
                  const disp = (session as any).dialer_disposition_codes;
                  return (
                    <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{session.contact_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.duration_seconds ? `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s` : 'N/A'}
                            {(session as any).revenue_amount ? ` • $${(session as any).revenue_amount}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {disp ? (
                          <Badge variant="outline" className={`text-xs ${categoryColor(disp.category)}`}>
                            {disp.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize text-xs">
                            {session.outcome?.replace('_', ' ') || 'No disposition'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Disposition Modal */}
      <Dialog open={!!dispositionModal} onOpenChange={(o) => { if (!o) setDispositionModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Dispose Call — {dispositionModal?.contactName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Disposition Select */}
            <div className="space-y-2">
              <Label>Disposition *</Label>
              <Select value={dispForm.disposition_code_id} onValueChange={v => setDispForm(f => ({ ...f, disposition_code_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select disposition..." /></SelectTrigger>
                <SelectContent>
                  {['positive', 'neutral', 'negative', 'admin'].map(cat => {
                    const items = dispositionCodes.filter(d => d.category === cat);
                    if (items.length === 0) return null;
                    return items.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className={`${cat === 'positive' ? 'text-green-600' : cat === 'negative' ? 'text-red-600' : cat === 'admin' ? 'text-orange-600' : ''}`}>
                          {d.label}
                        </span>
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Warning for DNC */}
            {selectedDisp?.marks_do_not_call && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive font-medium">
                ⛔ This will permanently flag the store as DO NOT CALL. Admin override required to reverse.
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Call notes..." value={dispForm.notes} onChange={e => setDispForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            {/* Revenue */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Revenue Amount (optional)</Label>
              <Input type="number" placeholder="0.00" value={dispForm.revenue_amount} onChange={e => setDispForm(f => ({ ...f, revenue_amount: e.target.value }))} />
            </div>

            {/* Intelligence Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Decision Maker</Label>
                <Input placeholder="Name..." value={dispForm.decision_maker_name} onChange={e => setDispForm(f => ({ ...f, decision_maker_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Competitor Mentioned</Label>
                <Input placeholder="Brand..." value={dispForm.competitor_mentioned} onChange={e => setDispForm(f => ({ ...f, competitor_mentioned: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Best Call Time</Label>
              <Input placeholder="e.g. Mon-Fri 10am" value={dispForm.best_call_time} onChange={e => setDispForm(f => ({ ...f, best_call_time: e.target.value }))} />
            </div>

            {/* Custom Follow-Up */}
            {selectedDisp?.requires_followup && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={dispForm.custom_followup} onCheckedChange={c => setDispForm(f => ({ ...f, custom_followup: !!c }))} />
                  <Label className="text-sm">Override auto follow-up time</Label>
                </div>
                {dispForm.custom_followup && (
                  <Input type="datetime-local" value={dispForm.custom_followup_at} onChange={e => setDispForm(f => ({ ...f, custom_followup_at: e.target.value }))} />
                )}
                {!dispForm.custom_followup && selectedDisp.followup_delay_minutes && (
                  <p className="text-xs text-muted-foreground">
                    Auto follow-up in {selectedDisp.followup_delay_minutes >= 1440 
                      ? `${Math.floor(selectedDisp.followup_delay_minutes / 1440)} day(s)` 
                      : `${selectedDisp.followup_delay_minutes} minutes`}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispositionModal(null)}>Cancel</Button>
            <Button 
              onClick={() => dispositionMutation.mutate()} 
              disabled={!dispForm.disposition_code_id || dispositionMutation.isPending}
              className={selectedDisp?.marks_do_not_call ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {dispositionMutation.isPending ? 'Processing...' : selectedDisp?.marks_do_not_call ? '⛔ Confirm DO NOT CALL' : 'Submit Disposition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
