
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Mail, Instagram, Send, Copy, ArrowRight, Clock, Users, Building, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AMBASSADOR_TEMPLATES = [
  {
    channel: 'instagram_dm',
    icon: <Instagram className="h-4 w-4 text-pink-400" />,
    label: 'Instagram DM',
    subject: '',
    body: `Hey [name]! 👋 We noticed your amazing content in [city]. We're building our ambassador team for Unforgettable Times — the #1 event platform in [city]. Earn 15-25% on every booking you refer! Interested? Apply here: [link]`
  },
  {
    channel: 'sms',
    icon: <MessageSquare className="h-4 w-4 text-green-400" />,
    label: 'SMS',
    subject: '',
    body: `Hi [name]! Unforgettable Times here 🎉 We'd love to have you as an ambassador in [city]. Earn $500+/month sharing events you already love. Apply: [link]`
  },
  {
    channel: 'email',
    icon: <Mail className="h-4 w-4 text-blue-400" />,
    label: 'Email',
    subject: 'Earn $500+/month as an Unforgettable Times Ambassador',
    body: `Hi [name],\n\nI'm reaching out because we're expanding Unforgettable Times to [city] and we're looking for passionate ambassadors who love events.\n\nAs an ambassador, you'll:\n• Earn 15-25% commission on every booking\n• Get free access to premium events\n• Join our exclusive ambassador community\n• Receive your own branded referral link\n\nTop ambassadors are earning $2,000+/month just by sharing events they already attend!\n\nInterested? Apply in 2 minutes: [link]\n\nBest,\nUnforgettable Times Team`
  },
];

const VENUE_TEMPLATES = [
  {
    channel: 'email',
    icon: <Mail className="h-4 w-4 text-blue-400" />,
    label: 'Venue Partnership Email',
    subject: 'Partnership Opportunity — Unforgettable Times',
    body: `Hi [name],\n\nI'm reaching out from Unforgettable Times, the fastest-growing event platform in [city].\n\nWe'd love to feature [business_name] on our platform and drive bookings your way.\n\nWhat we offer:\n• Zero upfront cost — we only earn when you earn\n• Professional listing with photos & 3D tour\n• Access to our 50,000+ event planners\n• Dedicated account manager\n\nWould you be open to a quick 10-minute call this week?\n\nBest,\nUnforgettable Times Team`
  },
];

const STAFF_TEMPLATES = [
  {
    channel: 'sms',
    icon: <MessageSquare className="h-4 w-4 text-green-400" />,
    label: 'Staff Recruitment SMS',
    subject: '',
    body: `Hey [name]! 🎉 Unforgettable Times is hiring event staff in [city]. Flexible hours, $25-45/hr, weekly pay. DJs, photographers, caterers welcome! Apply: [link]`
  },
];

export default function UTOutreachEngine() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('ambassador');

  const { data: sequences = [] } = useQuery({
    queryKey: ['ut-outreach-sequences'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_outreach_sequences').select('*, ut_leads(business_name, contact_name, email, phone)').order('created_at', { ascending: false }).limit(100);
      return (data || []) as any[];
    }
  });

  useEffect(() => {
    const channel = supabase.channel('ut-outreach-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_outreach_sequences' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ut-outreach-sequences'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const copyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Template copied!');
  };

  const renderTemplates = (templates: typeof AMBASSADOR_TEMPLATES) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {templates.map((t, i) => (
        <Card key={i} className="hover:border-pink-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {t.icon} {t.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {t.subject && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                <p className="text-sm font-medium">{t.subject}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Message:</p>
              <Textarea value={t.body} readOnly className="text-xs min-h-[120px] resize-none" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyTemplate(t.body)}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700">
                <Send className="h-3 w-3 mr-1" /> Use Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Send className="h-7 w-7 text-pink-500" />
          Outreach Engine
        </h1>
        <p className="text-muted-foreground">Multi-channel outreach templates & sequence builder</p>
      </div>

      {/* Outreach Templates */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ambassador" className="flex items-center gap-1"><Star className="h-3 w-3" /> Ambassador</TabsTrigger>
          <TabsTrigger value="venue" className="flex items-center gap-1"><Building className="h-3 w-3" /> Venue</TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-1"><Users className="h-3 w-3" /> Staff</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1"><Clock className="h-3 w-3" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="ambassador" className="mt-4">
          <h2 className="text-lg font-semibold mb-3">🌟 Ambassador Outreach Templates</h2>
          {renderTemplates(AMBASSADOR_TEMPLATES)}
        </TabsContent>

        <TabsContent value="venue" className="mt-4">
          <h2 className="text-lg font-semibold mb-3">🏢 Venue Partnership Templates</h2>
          {renderTemplates(VENUE_TEMPLATES)}
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <h2 className="text-lg font-semibold mb-3">👥 Staff Recruitment Templates</h2>
          {renderTemplates(STAFF_TEMPLATES)}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Outreach History</CardTitle>
            </CardHeader>
            <CardContent>
              {sequences.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No outreach sent yet</p>
                  <p className="text-xs mt-1">Select leads in Lead Intelligence and fire outreach</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sequences.map((seq: any) => (
                      <TableRow key={seq.id}>
                        <TableCell className="text-sm">{(seq.ut_leads as any)?.business_name || (seq.ut_leads as any)?.contact_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{seq.channel}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">Step {seq.step_number}</TableCell>
                        <TableCell className="text-xs">{seq.sent_at ? format(new Date(seq.sent_at), 'MMM d, yyyy, h:mm a') : '—'}</TableCell>
                        <TableCell>
                          <Badge className={seq.status === 'sent' ? 'bg-green-500/20 text-green-400' : seq.status === 'replied' ? 'bg-purple-500/20 text-purple-400' : 'bg-muted text-muted-foreground'}>
                            {seq.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sequence Builder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">🔄 Sequence Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 overflow-x-auto py-4">
            <div className="flex-shrink-0 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 min-w-[180px] text-center">
              <p className="text-xs text-muted-foreground">Day 1</p>
              <p className="font-semibold text-sm mt-1">📱 SMS</p>
              <p className="text-xs text-muted-foreground mt-1">Introduction message</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-shrink-0 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 min-w-[180px] text-center">
              <p className="text-xs text-muted-foreground">Day 3</p>
              <p className="font-semibold text-sm mt-1">📧 Email</p>
              <p className="text-xs text-muted-foreground mt-1">Follow-up with details</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-shrink-0 bg-pink-500/10 border border-pink-500/30 rounded-lg p-4 min-w-[180px] text-center">
              <p className="text-xs text-muted-foreground">Day 7</p>
              <p className="font-semibold text-sm mt-1">📸 Instagram DM</p>
              <p className="text-xs text-muted-foreground mt-1">Personal touch + invite</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">💡 Sequences auto-fire based on lead status. Connect SendGrid to activate email automation.</p>
        </CardContent>
      </Card>
    </div>
  );
}
