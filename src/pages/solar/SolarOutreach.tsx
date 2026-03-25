import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Phone, MessageSquare, Zap, Clock, RefreshCw, Play, Pause, Settings,
  CheckCircle2, XCircle, AlertTriangle, Target, TrendingUp, Sun
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AMBER = '#E8A317';

const OUTREACH_SEQUENCE = [
  { step: 1, type: 'sms', delay: '30 seconds', message: 'Initial interest text with savings estimate' },
  { step: 2, type: 'call', delay: '2 minutes', message: 'AI qualification call — homeowner + bill verification' },
  { step: 3, type: 'sms', delay: '24 hours', message: 'Follow-up with savings calculator link' },
  { step: 4, type: 'call', delay: '48 hours', message: 'Second call attempt — different angle' },
  { step: 5, type: 'sms', delay: '72 hours', message: 'Social proof message with local installs' },
  { step: 6, type: 'call', delay: '5 days', message: 'Final call — urgency + incentive' },
  { step: 7, type: 'sms', delay: '7 days', message: 'Last chance SMS with limited-time offer' },
];

export default function SolarOutreach() {
  const queryClient = useQueryClient();
  const [autoMode, setAutoMode] = useState(true);

  // Leads ready for outreach
  const { data: queuedLeads = [] } = useQuery({
    queryKey: ['solar-outreach-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_leads')
        .select('*')
        .in('status', ['new', 'contacted'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Recent interactions
  const { data: recentInteractions = [] } = useQuery({
    queryKey: ['solar-recent-interactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_interactions')
        .select('*, solar_leads(full_name, phone, status)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['solar-outreach-stats'],
    queryFn: async () => {
      const [totalInt, smsInt, callInt, newLeads] = await Promise.all([
        supabase.from('solar_interactions').select('id', { count: 'exact', head: true }),
        supabase.from('solar_interactions').select('id', { count: 'exact', head: true }).eq('interaction_type', 'sms'),
        supabase.from('solar_interactions').select('id', { count: 'exact', head: true }).eq('interaction_type', 'call'),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      ]);
      return {
        totalInteractions: totalInt.count || 0,
        smsSent: smsInt.count || 0,
        callsMade: callInt.count || 0,
        pendingLeads: newLeads.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  const st = stats || { totalInteractions: 0, smsSent: 0, callsMade: 0, pendingLeads: 0 };

  // Simulate triggering outreach
  const triggerOutreach = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from('solar_interactions').insert({
        lead_id: leadId,
        interaction_type: 'sms',
        summary: 'Auto-triggered initial SMS outreach',
        next_action: 'AI call in 2 minutes',
      });
      if (error) throw error;
      await supabase.from('solar_leads').update({ status: 'contacted' }).eq('id', leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-outreach-queue'] });
      queryClient.invalidateQueries({ queryKey: ['solar-recent-interactions'] });
      toast.success('Outreach triggered');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" style={{ color: AMBER }} />
            Floor 2 — AI Outreach Engine
          </h1>
          <p className="text-sm text-muted-foreground">Automated SMS + AI calls within 30 seconds of lead entry</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={autoMode} onCheckedChange={setAutoMode} />
            <span className="text-sm font-medium">{autoMode ? 'Auto Mode ON' : 'Manual Mode'}</span>
          </div>
          <Badge
            variant="outline"
            className={autoMode ? 'text-green-400 border-green-400' : 'text-amber-400 border-amber-400'}
          >
            {autoMode ? '⚡ ACTIVE' : '⏸ PAUSED'}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Leads', value: st.pendingLeads, icon: Target, color: 'text-amber-400' },
          { label: 'SMS Sent', value: st.smsSent, icon: MessageSquare, color: 'text-blue-400' },
          { label: 'Calls Made', value: st.callsMade, icon: Phone, color: 'text-green-400' },
          { label: 'Total Touches', value: st.totalInteractions, icon: Zap, color: 'text-purple-400' },
        ].map((m) => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outreach Sequence Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" style={{ color: AMBER }} />
            7-Touch Outreach Sequence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {OUTREACH_SEQUENCE.map((step) => (
              <div key={step.step} className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-card/50">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: AMBER }}
                >
                  {step.step}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 w-16">
                  {step.type === 'sms' ? (
                    <Badge variant="outline" className="text-blue-400 border-blue-400">SMS</Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-400 border-green-400">CALL</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 w-24">
                  <Clock className="h-3 w-3" />
                  {step.delay}
                </div>
                <p className="text-sm flex-1">{step.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Outreach Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" style={{ color: AMBER }} />
            Outreach Queue — {queuedLeads.length} leads waiting
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queuedLeads.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p>All caught up! No new leads waiting for outreach.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queuedLeads.slice(0, 15).map((lead: any) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim()}</TableCell>
                    <TableCell>{lead.phone || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.city}, {lead.state}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{lead.lead_source}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => triggerOutreach.mutate(lead.id)}
                        disabled={triggerOutreach.isPending}
                      >
                        <Zap className="h-3 w-3 mr-1" /> Trigger
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5" style={{ color: AMBER }} />
            Recent Outreach Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentInteractions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No outreach activity yet</p>
          ) : (
            <div className="space-y-2">
              {recentInteractions.map((int: any) => (
                <div key={int.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30">
                  {int.interaction_type === 'sms' ? (
                    <MessageSquare className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Phone className="h-4 w-4 text-green-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{int.solar_leads?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{int.summary || int.interaction_type}</p>
                  </div>
                  {int.sentiment_score != null && (
                    <Badge variant="outline" className={
                      int.sentiment_score > 0.5 ? 'text-green-400 border-green-400' :
                      int.sentiment_score > 0 ? 'text-amber-400 border-amber-400' :
                      'text-red-400 border-red-400'
                    }>
                      {int.sentiment_score > 0.5 ? '😊' : int.sentiment_score > 0 ? '😐' : '😟'}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(int.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" style={{ color: AMBER }} />
            SMS Script Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Initial Contact', template: 'Hey {name}! 👋 This is BrightSun Energy. Homeowners in {city} are saving $150+/month by going solar. Want to see what you\'d save? Reply YES for a free quote!' },
            { name: 'Follow-Up', template: 'Hi {name}, just checking in! Solar savings in {state} are at an all-time high. Most homeowners qualify for $0 down. Want me to run your numbers? 🏠☀️' },
            { name: 'Social Proof', template: '{name}, we just helped 3 families on your street go solar! Average savings: $180/mo. Your home qualifies too. Interested?' },
            { name: 'Urgency Close', template: '⚡ {name}, federal solar tax credit drops next quarter. Lock in 30% savings NOW. Free consultation — takes 5 min. Interested?' },
          ].map((t) => (
            <div key={t.name} className="p-3 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: AMBER }}>{t.name}</span>
                <Button variant="ghost" size="sm" className="text-xs">Edit</Button>
              </div>
              <p className="text-sm text-muted-foreground italic">"{t.template}"</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
