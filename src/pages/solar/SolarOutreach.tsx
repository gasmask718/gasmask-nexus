import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Phone, MessageSquare, Zap, Clock, RefreshCw, Settings,
  CheckCircle2, Target, TrendingUp, Plus, Upload, Users, BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BsComplianceGateStatus } from '@/components/solar/BsComplianceGateStatus';


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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', address: '', state: '', source: 'manual' });

  // Leads ready for outreach (existing solar_leads)
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

  // Outreach contacts (cold call list from Dynasty Connect)
  const { data: outreachContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['solar-outreach-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_outreach_contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
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

  // Outreach contact stats
  const contactStats = {
    total: outreachContacts.length,
    new: outreachContacts.filter((c: any) => c.outreach_status === 'new').length,
    contacted: outreachContacts.filter((c: any) => c.outreach_status === 'contacted').length,
    interested: outreachContacts.filter((c: any) => c.outreach_status === 'interested').length,
  };

  // Add contact
  const addContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('solar_outreach_contacts').insert(newContact);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-outreach-contacts'] });
      toast.success('Contact added');
      setAddDialogOpen(false);
      setNewContact({ name: '', phone: '', address: '', state: '', source: 'manual' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Trigger outreach on existing lead
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

  // Convert outreach contact → solar_leads
  const convertToLead = useMutation({
    mutationFn: async (contact: any) => {
      const { error: leadErr } = await supabase.from('solar_leads').insert({
        full_name: contact.name,
        phone: contact.phone,
        address: contact.address,
        state: contact.state,
        lead_source: 'outreach_cold_call',
        status: 'new',
      });
      if (leadErr) throw leadErr;
      await supabase.from('solar_outreach_contacts')
        .update({ outreach_status: 'interested' })
        .eq('id', contact.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-outreach-contacts'] });
      toast.success('Contact converted to solar lead');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor = (s: string) => {
    switch (s) {
      case 'new': return 'text-blue-400 border-blue-500/30';
      case 'contacted': return 'text-amber-400 border-amber-500/30';
      case 'interested': return 'text-green-400 border-green-500/30';
      case 'not_interested': return 'text-red-400 border-red-500/30';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" style={{ color: AMBER }} />
            Floor 2 — AI Outreach + Dynasty Connect
          </h1>
          <p className="text-sm text-muted-foreground">Cold calls, SMS outreach, and automated lead generation</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={autoMode} onCheckedChange={setAutoMode} />
            <span className="text-sm font-medium">{autoMode ? 'Auto Mode ON' : 'Manual Mode'}</span>
          </div>
          <Badge variant="outline" className={autoMode ? 'text-green-400 border-green-400' : 'text-amber-400 border-amber-400'}>
            {autoMode ? '⚡ ACTIVE' : '⏸ PAUSED'}
          </Badge>
        </div>
      </div>

      {/* Stats Row */}
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

      {/* BrightSun-only outbound compliance gate (not Grabba's switchboard) */}
      <BsComplianceGateStatus />

      <Tabs defaultValue="outreach">

        <TabsList>
          <TabsTrigger value="outreach"><Phone className="h-4 w-4 mr-1" /> Lead Queue</TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 mr-1" /> DC Cold Contacts
            {contactStats.new > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]" style={{ backgroundColor: AMBER }}>{contactStats.new}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sequence"><Settings className="h-4 w-4 mr-1" /> Sequence</TabsTrigger>
          <TabsTrigger value="activity"><RefreshCw className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
        </TabsList>

        {/* Lead Queue Tab */}
        <TabsContent value="outreach" className="space-y-4">
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
                          <Button size="sm" variant="outline" onClick={() => triggerOutreach.mutate(lead.id)} disabled={triggerOutreach.isPending}>
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
        </TabsContent>

        {/* Dynasty Connect Cold Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          {/* Contact Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Contacts', value: contactStats.total, color: 'text-foreground' },
              { label: 'New', value: contactStats.new, color: 'text-blue-400' },
              { label: 'Contacted', value: contactStats.contacted, color: 'text-amber-400' },
              { label: 'Interested', value: contactStats.interested, color: 'text-green-400' },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: AMBER }} />
                Cold Call Contact List
              </CardTitle>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" style={{ backgroundColor: AMBER }}>
                    <Plus className="h-4 w-4 mr-1" /> Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Outreach Contact</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label>Phone</Label><Input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} placeholder="+1..." /></div>
                    <div><Label>Address</Label><Input value={newContact.address} onChange={e => setNewContact(p => ({ ...p, address: e.target.value }))} /></div>
                    <div><Label>State</Label><Input value={newContact.state} onChange={e => setNewContact(p => ({ ...p, state: e.target.value }))} maxLength={2} /></div>
                    <div>
                      <Label>Source</Label>
                      <Select value={newContact.source} onValueChange={v => setNewContact(p => ({ ...p, source: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="scraped">Scraped</SelectItem>
                          <SelectItem value="purchased_list">Purchased List</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" style={{ backgroundColor: AMBER }} onClick={() => addContact.mutate()} disabled={!newContact.name || !newContact.phone}>
                      Add Contact
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <p className="text-muted-foreground text-sm text-center py-6">Loading contacts...</p>
              ) : outreachContacts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Upload className="h-10 w-10 mx-auto mb-2" />
                  <p>No outreach contacts yet. Add contacts to start cold calling.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outreachContacts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name || '—'}</TableCell>
                        <TableCell>{c.phone || '—'}</TableCell>
                        <TableCell>{c.state || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{c.source}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={`text-xs ${statusColor(c.outreach_status)}`}>{c.outreach_status}</Badge></TableCell>
                        <TableCell>{c.call_attempts}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.outreach_status !== 'interested' && (
                              <Button size="sm" variant="ghost" onClick={() => convertToLead.mutate(c)} title="Convert to lead">
                                <TrendingUp className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sequence Tab */}
        <TabsContent value="sequence">
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
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: AMBER }}>
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
                      <Clock className="h-3 w-3" />{step.delay}
                    </div>
                    <p className="text-sm flex-1">{step.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
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
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(int.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
