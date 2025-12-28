import { Shield, MapPin } from 'lucide-react';
import { useStateCompliance, STATE_LABELS, FORMAT_LABELS } from '@/hooks/useStateCompliance';

export function ComplianceBanner() {
  const { currentState, currentStateRules } = useStateCompliance();

  if (!currentStateRules) return null;

  const formatsAvailable = currentStateRules.enabled_formats
    .map(f => FORMAT_LABELS[f])
    .join(', ');

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg border text-xs">
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Compliance</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>State: <strong className="text-foreground">{STATE_LABELS[currentState]}</strong></span>
      </div>
      <div className="text-muted-foreground">
        Formats available: <strong className="text-foreground">{formatsAvailable}</strong>
      </div>
    </div>
  );
}
