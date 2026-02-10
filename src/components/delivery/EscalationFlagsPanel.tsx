import { useEscalationFlags } from '@/hooks/useEscalationFlags';
import { EscalationFlagBadge } from './EscalationFlagBadge';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EscalationFlagsPanelProps {
  storeId: string;
  className?: string;
}

/**
 * Read-only escalation flags panel. Renders derived warning signals.
 * No enforcement, no blocking, no automation. Visual awareness only.
 */
export function EscalationFlagsPanel({ storeId, className }: EscalationFlagsPanelProps) {
  const { data: flags, isLoading } = useEscalationFlags(storeId);

  if (isLoading || !flags || flags.length === 0) return null;

  const highCount = flags.filter((f) => f.severity === 'high').length;

  return (
    <div className={`p-2.5 rounded-lg border-2 border-red-500/30 bg-red-500/5 space-y-1.5 ${className || ''}`}>
      <div className="flex items-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-red-700">
          Escalation Signals
        </span>
        {highCount > 0 && (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
            {highCount} high
          </Badge>
        )}
      </div>
      {flags.map((flag) => (
        <EscalationFlagBadge key={flag.flag_type} flag={flag} />
      ))}
    </div>
  );
}
