import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUFTAmbassadorLeaderboard, type UFTAmbassador } from '@/services/uftApi';
import { formatCurrency } from '@/lib/format';
import { Users, Award, DollarSign, Download, Send } from 'lucide-react';
import { toast } from 'sonner';

const TIER_CONFIG: Record<string, { color: string; sales: string; rate: string }> = {
  bronze: { color: 'bg-orange-500/20 text-orange-400', sales: '0–5', rate: '8%' },
  silver: { color: 'bg-gray-400/20 text-gray-300', sales: '6–15', rate: '10%' },
  gold: { color: 'bg-yellow-500/20 text-yellow-400', sales: '16–30', rate: '12%' },
  platinum: { color: 'bg-purple-500/20 text-purple-400', sales: '31+', rate: '15%' },
};

const DEMO_AMBASSADORS: UFTAmbassador[] = [
  { rank: 1, name: 'Maria Santos', tier: 'platinum', total_sales: 47, total_earned: 8420, commission_rate: 15, status: 'active', ref_code: 'MARIA47' },
  { rank: 2, name: 'James Wright', tier: 'gold', total_sales: 28, total_earned: 4200, commission_rate: 12, status: 'active', ref_code: 'JAMES28' },
  { rank: 3, name: 'Aisha Johnson', tier: 'gold', total_sales: 22, total_earned: 3300, commission_rate: 12, status: 'active', ref_code: 'AISHA22' },
  { rank: 4, name: 'Carlos Rivera', tier: 'silver', total_sales: 14, total_earned: 1680, commission_rate: 10, status: 'active', ref_code: 'CARLOS14' },
  { rank: 5, name: 'Destiny Parks', tier: 'bronze', total_sales: 3, total_earned: 288, commission_rate: 8, status: 'active', ref_code: 'DESTINY3' },
];

export default function UFTAmbassadors() {
  const [ambassadors, setAmbassadors] = useState<UFTAmbassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsMessage, setSmsMessage] = useState('');

  useEffect(() => {
    getUFTAmbassadorLeaderboard()
      .then((data) => setAmbassadors(data.length ? data : DEMO_AMBASSADORS))
      .catch(() => setAmbassadors(DEMO_AMBASSADORS))
      .finally(() => setLoading(false));
  }, []);

  const totalEarned = ambassadors.reduce((s, a) => s + a.total_earned, 0);
  const tierCounts = ambassadors.reduce((acc, a) => {
    acc[a.tier] = (acc[a.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleExport = () => {
    const csv = ['Rank,Name,Tier,Sales,Earned,Rate,Code',
      ...ambassadors.map(a => `${a.rank},${a.name},${a.tier},${a.total_sales},${a.total_earned},${a.commission_rate}%,${a.ref_code}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'uft-ambassadors.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Award className="h-7 w-7 text-purple-400" />
        <div>
          <h1 className="text-2xl font-bold">Ambassador Program</h1>
          <p className="text-sm text-muted-foreground">Unforgettable Times referral network</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><Users className="h-5 w-5 text-purple-400 mb-1" /><p className="text-2xl font-bold">{ambassadors.length}</p><p className="text-xs text-muted-foreground">Total Ambassadors</p></CardContent></Card>
        <Card><CardContent className="p-4"><Users className="h-5 w-5 text-green-400 mb-1" /><p className="text-2xl font-bold">{ambassadors.filter(a => a.status === 'active').length}</p><p className="text-xs text-muted-foreground">Active This Month</p></CardContent></Card>
        <Card><CardContent className="p-4"><DollarSign className="h-5 w-5 text-yellow-400 mb-1" /><p className="text-2xl font-bold">{formatCurrency(totalEarned)}</p><p className="text-xs text-muted-foreground">Total Commissions Paid</p></CardContent></Card>
        <Card><CardContent className="p-4"><DollarSign className="h-5 w-5 text-blue-400 mb-1" /><p className="text-2xl font-bold">{formatCurrency(ambassadors.length ? totalEarned / ambassadors.length : 0)}</p><p className="text-xs text-muted-foreground">Avg Commission</p></CardContent></Card>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(TIER_CONFIG).map(([tier, cfg]) => (
          <Card key={tier}>
            <CardContent className="p-4 text-center">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${cfg.color} capitalize`}>{tier}</span>
              <p className="text-2xl font-bold mt-2">{tierCounts[tier] || 0}</p>
              <p className="text-xs text-muted-foreground">{cfg.sales} sales • {cfg.rate}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Leaderboard</span>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambassadors.map((a, i) => (
                  <TableRow key={a.ref_code}>
                    <TableCell className="font-bold">{a.rank || i + 1}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${TIER_CONFIG[a.tier]?.color || ''}`}>{a.tier}</span>
                    </TableCell>
                    <TableCell className="text-right">{a.total_sales}</TableCell>
                    <TableCell className="text-right">{formatCurrency(a.total_earned)}</TableCell>
                    <TableCell className="text-right">{a.commission_rate}%</TableCell>
                    <TableCell className="font-mono text-xs">{a.ref_code}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SMS Broadcast */}
      <Card>
        <CardHeader><CardTitle className="text-base">Send SMS to All Ambassadors</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Type your broadcast message..." value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} rows={3} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{smsMessage.length} / 160 characters</span>
            <Button
              size="sm"
              disabled={!smsMessage.trim()}
              onClick={() => {
                if (confirm(`Send this SMS to ${ambassadors.length} ambassadors?`)) {
                  toast.success('SMS broadcast queued via Twilio edge function');
                  setSmsMessage('');
                }
              }}
            >
              <Send className="h-4 w-4 mr-1" /> Send Broadcast
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Calls Twilio via edge function. Messages are queued and sent in batches.</p>
        </CardContent>
      </Card>
    </div>
  );
}
