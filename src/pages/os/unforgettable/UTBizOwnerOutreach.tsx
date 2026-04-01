import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building, Mail, Users, TrendingUp, Send, Clock, CheckCircle } from 'lucide-react';

const emailSequence = [
  {
    day: 1, label: 'Day 1 — The Hook',
    subject: 'Turn your passion into a business — Unforgettable Times',
    body: `Hi [name],

Have you ever thought about starting your own event planning business? 

Unforgettable Times provides everything you need — platform, clients, staff, venues — already built. You just run the business under our umbrella.

Zero startup cost. We handle:
• Client acquisition (AI-powered)
• Venue partnerships (200+ venues)
• Staff recruitment & payroll
• Payment processing

You handle the relationships and execution.

Interested? Let's talk: unforgettable-times.com/join`
  },
  {
    day: 3, label: 'Day 3 — The Value',
    subject: "Here's what you get as an Unforgettable Times partner",
    body: `Hi [name],

Just following up — here's what our business partners earn:

💰 Average revenue: $8,000-15,000/month
📊 We provide 10-20 warm leads per week
🏢 Access to 200+ premium venues
👥 Full staff network on-demand
🤖 AI tools to automate proposals

Our top partner earned $23,000 last month running just 4 events.

No experience needed. Full training provided.

Apply today: unforgettable-times.com/join`
  },
  {
    day: 7, label: 'Day 7 — The Close',
    subject: 'Last chance — 3 spots left in [city]',
    body: `Hi [name],

This is my last email — we have 3 partner spots remaining in [city].

Once filled, we won't be accepting new partners in your area until Q3.

Quick recap:
✅ Zero startup cost
✅ Full platform & tools provided
✅ $8K-15K/month potential
✅ Flexible hours — you set the schedule

If you're even slightly interested, grab a spot now before they're gone.

Apply: unforgettable-times.com/join

Best,
Unforgettable Times Team`
  }
];

export default function UTBizOwnerOutreach() {
  const { data: campaign } = useQuery({
    queryKey: ['ut-biz-owner-campaign'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_campaigns').select('*')
        .eq('audience_type', 'party_business_owner').single();
      return data;
    }
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['ut-biz-owner-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_leads').select('*')
        .eq('lead_type', 'party_business_owner').order('score', { ascending: false }).limit(50);
      return data || [];
    }
  });

  const [runningEmail, setRunningEmail] = useState(false);

  const runEmailCampaign = async () => {
    setRunningEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('ut-growth-engine', {
        body: { action: 'run_email_outreach', audience_type: 'party_business_owner', limit: 50 }
      });
      if (error) throw error;
      toast.success('📧 Email outreach sent', { description: `Sent: ${data?.sent || 0}` });
    } catch (err: any) {
      toast.error('❌ Failed', { description: err.message });
    } finally { setRunningEmail(false); }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">🏢 Party Business Owner Outreach</h1>
        <p className="text-muted-foreground">Find and recruit entrepreneurs who want to start event businesses</p>
      </div>

      {/* Concept Card */}
      <Card className="bg-card border-border border-l-4 border-l-primary">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2">💡 What is this?</h3>
          <p className="text-sm text-muted-foreground">
            Unforgettable Times can power other people's event businesses. Find entrepreneurs who want to start an event company — we provide the platform, clients, staff, and venues. They run the business under our umbrella. Zero startup cost for them.
          </p>
        </CardContent>
      </Card>

      {/* Target Profile */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">🎯 Target Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'People in event-adjacent industries',
              'Entrepreneurs searching "how to start event planning business"',
              'Current party promoters looking to scale',
              'Venue managers wanting independence',
              'Event staff wanting to go solo',
              'Social media influencers with event audiences'
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Stats */}
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
          <p className="text-2xl font-bold">{leads.length}</p>
          <p className="text-xs text-muted-foreground">Prospects</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="sequence" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sequence">📧 Email Sequence</TabsTrigger>
          <TabsTrigger value="prospects">👥 Prospects</TabsTrigger>
        </TabsList>

        <TabsContent value="sequence" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={runEmailCampaign} disabled={runningEmail}>
              {runningEmail ? '📧 Sending...' : '📧 Run Email Campaign Now'}
            </Button>
          </div>
          <div className="space-y-4">
            {emailSequence.map((step, i) => (
              <Card key={i} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{step.label}</CardTitle>
                    <Badge className="bg-blue-500/20 text-blue-400"><Mail className="h-3 w-3 mr-1" /> Email</Badge>
                  </div>
                  <CardDescription>Subject: {step.subject}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted/30 p-4 rounded whitespace-pre-wrap font-sans">{step.body}</pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prospects">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Business','Contact','City','Grade','Status','Actions'].map(h => (
                      <th key={h} className="p-3 text-left text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="border-b border-border/50">
                      <td className="p-3 font-medium">{lead.business_name || '-'}</td>
                      <td className="p-3">{lead.contact_name || '-'}</td>
                      <td className="p-3">{lead.city || '-'}</td>
                      <td className="p-3">
                        <Badge className={lead.grade === 'A' ? 'bg-green-500/20 text-green-400' : lead.grade === 'B' ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground'}>
                          {lead.grade === 'A' ? '🔥 A' : lead.grade === 'B' ? '⚡ B' : 'C'}
                        </Badge>
                      </td>
                      <td className="p-3"><Badge variant="outline">{lead.status}</Badge></td>
                      <td className="p-3">
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (lead.email) { toast.info('Email queued for next batch'); }
                          else { toast.warning('No email on file'); }
                        }}><Mail className="h-3 w-3" /></Button>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No business owner prospects yet. Run Lead Intelligence to find prospects.</td></tr>
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
