import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  totalLiability: number;
  itemCount: number;
}

export function LiabilityBanner({ totalLiability, itemCount }: Props) {
  if (totalLiability <= 0) return null;

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/8 backdrop-blur-sm p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-red-500/15">
        <AlertTriangle className="h-5 w-5 text-red-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-400">Outstanding Liability</p>
        <p className="text-xs text-muted-foreground">
          {itemCount} unresolved item{itemCount !== 1 ? 's' : ''} — future payouts may be adjusted.
        </p>
      </div>
      <p className="text-2xl font-bold text-red-400">
        ${totalLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
