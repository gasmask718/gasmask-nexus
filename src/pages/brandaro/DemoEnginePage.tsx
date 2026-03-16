import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wand2, Eye, Send, RefreshCw, Globe, Clock, ExternalLink, Loader2 } from 'lucide-react';

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
  view_count: number;
  last_viewed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

const PACKAGE_SERVICES: Record<string, string[]> = {
  plumber: ['Emergency Plumbing', 'Drain Cleaning', 'Water Heater Repair', 'Pipe Installation'],
  hvac: ['AC Repair', 'Heating Installation', 'Duct Cleaning', 'Maintenance Plans'],
  roofing: ['Roof Repair', 'Roof Replacement', 'Storm Damage', 'Free Inspections'],
  electrician: ['Electrical Repair', 'Panel Upgrades', 'Wiring', 'Lighting Installation'],
  landscaping: ['Lawn Care', 'Tree Trimming', 'Hardscaping', 'Irrigation'],
  restaurant: ['Dine-In', 'Takeout', 'Catering', 'Private Events'],
  default: ['Professional Services', 'Free Consultation', 'Licensed & Insured', 'Customer Satisfaction'],
};

export default function DemoEnginePage() {
  const [demos, setDemos] = useState<DemoSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const fetchDemos = async () => {
    setLoading(true);
    let query = (supabase as any).from('brandaro_demo_sites').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('generation_status', filter);
    const { data, error } = await query;
    if (!error) setDemos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDemos(); }, [filter]);

  const generateDemo = async (leadId: string) => {
    setGenerating(leadId);
    try {
      // Fetch lead data
      const { data: lead } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (!lead) throw new Error('Lead not found');

      const industry = (lead.industry || 'default').toLowerCase();
      const services = PACKAGE_SERVICES[industry] || PACKAGE_SERVICES.default;

      // Create demo record (Durable.co API integration point)
      const { data: demo, error } = await (supabase as any)
        .from('brandaro_demo_sites')
        .insert({
          lead_id: leadId,
          business_name: lead.business_name,
          industry: lead.industry,
          city: lead.city,
          state: lead.state,
          services_inferred: services,
          seo_text: `${lead.business_name} provides top-quality ${industry} services in ${lead.city}, ${lead.state}. Contact us today for a free estimate.`,
          generation_status: 'ready', // Will be 'generating' when Durable API is live
          demo_url: `https://demo.brandaro.com/${Date.now()}`, // Placeholder until Durable integration
        })
        .select()
        .single();

      if (error) throw error;

      // Update lead status
      await (supabase as any)
        .from('brandaro_qualified_leads')
        .update({ demo_status: 'generated' })
        .eq('id', leadId);

      toast.success(`Demo generated for ${lead.business_name}`);
      fetchDemos();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate demo');
    } finally {
      setGenerating(null);
    }
  };

  const sendDemo = async (demo: DemoSite) => {
    try {
      await (supabase as any)
        .from('brandaro_demo_sites')
        .update({ sent_at: new Date().toISOString(), delivery_method: 'sms' })
        .eq('id', demo.id);

      // Schedule follow-up sequence
      const followupTimes = [6, 24, 72]; // hours
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

      // Update lead
      await (supabase as any)
        .from('brandaro_qualified_leads')
        .update({ demo_status: 'sent' })
        .eq('id', demo.lead_id);

      toast.success(`Demo sent to ${demo.business_name} with follow-up sequence scheduled`);
      fetchDemos();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send demo');
    }
  };

  const stats = {
    total: demos.length,
    pending: demos.filter(d => d.generation_status === 'pending').length,
    ready: demos.filter(d => d.generation_status === 'ready').length,
    sent: demos.filter(d => d.sent_at).length,
    viewed: demos.filter(d => d.view_count > 0).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Demo Generation Engine</h1>
        <p className="text-muted-foreground">Automatically create tailored demo websites for interested prospects</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Demos', value: stats.total, icon: Globe },
          { label: 'Pending', value: stats.pending, icon: Clock },
          { label: 'Ready', value: stats.ready, icon: Wand2 },
          { label: 'Sent', value: stats.sent, icon: Send },
          { label: 'Viewed', value: stats.viewed, icon: Eye },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
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
                    <TableCell>
                      <Badge variant={
                        demo.generation_status === 'ready' ? 'default' :
                        demo.generation_status === 'generating' ? 'secondary' :
                        demo.generation_status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {demo.generation_status}
                      </Badge>
                    </TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
