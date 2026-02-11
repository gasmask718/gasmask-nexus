import { Badge } from '@/components/ui/badge';
import { Wrench } from 'lucide-react';

interface InvoiceRepairBannerProps {
  repairStatus: string | null;
  repairNotes: string | null;
  repairedAt: string | null;
}

export function InvoiceRepairBanner({ repairStatus, repairNotes, repairedAt }: InvoiceRepairBannerProps) {
  if (!repairStatus || repairStatus === 'none') return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <Wrench className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Repair Status:</span>
          <Badge variant={repairStatus === 'repaired' ? 'default' : 'secondary'}>
            {repairStatus}
          </Badge>
        </div>
        {repairNotes && (
          <p className="text-muted-foreground mt-1">{repairNotes}</p>
        )}
        {repairedAt && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Repaired: {new Date(repairedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
