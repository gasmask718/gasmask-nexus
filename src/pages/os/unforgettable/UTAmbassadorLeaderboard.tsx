
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Trophy, Medal } from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  starter: 'bg-orange-600', silver: 'bg-gray-400', gold: 'bg-yellow-500', platinum: 'bg-blue-400', legend: 'bg-purple-600',
};

export default function UTAmbassadorLeaderboard() {
  const [period, setPeriod] = useState('all');

  const { data: ambassadors } = useQuery({
    queryKey: ['ut-leaderboard'],
    queryFn: async () => {
      const { data } = await (supabase.from('unforgettable_ambassadors' as any).select('*').order('total_earnings', { ascending: false }) as any);
      return (data || []) as any[];
    },
  });

  const active = (ambassadors || []).filter((a: any) => a.status === 'active' || a.status === 'approved');
  const top3 = active.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🏆 Ambassador Leaderboard</h1>
        <p className="text-muted-foreground">Top performers this month</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{(ambassadors || []).length}</p><p className="text-xs text-muted-foreground">Total Ambassadors</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${active.reduce((s: number, a: any) => s + Number(a.total_earnings || 0), 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Paid Out</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${active.length > 0 ? Math.round(active.reduce((s: number, a: any) => s + Number(a.total_earnings || 0), 0) / active.length).toLocaleString() : 0}</p><p className="text-xs text-muted-foreground">Avg Per Ambassador</p></CardContent></Card>
      </div>

      {top3.length > 0 && (
        <div className="flex justify-center items-end gap-6 py-8">
          {top3[1] && (
            <div className="text-center">
              <div className="w-20 h-24 bg-gray-400/20 rounded-t-lg flex items-center justify-center"><Medal className="h-8 w-8 text-gray-400" /></div>
              <p className="font-semibold text-sm mt-1">{top3[1].full_name || top3[1].name}</p>
              <p className="text-xs text-muted-foreground">${Number(top3[1].total_earnings || 0).toLocaleString()}</p>
              <Badge className="mt-1">🥈 2nd</Badge>
            </div>
          )}
          {top3[0] && (
            <div className="text-center">
              <div className="w-24 h-32 bg-yellow-500/20 rounded-t-lg flex items-center justify-center"><Trophy className="h-10 w-10 text-yellow-500" /></div>
              <p className="font-bold mt-1">{top3[0].full_name || top3[0].name}</p>
              <p className="text-xs text-muted-foreground">${Number(top3[0].total_earnings || 0).toLocaleString()}</p>
              <Badge className="mt-1 bg-yellow-500 text-white">🥇 1st</Badge>
            </div>
          )}
          {top3[2] && (
            <div className="text-center">
              <div className="w-20 h-20 bg-orange-500/20 rounded-t-lg flex items-center justify-center"><Medal className="h-8 w-8 text-orange-600" /></div>
              <p className="font-semibold text-sm mt-1">{top3[2].full_name || top3[2].name}</p>
              <p className="text-xs text-muted-foreground">${Number(top3[2].total_earnings || 0).toLocaleString()}</p>
              <Badge className="mt-1">🥉 3rd</Badge>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Full Leaderboard</CardTitle>
          <div className="flex gap-2">
            {['all', 'this_month'].map(p => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)} className="capitalize">{p.replace('_', ' ')}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Tier</TableHead>
              <TableHead>Bookings</TableHead><TableHead>Earned</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {active.map((a: any, i: number) => (
                <TableRow key={a.id}>
                  <TableCell className="font-bold">{i + 1}</TableCell>
                  <TableCell className="font-medium">{a.full_name || a.name}</TableCell>
                  <TableCell><Badge className={`${TIER_COLORS[a.tier || 'starter']} text-white`}>{a.tier || 'starter'}</Badge></TableCell>
                  <TableCell>{a.total_referrals || 0}</TableCell>
                  <TableCell className="text-green-500 font-semibold">${Number(a.total_earnings || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
