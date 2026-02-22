import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Clock, ArrowUpDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { WholesalerPayout } from '@/services/wholesaler/useWholesalerPayouts';

interface Props {
  payouts: WholesalerPayout[];
  isLoading: boolean;
}

export function PayoutLedgerAdvanced({ payouts, isLoading }: Props) {
  const [sortBy, setSortBy] = useState<'created_at' | 'amount'>('created_at');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const sorted = [...payouts].sort((a, b) => {
    if (sortBy === 'amount') {
      const diff = Number(a.net_amount || 0) - Number(b.net_amount || 0);
      return sortDir === 'asc' ? diff : -diff;
    }
    const diff = new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime();
    return sortDir === 'asc' ? diff : -diff;
  });

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const getCountdown = (releaseAt: string | null) => {
    if (!releaseAt) return null;
    const diff = new Date(releaseAt).getTime() - Date.now();
    if (diff <= 0) return 'Releasing...';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    approved_pending_delivery: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    in_settlement: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    approved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    held: 'bg-red-500/15 text-red-400 border-red-500/30',
    reversed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  };

  const exportCSV = () => {
    const headers = ['Order ID', 'Gross', 'Platform Fee', 'Net', 'Status', 'Created', 'Approved', 'Paid', 'Hold Reason', 'Reversal Reason'];
    const rows = payouts.map(p => [
      p.id.slice(0, 8),
      p.amount,
      p.platform_fee || 0,
      p.net_amount,
      p.status || '',
      p.created_at || '',
      p.approved_at || '',
      p.paid_at || '',
      p.hold_reason || '',
      p.reversal_reason || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Payout Ledger</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportCSV}>
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[60px_70px_60px_70px_90px_80px_70px_70px] gap-1 px-4 py-2 border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>ID</span>
          <button onClick={() => toggleSort('amount')} className="flex items-center gap-0.5">Gross <ArrowUpDown className="h-2.5 w-2.5" /></button>
          <span>Fee</span>
          <span>Net</span>
          <span>Status</span>
          <span>Settlement</span>
          <span>Approved</span>
          <span>Paid</span>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No payouts</div>
          ) : sorted.map(p => (
            <div key={p.id} className="grid grid-cols-[60px_70px_60px_70px_90px_80px_70px_70px] gap-1 px-4 py-2 border-b border-border/20 items-center text-xs hover:bg-muted/20 transition-colors">
              <span className="font-mono text-[10px]">#{p.id.slice(0, 6)}</span>
              <span className="font-medium">${Number(p.amount || 0).toFixed(0)}</span>
              <span className="text-red-400/70">-${Number(p.platform_fee || 0).toFixed(0)}</span>
              <span className="font-semibold">${Number(p.net_amount || 0).toFixed(0)}</span>
              <Badge className={`text-[9px] h-4 ${statusColor[p.status || ''] || ''}`}>
                {(p.status || 'pending').replace(/_/g, ' ')}
              </Badge>
              <span className="text-[10px]">
                {p.status === 'in_settlement' && p.settlement_release_at ? (
                  <span className="flex items-center gap-0.5 text-cyan-400">
                    <Clock className="h-2.5 w-2.5" />
                    {getCountdown(p.settlement_release_at)}
                  </span>
                ) : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {p.approved_at ? format(new Date(p.approved_at), 'M/d') : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {p.paid_at ? format(new Date(p.paid_at), 'M/d') : '—'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
