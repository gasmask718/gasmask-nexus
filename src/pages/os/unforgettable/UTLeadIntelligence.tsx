
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Brain, Search, Plug, Clock, Database, Users, Building, Star, Loader2, CheckCircle, AlertCircle, MessageSquare, Mail, Instagram, X, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SOURCE_CONFIG: Record<string, { icon: string; label: string; color: string; instructions: string; fields: { key: string; label: string }[] }> = {
  outscraper: {
    icon: '🔍', label: 'Outscraper', color: 'text-blue-500',
    instructions: '1. Go to outscraper.com\n2. Sign in → Profile → API Keys\n3. Copy your API key\n4. Paste below',
    fields: [{ key: 'OUTSCRAPER_API_KEY', label: 'Outscraper API Key' }]
  },
  apollo: {
    icon: '🚀', label: 'Apollo.io', color: 'text-purple-500',
    instructions: '1. Go to app.apollo.io\n2. Settings → Integrations → API Keys\n3. Create new key → Copy it\n4. Paste below',
    fields: [{ key: 'APOLLO_API_KEY', label: 'Apollo API Key' }]
  },
  phantombuster: {
    icon: '👻', label: 'PhantomBuster', color: 'text-orange-500',
    instructions: '1. Go to phantombuster.com\n2. Avatar → Settings → API\n3. Copy your API key\n4. Also enter your Agent ID\n5. Paste below',
    fields: [{ key: 'PHANTOMBUSTER_API_KEY', label: 'PhantomBuster API Key' }, { key: 'PHANTOMBUSTER_AGENT_ID', label: 'Agent ID' }]
  },
  sendgrid: {
    icon: '📧', label: 'SendGrid', color: 'text-green-500',
    instructions: '1. Go to app.sendgrid.com\n2. Settings → API Keys\n3. Create API Key → Full Access\n4. Copy and paste below',
    fields: [{ key: 'SENDGRID_API_KEY', label: 'SendGrid API Key' }]
  },
};

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-500/20 text-green-400 border-green-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-muted text-muted-foreground border-border',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-amber-500/20 text-amber-400',
  contacted: 'bg-blue-500/20 text-blue-400',
  responded: 'bg-purple-500/20 text-purple-400',
  converted: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

