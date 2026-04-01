import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Target, Sparkles, Search, Instagram, Users, Mail, TrendingUp, CheckCircle, ArrowRight } from 'lucide-react';

const channels = [
  {
    title: '🤖 AI Event Planner',
    description: '"Plan Your Dream Event" on public site',
    status: 'live', statusLabel: '✅ Live',
    detail: 'Customers use the AI planner to instantly build their event. Converts visitors to bookings.'
  },
  {
    title: '🔍 Google Search Leads',
    description: 'People searching "event venues Brooklyn", "birthday party planner NYC" etc',
    status: 'pending', statusLabel: '⚠️ Connect Google Ads',
    detail: 'Set up Google Ads to capture high-intent search traffic. $5-15 per lead.'
  },
  {
    title: '📸 Social Media Leads',
    description: 'People posting about planning events — Instagram/TikTok hashtag monitoring',
    status: 'pending', statusLabel: '⚠️ Connect PhantomBuster',
    detail: 'Monitor #planninganEvent #birthdayParty and proactively reach out.'
  },
  {
    title: '🤝 Referral Program',
    description: 'Ambassadors referring direct customers — 15% commission per booking',
    status: 'live', statusLabel: '✅ Active via ambassador program',
    detail: 'Ambassador referral links are tracked automatically. Commissions calculated on every booking.'
  }
];

const funnelSteps = [
  { label: 'Awareness', value: '—', desc: 'Social, ads, word of mouth' },
  { label: 'Interest', value: '—', desc: 'Visit site, explore' },
  { label: 'Plan Event', value: '—', desc: 'Use AI planner' },
  { label: 'Book Event', value: '—', desc: 'Submit booking' },
  { label: 'Repeat', value: '—', desc: 'Book again' },
];

const emailNurture = [
  { trigger: 'Planned but didn\'t book', subject: 'Your event plan is waiting!', delay: '24 hours after plan created' },
  { trigger: 'Booked — upsell', subject: 'Add DJ + Photo to your event — 20% off', delay: '2 days after booking' },
  { trigger: 'Event completed', subject: 'How was your event? Refer a friend, earn $50', delay: '1 day after event date' },
];

export default function UTCustomerAcquisition() {
  const { data: campaign } = useQuery({
    queryKey: ['ut-customer-campaign'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_campaigns').select('*')
        .eq('audience_type', 'direct_customer').single();
      return data;
    }
  });

  const { data: customerLeads = [] } = useQuery({
    queryKey: ['ut-customer-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_leads').select('*')
        .eq('lead_type', 'direct_customer').order('score', { ascending: false }).limit(50);
      return data || [];
    }
  });

  const runCustomerEmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ut-growth-engine', {
        body: { action: 'run_email_outreach', audience_type: 'direct_customer', limit: 100 }
      });
      if (error) throw error;
      toast.success('📧 Customer emails sent', { description: `Sent: ${data?.sent || 0}` });
    } catch (err: any) {
      toast.error('❌ Failed', { description: err.message });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🎯 Direct Customer Acquisition</h1>
          <p className="text-muted-foreground">Find people actively planning events and convert them</p>
        </div>
        <Button onClick={runCustomerEmail}>📧 Run Email Campaign</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{campaign?.total_sent || 0}</p>
          <p className="text-xs text-muted-foreground">Emails Sent</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{campaign?.total_responses || 0}</p>
          <p className="text-xs text-muted-foreground">Responses</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{campaign?.total_conversions || 0}</p>
          <p className="text-xs text-muted-foreground">Conversions</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{customerLeads.length}</p>
          <p className="text-xs text-muted-foreground">Customer Leads</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels">📡 Channels</TabsTrigger>
          <TabsTrigger value="funnel">🔄 Funnel</TabsTrigger>
          <TabsTrigger value="nurture">📧 Nurture Emails</TabsTrigger>
          <TabsTrigger value="leads">👥 Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((ch, i) => (
              <Card key={i} className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{ch.title}</CardTitle>
                    <Badge className={ch.status === 'live' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                      {ch.statusLabel}
                    </Badge>
                  </div>
                  <CardDescription>{ch.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{ch.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="funnel">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Customer Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-stretch gap-2">
                {funnelSteps.map((step, i) => (
                  <div key={i} className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-muted/30 rounded p-4 text-center">
                      <p className="font-semibold text-sm">{step.label}</p>
                      <p className="text-2xl font-bold mt-1">{step.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                    </div>
                    {i < funnelSteps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden md:block" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nurture" className="space-y-4">
          {emailNurture.map((seq, i) => (
            <Card key={i} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Trigger: {seq.trigger}</CardTitle>
                  <Badge className="bg-blue-500/20 text-blue-400"><Mail className="h-3 w-3 mr-1" /> {seq.delay}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Subject: <span className="font-medium">{seq.subject}</span></p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="leads">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Name','Email','City','Grade','Status'].map(h => (
                      <th key={h} className="p-3 text-left text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-border/50">
                      <td className="p-3 font-medium">{lead.contact_name || lead.business_name || '-'}</td>
                      <td className="p-3 text-xs font-mono">{lead.email || '-'}</td>
                      <td className="p-3">{lead.city || '-'}</td>
                      <td className="p-3">
                        <Badge className={lead.grade === 'A' ? 'bg-green-500/20 text-green-400' : lead.grade === 'B' ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground'}>
                          {lead.grade === 'A' ? '🔥 A' : lead.grade === 'B' ? '⚡ B' : 'C'}
                        </Badge>
                      </td>
                      <td className="p-3"><Badge variant="outline">{lead.status}</Badge></td>
                    </tr>
                  ))}
                  {customerLeads.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No customer leads yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
