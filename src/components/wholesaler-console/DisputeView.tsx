import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { VendorDispute } from '@/services/wholesaler/useWholesalerDisputes';

interface Props {
  disputes: VendorDispute[];
  isLoading: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  opened: { label: 'Open', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', icon: AlertTriangle },
  under_review: { label: 'Under Review', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', icon: Clock },
  resolved_customer: { label: 'Resolved — Customer', color: 'text-zinc-400', bg: 'bg-zinc-500/15 border-zinc-500/30', icon: ShieldAlert },
  resolved_vendor: { label: 'Resolved — Vendor', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle2 },
};

export function DisputeView({ disputes, isLoading }: Props) {
  if (isLoading) return null;
  if (disputes.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          Disputes ({disputes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Header */}
        <div className="grid grid-cols-[70px_1fr_100px_100px_100px_80px] gap-2 px-4 py-2 border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Order</span>
          <span>Reason</span>
          <span>Status</span>
          <span>Opened</span>
          <span>Resolved</span>
          <span>Amount</span>
        </div>

        <div className="max-h-[280px] overflow-y-auto">
          {disputes.map(d => {
            const cfg = statusConfig[d.disputeStatus] || statusConfig.opened;
            const Icon = cfg.icon;

            return (
              <div key={d.orderId} className="grid grid-cols-[70px_1fr_100px_100px_100px_80px] gap-2 px-4 py-2.5 border-b border-border/20 items-center text-xs hover:bg-muted/20 transition-colors">
                <span className="font-mono text-[10px] font-medium">#{d.orderIdShort}</span>
                <div className="min-w-0">
                  <p className="text-sm truncate">{d.disputeReason || 'No reason provided'}</p>
                  {d.holdReason && (
                    <p className="text-[10px] text-muted-foreground truncate">Hold: {d.holdReason}</p>
                  )}
                  {d.reversalReason && (
                    <p className="text-[10px] text-red-400/70 truncate">Reversal: {d.reversalReason}</p>
                  )}
                </div>
                <Badge className={`text-[9px] h-5 ${cfg.bg} ${cfg.color}`}>
                  <Icon className="h-2.5 w-2.5 mr-0.5" />
                  {cfg.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {d.disputeOpenedAt ? format(new Date(d.disputeOpenedAt), 'MMM d, yyyy') : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {d.disputeResolvedAt ? format(new Date(d.disputeResolvedAt), 'MMM d, yyyy') : '—'}
                </span>
                <span className="font-medium">${d.amount.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
