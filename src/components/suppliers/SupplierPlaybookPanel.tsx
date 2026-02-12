import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface SupplierPlaybookPanelProps {
  riskBand?: string;
  recommendedAction?: string;
  forecastSeverity?: string;
  primaryRiskDriver?: string;
}

const playbookMap: Record<string, any> = {
  critical_price_lock: {
    posture: "Firm",
    postureTone: "We need pricing certainty. Here's what we propose.",
    objective: "Negotiate fixed pricing or pricing cap for 12+ months",
    redLines: [
      "No acceptance of quarterly repricing clauses",
      "Minimum volume commitment must have predictable cost anchor",
      "Force majeure exceptions only for documented external events",
    ],
    fallback: "Initiate secondary sourcing immediately; signal timeline to supplier",
  },
  critical_volume: {
    posture: "Collaborative",
    postureTone: "Volume stability is crucial for both of us.",
    objective: "Lock in MOQ and delivery consistency",
    redLines: [
      "No acceptance of force majeure for routine delays",
      "Lead time extensions require advance notice (2+ weeks)",
      "Downside risk (inflation) must be shared",
    ],
    fallback: "Activate dual-source plan; reduce dependency below 50%",
  },
  high_volatility: {
    posture: "Watchful",
    postureTone: "We have observed volatility and want a stable path forward.",
    objective: "Establish pricing band or index-linked formula",
    redLines: [
      "No blank-check increases without market evidence",
      "Price changes capped at industry index (CPI, commodity) + small margin",
    ],
    fallback: "Consider lower-volume contract with price cap; explore alternatives",
  },
  high_margin: {
    posture: "Collaborative",
    postureTone: "We want to grow together, and this pricing enables that.",
    objective: "Negotiate volume discounts or SKU substitution",
    redLines: [
      "Margin structure must improve with volume",
      "No tier-down without corresponding volume commitment",
    ],
    fallback: "Evaluate product substitutes or alternative suppliers at similar cost",
  },
  low_reliability: {
    posture: "Firm",
    postureTone: "Reliability is non-negotiable for our operation.",
    objective: "Formalize SLA; trigger secondary sourcing if breached",
    redLines: [
      "On-time delivery minimum 95%",
      "Lead time variance < 5 days",
      "SLA breaches result in automatic order to secondary supplier",
    ],
    fallback: "Immediately split volume 50/50 with secondary supplier",
  },
  default: {
    posture: "Professional",
    postureTone: "Let us align on the path forward.",
    objective: "Optimize cost and reliability",
    redLines: [
      "Preserve flexibility to adjust volumes",
      "Maintain relationship with secondary suppliers",
    ],
    fallback: "Review alternative sourcing options",
  },
};

function getPlaybookKey(riskBand?: string, action?: string, severity?: string, driver?: string): string {
  // Map risk/action/forecast to playbook
  if (severity === 'critical') {
    if (action?.includes('price')) return 'critical_price_lock';
    if (action?.includes('volume')) return 'critical_volume';
    return 'critical_price_lock';
  }
  if (riskBand === 'critical' && driver?.includes('volatility')) return 'high_volatility';
  if (riskBand === 'critical' && driver?.includes('margin')) return 'high_margin';
  if (riskBand === 'risk' && driver?.includes('reliability')) return 'low_reliability';
  return 'default';
}

export function SupplierPlaybookPanel({
  riskBand,
  recommendedAction,
  forecastSeverity,
  primaryRiskDriver,
}: SupplierPlaybookPanelProps) {
  const key = getPlaybookKey(riskBand, recommendedAction, forecastSeverity, primaryRiskDriver);
  const playbook = playbookMap[key];

  const postureColors: Record<string, string> = {
    Firm: 'bg-red-100 text-red-800',
    Collaborative: 'bg-blue-100 text-blue-800',
    Watchful: 'bg-yellow-100 text-yellow-800',
    Professional: 'bg-gray-100 text-gray-800',
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Negotiation Playbook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Posture */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">POSTURE</span>
          </div>
          <div className="pl-6">
            <Badge className={postureColors[playbook.posture] || postureColors.Professional}>
              {playbook.posture}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">{playbook.postureTone}</p>
          </div>
        </div>

        {/* Objective */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">PRIMARY OBJECTIVE</span>
          </div>
          <p className="text-sm font-medium pl-6">{playbook.objective}</p>
        </div>

        {/* Red Lines */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-semibold text-red-600">RED LINES (DO NOT ACCEPT)</span>
          </div>
          <div className="pl-6 space-y-1">
            {playbook.redLines.map((line: string, idx: number) => (
              <p key={idx} className="text-xs text-muted-foreground">
                • {line}
              </p>
            ))}
          </div>
        </div>

        {/* Fallback */}
        <div className="space-y-2 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-semibold text-orange-700">IF NEGOTIATION FAILS</span>
          </div>
          <p className="text-sm text-muted-foreground pl-6">{playbook.fallback}</p>
        </div>
      </CardContent>
    </Card>
  );
}
