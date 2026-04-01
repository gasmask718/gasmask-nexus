
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UTCampaignPerformance() {
  const { data: sequences } = useQuery({
    queryKey: ['ut-campaigns'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_outreach_sequences' as any).select('*').order('created_at', { ascending: false }) as any);
      return (data || []) as any[];
    },
  });

  const { data: automations } = useQuery({
    queryKey: ['ut-auto-runs'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_automation_runs' as any).select('*').order('created_at', { ascending: false }).limit(20) as any);
      return (data || []) as any[];
    },
  });

  const smsCampaigns = (sequences || []).filter((s: any) => s.channel === 'sms');
  const emailCampaigns = (sequences || []).filter((s: any) => s.channel === 'email');
  const dmCampaigns = (sequences || []).filter((s: any) => s.channel === 'instagram_dm');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📊 Campaign Performance</h1>
        <p className="text-muted-foreground">Which outreach campaigns are actually converting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-semibold">📱 SMS Campaigns</p>
            <p className="text-3xl font-bold">{smsCampaigns.length}</p>
            <p className="text-xs text-muted-foreground">Active sequences</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-semibold">📧 Email Campaigns</p>
            <p className="text-3xl font-bold">{emailCampaigns.length}</p>
            <p className="text-xs text-muted-foreground">Active sequences</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-semibold">📸 Instagram DM</p>
            <p className="text-3xl font-bold">{dmCampaigns.length}</p>
            <p className="text-xs text-muted-foreground">Active sequences</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Campaigns</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Campaign</TableHead><TableHead>Channel</TableHead><TableHead>Target</TableHead>
              <TableHead>Status</TableHead><TableHead>Steps</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(sequences || []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No campaigns yet</TableCell></TableRow>
              ) : (sequences || []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="capitalize">{s.channel}</TableCell>
                  <TableCell className="capitalize">{s.target_audience}</TableCell>
                  <TableCell>{s.is_active ? '🟢 Active' : '⚪ Paused'}</TableCell>
                  <TableCell>{(s.steps || []).length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Automation Runs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Job</TableHead><TableHead>Status</TableHead><TableHead>Records</TableHead><TableHead>Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(automations || []).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.job_name}</TableCell>
                  <TableCell>{a.status === 'completed' ? '✅' : a.status === 'failed' ? '❌' : '🔄'} {a.status}</TableCell>
                  <TableCell>{a.records_processed || 0}</TableCell>
                  <TableCell className="text-xs">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
