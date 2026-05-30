import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { WholesalerPayout } from '@/services/wholesaler/useWholesalerPayouts';

interface Props {
  payouts: WholesalerPayout[];
}

export function SettlementDetail({ payouts }: Props) {
  const inSettlement = payouts.filter(p => p.status === 'in_settlement');
  if (inSettlement.length === 0) return null;

  const getCountdown = (releaseAt: string | null) => {
    if (!releaseAt) return { text: '—', urgent: false };
    const diff = new Date(releaseAt).getTime() - Date.now();
    if (diff <= 0) return { text: 'Releasing...', urgent: false };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { text: `${h}h ${m}m`, urgent: h < 6 };
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          Funds In Settlement ({inSettlement.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[70px_100px_100px_110px_80px_80px] gap-2 px-4 py-2 border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Payout</span>
          <span>Delivery Date</span>
          <span>Settlement Start</span>
          <span>Release At</span>
          <span>Countdown</span>
          <span>Amount</span>
        </div>

        <div className="max-h-[280px] overflow-y-auto">
          {inSettlement.map(p => {
            const countdown = getCountdown(p.settlement_release_at);

            return (
              <div key={p.id} className="grid grid-cols-[70px_100px_100px_110px_80px_80px] gap-2 px-4 py-2.5 border-b border-border/20 items-center text-xs hover:bg-muted/20 transition-colors">
                <span className="font-mono text-[10px] font-medium">#{p.id.slice(0, 6)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {p.settlement_start_at ? format(new Date(p.settlement_start_at), 'MMM d, yyyy, h:mm a') : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {p.settlement_start_at ? format(new Date(p.settlement_start_at), 'MMM d, yyyy, h:mm a') : '—'}
                </span>
                <span className="text-[10px] font-medium">
                  {p.settlement_release_at ? format(new Date(p.settlement_release_at), 'MMM d, yyyy h:mm a') : '—'}
                </span>
                <span className={`font-mono font-bold text-xs ${countdown.urgent ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {countdown.text}
                </span>
                <span className="font-semibold">${Number(p.net_amount || 0).toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
