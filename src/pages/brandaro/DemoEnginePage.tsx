import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Wand2, Eye, Send, RefreshCw, Globe, Clock, ExternalLink, Loader2,
  Zap, Building2, BarChart3, AlertTriangle, Cpu, Sparkles
} from 'lucide-react';

interface DemoSite {
  id: string;
  lead_id: string;
  demo_url: string | null;
  screenshot_url: string | null;
  business_name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  services_inferred: string[] | null;
  generation_status: string;
  generation_engine: string;
  engine_status: string;
  template_used: string | null;
  preview_image: string | null;
  view_count: number;
  last_viewed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface QualifiedLead {
  id: string;
  business_name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  lead_status: string | null;
  demo_status: string | null;
}

const PACKAGE_SERVICES: Record<string, string[]> = {
  plumber: ['Emergency Plumbing', 'Drain Cleaning', 'Water Heater Repair', 'Pipe Installation'],
  hvac: ['AC Repair', 'Heating Installation', 'Duct Cleaning', 'Maintenance Plans'],
  roofing: ['Roof Repair', 'Roof Replacement', 'Storm Damage', 'Free Inspections'],
  electrician: ['Electrical Repair', 'Panel Upgrades', 'Wiring', 'Lighting Installation'],
  landscaping: ['Lawn Care', 'Tree Trimming', 'Hardscaping', 'Irrigation'],
  restaurant: ['Dine-In', 'Takeout', 'Catering', 'Private Events'],
  auto_repair: ['Oil Changes', 'Brake Service', 'Engine Repair', 'Diagnostics'],
  default: ['Professional Services', 'Free Consultation', 'Licensed & Insured', 'Customer Satisfaction'],
};

export default function DemoEnginePage() {
  const [demos, setDemos] = useState<DemoSite[]>([]);
  const [interestedLeads, setInterestedLeads] = useState<QualifiedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<'native' | 'durable'>('native');
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('demos');

  const fetchDemos = async () => {
    setLoading(true);
    let query = (supabase as any).from('brandaro_demo_sites').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('generation_status', filter);
    const { data, error } = await query;
    if (!error) setDemos(data || []);
    setLoading(false);
  };

  const fetchInterestedLeads = async () => {
    const { data } = await (supabase as any)
      .from('brandaro_qualified_leads')
      .select('id, business_name, industry, city, state, lead_status, demo_status')
      .eq('lead_status', 'interested')
      .is('demo_status', null)
      .order('created_at', { ascending: false });
    setInterestedLeads(data || []);
  };

  useEffect(() => { fetchDemos(); fetchInterestedLeads(); }, [filter]);

  const generateDemo = async (leadId: string, engine: 'native' | 'durable' = selectedEngine) => {
    setGenerating(leadId);
    try {
      if (engine === 'native') {
        // Use edge function for native generation
        const { data, error } = await supabase.functions.invoke('brandaro-generate-demo', {
          body: { lead_id: leadId, engine: 'native' },
        });
        if (error) throw error;
        toast.success(`Native demo generated for ${data?.demo?.business_name || 'lead'}`);
        // Auto-send status reported by brandaro-generate-demo (Step 10).
        const sms = (data as any)?.sms;
        if (sms?.status === 'sent') toast.success('Demo link texted to the lead automatically.');
        else if (sms?.status === 'blocked') toast.error(`SMS blocked — contact is on the do-not-contact list (${sms.reason}).`);
        else if (sms?.status === 'failed') toast.error(`Demo is live, but the automatic SMS failed (${sms.reason}). Use the Send button to retry.`);
        else if (sms?.status === 'skipped') toast.warning('Demo is live, but no phone number is on file — nothing was texted.');
      } else {
        // Durable scaffold
        const { data: lead } = await (supabase as any)
          .from('brandaro_qualified_leads')
          .select('*')
          .eq('id', leadId)
          .single();

        if (!lead) throw new Error('Lead not found');

        const industry = (lead.industry || 'default').toLowerCase();
        const services = PACKAGE_SERVICES[industry] || PACKAGE_SERVICES.default;

        const { error } = await (supabase as any)
          .from('brandaro_demo_sites')
          .insert({
            lead_id: leadId,
            business_name: lead.business_name,
            industry: lead.industry,
            city: lead.city,
            state: lead.state,
            services_inferred: services,
            seo_text: `${lead.business_name} — ${industry} services in ${lead.city}, ${lead.state}.`,
            generation_status: 'generating',
            generation_engine: 'durable',
            engine_status: 'pending',
            demo_url: null,
          });

        if (error) throw error;

        await (supabase as any)
          .from('brandaro_qualified_leads')
          .update({ demo_status: 'generating' })
          .eq('id', leadId);

        toast.success(`Durable generation queued for ${lead.business_name}. Will complete when API is connected.`);
      }

      fetchDemos();
      fetchInterestedLeads();
    } catch (err: any) {
      // Fallback logic: if native fails, try durable and vice versa
      if (engine === 'durable') {
        toast.error('Durable generation failed. Attempting native fallback...');
        try {
          await generateDemo(leadId, 'native');
          return;
        } catch {
          toast.error('Both engines failed. Please try again.');
        }
      } else if (engine === 'native') {
        toast.error(`Native generation failed: ${err.message}. Try Durable engine.`);
      } else {
        toast.error(err.message || 'Failed to generate demo');
      }
    } finally {
      setGenerating(null);
    }
  };

  const sendDemo = async (demo: DemoSite) => {
    try {
      // Get lead phone for real sending (column is `phone_number`, not `phone`)
      const { data: lead, error: leadErr } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('phone_number')
        .eq('id', demo.lead_id)
        .single();

      if (leadErr) throw leadErr;

      const phone = lead?.phone_number?.trim();
      if (!phone) {
        toast.error(`No phone number on file for ${demo.business_name} — cannot send SMS. Add a phone number to the lead first.`);
        return;
      }

      // Use real send function
      const { data: sendData, error: sendErr } = await supabase.functions.invoke('brandaro-send-demo', {
        body: {
          demo_id: demo.id,
          lead_id: demo.lead_id,
          channel: 'sms',
          destination: phone,
        },
      });

      if (sendErr) throw sendErr;

      if ((sendData as any)?.suppressed) {
        toast.error(`${demo.business_name} is on the do-not-contact list (${(sendData as any).reason}). Nothing sent, no follow-ups scheduled.`);
        return;
      }

      if (!(sendData as any)?.ok) {
        toast.error(`SMS failed: ${(sendData as any)?.error || 'unknown error'}`);
        return;
      }


      // Schedule follow-ups
      const followupTimes = [6, 24, 72];
      for (let i = 0; i < followupTimes.length; i++) {
        const scheduledAt = new Date(Date.now() + followupTimes[i] * 3600000);
        await (supabase as any).from('brandaro_followups').insert({
          lead_id: demo.lead_id,
          demo_id: demo.id,
          sequence_step: i + 1,
          scheduled_at: scheduledAt.toISOString(),
          channel: 'sms',
          message_template: i === 0
            ? `Hi! Your website preview for ${demo.business_name} is ready: ${demo.demo_url}`
            : i === 1
            ? `Just checking in — we saved your website preview for ${demo.business_name}. Take a look: ${demo.demo_url}`
            : `Want us to activate your website? Your preview is still available: ${demo.demo_url}`,
        });
      }

      await (supabase as any)
        .from('brandaro_qualified_leads')
        .update({ demo_status: 'sent' })
        .eq('id', demo.lead_id);

      toast.success(`Demo sent to ${demo.business_name} with follow-up sequence`);
      fetchDemos();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send demo');
    }
  };

  const nativeDemos = demos.filter(d => d.generation_engine === 'native');
  const durableDemos = demos.filter(d => d.generation_engine === 'durable');

  const stats = {
    total: demos.length,
    native: nativeDemos.length,
    durable: durableDemos.length,
    ready: demos.filter(d => d.generation_status === 'ready').length,
    sent: demos.filter(d => d.sent_at).length,
    viewed: demos.filter(d => d.view_count > 0).length,
    pending: demos.filter(d => d.generation_status === 'pending' || d.generation_status === 'generating').length,
    failed: demos.filter(d => d.generation_status === 'failed').length,
  };

  const getEngineBadge = (engine: string) => {
    if (engine === 'native') return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><Zap className="h-3 w-3 mr-1" />Brandaro Native</Badge>;
    if (engine === 'durable') return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Building2 className="h-3 w-3 mr-1" />Durable</Badge>;
    return <Badge variant="outline">{engine}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      ready: { variant: 'default', label: 'Ready' },
      generating: { variant: 'secondary', label: 'Generating...' },
      pending: { variant: 'outline', label: 'Pending' },
      failed: { variant: 'destructive', label: 'Failed' },
    };
    const s = map[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demo Generation Engine</h1>
          <p className="text-muted-foreground">Dual-engine demo generation — Brandaro Native + Durable Builder</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Engine:</span>
          <Select value={selectedEngine} onValueChange={(v) => setSelectedEngine(v as 'native' | 'durable')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="native">
                <span className="flex items-center gap-2"><Zap className="h-3 w-3" /> Brandaro Native</span>
              </SelectItem>
              <SelectItem value="durable">
                <span className="flex items-center gap-2"><Building2 className="h-3 w-3" /> Durable Builder</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Globe },
          { label: 'Native', value: stats.native, icon: Zap },
          { label: 'Durable', value: stats.durable, icon: Building2 },
          { label: 'Ready', value: stats.ready, icon: Sparkles },
          { label: 'Sent', value: stats.sent, icon: Send },
          { label: 'Viewed', value: stats.viewed, icon: Eye },
          { label: 'In Progress', value: stats.pending, icon: Clock },
          { label: 'Failed', value: stats.failed, icon: AlertTriangle },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-3 pb-3 px-3">
              <div className="flex items-center gap-1.5">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="demos">Generated Demos</TabsTrigger>
          <TabsTrigger value="queue">Generation Queue ({interestedLeads.length})</TabsTrigger>
          <TabsTrigger value="analytics">Engine Analytics</TabsTrigger>
        </TabsList>

        {/* Generated Demos Tab */}
        <TabsContent value="demos">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Demo Sites</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="generating">Generating</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={fetchDemos}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : demos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No demo sites yet. Mark leads as "interested" to trigger generation.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demos.map(demo => (
                      <TableRow key={demo.id}>
                        <TableCell className="font-medium">{demo.business_name}</TableCell>
                        <TableCell>{demo.industry || '—'}</TableCell>
                        <TableCell>{[demo.city, demo.state].filter(Boolean).join(', ') || '—'}</TableCell>
                        <TableCell>{getEngineBadge(demo.generation_engine)}</TableCell>
                        <TableCell>{getStatusBadge(demo.generation_status)}</TableCell>
                        <TableCell>{demo.view_count}</TableCell>
                        <TableCell>{demo.sent_at ? new Date(demo.sent_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {demo.demo_url && (
                            <Button variant="ghost" size="sm" onClick={() => window.open(demo.demo_url!, '_blank')}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          {demo.generation_status === 'ready' && !demo.sent_at && (
                            <Button size="sm" onClick={() => sendDemo(demo)}>
                              <Send className="h-3 w-3 mr-1" /> Send
                            </Button>
                          )}
                          {demo.generation_status === 'failed' && (
                            <Button size="sm" variant="outline" onClick={() => generateDemo(demo.lead_id, 'native')}>
                              <RefreshCw className="h-3 w-3 mr-1" /> Retry Native
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generation Queue Tab */}
        <TabsContent value="queue">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Interested Leads — Awaiting Demo</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchInterestedLeads}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {interestedLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Cpu className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No interested leads waiting for demo generation.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Generate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interestedLeads.map(lead => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.business_name}</TableCell>
                        <TableCell>{lead.industry || '—'}</TableCell>
                        <TableCell>{[lead.city, lead.state].filter(Boolean).join(', ') || '—'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            onClick={() => generateDemo(lead.id, 'native')}
                            disabled={generating === lead.id}
                          >
                            {generating === lead.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                            Native
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateDemo(lead.id, 'durable')}
                            disabled={generating === lead.id}
                          >
                            {generating === lead.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Building2 className="h-3 w-3 mr-1" />}
                            Durable
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

        {/* Engine Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Native Engine Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-emerald-500" /> Brandaro Native Engine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Demos Generated</p>
                    <p className="text-2xl font-bold text-foreground">{nativeDemos.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ready</p>
                    <p className="text-2xl font-bold text-foreground">{nativeDemos.filter(d => d.generation_status === 'ready').length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p className="text-2xl font-bold text-foreground">{nativeDemos.filter(d => d.sent_at).length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Viewed</p>
                    <p className="text-2xl font-bold text-foreground">{nativeDemos.filter(d => d.view_count > 0).length}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-xs text-muted-foreground">Avg Generation Time</p>
                  <p className="text-lg font-semibold text-emerald-500">&lt; 3 seconds</p>
                </div>
              </CardContent>
            </Card>

            {/* Durable Engine Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-500" /> Durable Builder</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Demos Generated</p>
                    <p className="text-2xl font-bold text-foreground">{durableDemos.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ready</p>
                    <p className="text-2xl font-bold text-foreground">{durableDemos.filter(d => d.generation_status === 'ready').length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-foreground">{durableDemos.filter(d => d.engine_status === 'pending').length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-foreground">{durableDemos.filter(d => d.generation_status === 'failed').length}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm text-blue-500 font-medium">API integration scaffold ready — awaiting Durable.co credentials</p>
                </div>
              </CardContent>
            </Card>

            {/* Engine Comparison */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Engine Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Brandaro Native</TableHead>
                      <TableHead>Durable Builder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Total Generated</TableCell>
                      <TableCell>{nativeDemos.length}</TableCell>
                      <TableCell>{durableDemos.length}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Success Rate</TableCell>
                      <TableCell>{nativeDemos.length > 0 ? Math.round((nativeDemos.filter(d => d.generation_status === 'ready').length / nativeDemos.length) * 100) : 0}%</TableCell>
                      <TableCell>{durableDemos.length > 0 ? Math.round((durableDemos.filter(d => d.generation_status === 'ready').length / durableDemos.length) * 100) : 0}%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Demos Viewed</TableCell>
                      <TableCell>{nativeDemos.filter(d => d.view_count > 0).length}</TableCell>
                      <TableCell>{durableDemos.filter(d => d.view_count > 0).length}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Avg Views Per Demo</TableCell>
                      <TableCell>{nativeDemos.length > 0 ? (nativeDemos.reduce((a, d) => a + d.view_count, 0) / nativeDemos.length).toFixed(1) : '0'}</TableCell>
                      <TableCell>{durableDemos.length > 0 ? (durableDemos.reduce((a, d) => a + d.view_count, 0) / durableDemos.length).toFixed(1) : '0'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Generation Speed</TableCell>
                      <TableCell className="text-emerald-500 font-medium">Instant (&lt; 3s)</TableCell>
                      <TableCell className="text-blue-500 font-medium">~30-60s (API)</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