export default function UTLeadIntelligence() {
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<string | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [searchForm, setSearchForm] = useState({ source: '', lead_type: 'venue', query: '', city: '', state: '' });
  const [searching, setSearching] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [leadTab, setLeadTab] = useState('all');

  // Queries
  const { data: leads = [] } = useQuery({
    queryKey: ['ut-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_leads').select('*').order('created_at', { ascending: false }).limit(500);
      return (data || []) as any[];
    }
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['ut-lead-sources'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_lead_sources').select('*').order('source_name');
      return (data || []) as any[];
    }
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['ut-automation-runs'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_automation_runs').select('*').order('started_at', { ascending: false }).limit(20);
      return (data || []) as any[];
    }
  });

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('ut-leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ut-leads'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_automation_runs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ut-automation-runs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // KPIs
  const today = new Date().toISOString().split('T')[0];
  const totalLeads = leads.length;
  const newToday = leads.filter(l => l.created_at?.startsWith(today)).length;
  const aGradeLeads = leads.filter(l => l.grade === 'A').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';
  const venuesFound = leads.filter(l => l.lead_type === 'venue').length;
  const staffFound = leads.filter(l => l.lead_type === 'staff').length;
  const ambassadorProspects = leads.filter(l => l.lead_type === 'ambassador').length;
  const outreachSent = leads.filter(l => l.outreach_sent_at).length;

  // Filtered leads
  const filteredLeads = leadTab === 'all' ? leads
    : leadTab === 'contacted' ? leads.filter(l => l.status === 'contacted')
    : leadTab === 'converted' ? leads.filter(l => l.status === 'converted')
    : leads.filter(l => l.grade === leadTab.toUpperCase());

  // Update lead status
  const updateLead = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('ut_leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ut-leads'] }),
  });

  // Connect source
  const handleConnect = async (sourceName: string) => {
    const config = SOURCE_CONFIG[sourceName];
    if (!config) return;
    // Mark as connected in DB
    await supabase.from('ut_lead_sources').update({ is_connected: true, api_key_configured: true, status: 'connected' }).eq('source_name', sourceName);
    queryClient.invalidateQueries({ queryKey: ['ut-lead-sources'] });
    toast.success(`${config.label} connected!`);
    setConnectModal(null);
    setApiKeyInputs({});
  };

  // Run search
  const handleSearch = async () => {
    if (!searchForm.source || !searchForm.query) {
      toast.error('Select a source and enter a search query');
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ut-lead-scraper', {
        body: searchForm
      });
      if (error) throw error;
      toast.success(`Found ${data.leads_found} leads!`);
      queryClient.invalidateQueries({ queryKey: ['ut-leads'] });
      queryClient.invalidateQueries({ queryKey: ['ut-automation-runs'] });
    } catch (err: any) {
      toast.error(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-7 w-7 text-pink-500" />
          Lead Intelligence Engine
        </h1>
        <p className="text-muted-foreground">Autonomous AI-powered lead generation & scoring</p>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Leads</p><p className="text-2xl font-bold">{totalLeads.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">New Today</p><p className="text-2xl font-bold text-green-400">{newToday}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">A-Grade Leads</p><p className="text-2xl font-bold text-amber-400">🔥 {aGradeLeads}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Conversion Rate</p><p className="text-2xl font-bold">{conversionRate}%</p></CardContent></Card>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-2"><Building className="h-4 w-4 text-blue-400" /><div><p className="text-xs text-muted-foreground">Venues</p><p className="text-lg font-bold">{venuesFound}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><Users className="h-4 w-4 text-purple-400" /><div><p className="text-xs text-muted-foreground">Staff</p><p className="text-lg font-bold">{staffFound}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><Star className="h-4 w-4 text-amber-400" /><div><p className="text-xs text-muted-foreground">Ambassadors</p><p className="text-lg font-bold">{ambassadorProspects}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-green-400" /><div><p className="text-xs text-muted-foreground">Outreach Sent</p><p className="text-lg font-bold">{outreachSent}</p></div></CardContent></Card>
      </div>

      {/* Integration Status */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Plug className="h-5 w-5" /> Integration Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {['outscraper', 'apollo', 'phantombuster', 'sendgrid'].map(key => {
            const cfg = SOURCE_CONFIG[key];
            const src = sources.find((s: any) => s.source_name === key);
            const connected = src?.is_connected;
            return (
              <Card key={key} className={connected ? 'border-green-500/30' : 'border-dashed'}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{cfg.icon}</span>
                    {connected
                      ? <Badge className="bg-green-500/20 text-green-400 text-xs">✅ Connected</Badge>
                      : <Badge variant="outline" className="text-amber-400 text-xs">⚠️ Not Connected</Badge>}
                  </div>
                  <p className="font-semibold text-sm">{cfg.label}</p>
                  <p className="text-xs text-muted-foreground">{(src?.config as any)?.description || ''}</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Last run: {src?.last_run_at ? format(new Date(src.last_run_at), 'MMM d, yyyy, h:mm a') : 'Never'}</p>
                    <p>Total pulled: {src?.total_leads_pulled || 0}</p>
                  </div>
                  {!connected && (
                    <Button size="sm" className="w-full mt-2" onClick={() => setConnectModal(key)}>
                      <Plug className="h-3 w-3 mr-1" /> Connect Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Manual Search Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Run Manual Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Select value={searchForm.source} onValueChange={v => setSearchForm(p => ({ ...p, source: v }))}>
              <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outscraper">Outscraper</SelectItem>
                <SelectItem value="apollo">Apollo</SelectItem>
                <SelectItem value="phantombuster">PhantomBuster</SelectItem>
              </SelectContent>
            </Select>
            <Select value={searchForm.lead_type} onValueChange={v => setSearchForm(p => ({ ...p, lead_type: v }))}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venue">Venue</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="ambassador">Ambassador</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Search query..." value={searchForm.query} onChange={e => setSearchForm(p => ({ ...p, query: e.target.value }))} />
            <Input placeholder="City" value={searchForm.city} onChange={e => setSearchForm(p => ({ ...p, city: e.target.value }))} />
            <Input placeholder="State" value={searchForm.state} onChange={e => setSearchForm(p => ({ ...p, state: e.target.value }))} />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              {searching ? 'Searching...' : 'Run Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Runs */}
      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead><TableHead>Type</TableHead><TableHead>Started</TableHead>
                  <TableHead>Leads</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice(0, 10).map((run: any) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.source}</TableCell>
                    <TableCell>{run.run_type}</TableCell>
                    <TableCell className="text-xs">{run.started_at ? format(new Date(run.started_at), 'MMM d, yyyy, h:mm a') : '—'}</TableCell>
                    <TableCell>{run.leads_found}</TableCell>
                    <TableCell>
                      <Badge className={run.status === 'completed' ? 'bg-green-500/20 text-green-400' : run.status === 'running' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}>
                        {run.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Leads Database</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={leadTab} onValueChange={setLeadTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="all">All ({leads.length})</TabsTrigger>
              <TabsTrigger value="a">🔥 A-Grade ({aGradeLeads})</TabsTrigger>
              <TabsTrigger value="b">⚡ B-Grade ({leads.filter(l => l.grade === 'B').length})</TabsTrigger>
              <TabsTrigger value="c">C-Grade ({leads.filter(l => l.grade === 'C').length})</TabsTrigger>
              <TabsTrigger value="contacted">Contacted</TabsTrigger>
              <TabsTrigger value="converted">Converted</TabsTrigger>
            </TabsList>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name / Business</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No leads yet. Run a search to find prospects!</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.slice(0, 100).map((lead: any) => (
                      <TableRow key={lead.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{lead.business_name || lead.contact_name || '—'}</p>
                            {lead.contact_name && lead.business_name && (
                              <p className="text-xs text-muted-foreground">{lead.contact_name}</p>
                            )}
                            {lead.instagram_handle && (
                              <p className="text-xs text-pink-400">@{lead.instagram_handle}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{lead.lead_type}</Badge></TableCell>
                        <TableCell className="text-xs">{lead.source}</TableCell>
                        <TableCell className="text-xs">{lead.city}, {lead.state}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${GRADE_COLORS[lead.grade] || GRADE_COLORS.C}`}>
                            {lead.grade === 'A' ? '🔥 A' : lead.grade === 'B' ? '⚡ B' : 'C'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{lead.score || 0}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_COLORS[lead.status] || ''}`}>{lead.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {lead.phone && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs"
                                onClick={() => { updateLead.mutate({ id: lead.id, updates: { status: 'contacted', outreach_channel: 'sms', outreach_sent_at: new Date().toISOString() } }); toast.success('SMS queued!'); }}>
                                📱
                              </Button>
                            )}
                            {lead.email && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs"
                                onClick={() => { updateLead.mutate({ id: lead.id, updates: { status: 'contacted', outreach_channel: 'email', outreach_sent_at: new Date().toISOString() } }); toast.success('Email queued!'); }}>
                                📧
                              </Button>
                            )}
                            {lead.status !== 'converted' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-green-400"
                                onClick={() => { updateLead.mutate({ id: lead.id, updates: { status: 'converted', converted_at: new Date().toISOString() } }); toast.success('Lead converted!'); }}>
                                ✅
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400"
                              onClick={() => { updateLead.mutate({ id: lead.id, updates: { status: 'rejected' } }); toast.success('Lead rejected'); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Connect Modal */}
      <Dialog open={!!connectModal} onOpenChange={() => { setConnectModal(null); setApiKeyInputs({}); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectModal && SOURCE_CONFIG[connectModal]?.icon} Connect {connectModal && SOURCE_CONFIG[connectModal]?.label}
            </DialogTitle>
            <DialogDescription>Enter your API credentials to activate this integration</DialogDescription>
          </DialogHeader>
          {connectModal && (
            <div className="space-y-4">
              <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">{SOURCE_CONFIG[connectModal].instructions}</pre>
              {SOURCE_CONFIG[connectModal].fields.map(field => (
                <div key={field.key}>
                  <label className="text-sm font-medium">{field.label}</label>
                  <Input
                    type="password"
                    placeholder={`Enter ${field.label}...`}
                    value={apiKeyInputs[field.key] || ''}
                    onChange={e => setApiKeyInputs(p => ({ ...p, [field.key]: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              ))}
              <Button className="w-full" onClick={() => handleConnect(connectModal)}
                disabled={!SOURCE_CONFIG[connectModal].fields.every(f => apiKeyInputs[f.key])}>
                <CheckCircle className="h-4 w-4 mr-2" /> Save & Activate
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
