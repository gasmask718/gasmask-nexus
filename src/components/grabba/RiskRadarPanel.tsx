// ═══════════════════════════════════════════════════════════════════════════════
// RISK RADAR PANEL — Penthouse Dashboard Widget
// ═══════════════════════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';
import { useTopRisks, useRiskRadar } from '@/hooks/useRiskRadar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldAlert,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const RISK_LEVEL_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-muted text-muted-foreground',
};

const RISK_TYPE_ICONS: Record<string, React.ReactNode> = {
  churn: <TrendingDown className="h-4 w-4" />,
  non_payment: <DollarSign className="h-4 w-4" />,
  low_stock: <Package className="h-4 w-4" />,
  overworked: <Users className="h-4 w-4" />,
  inactive_ambassador: <Users className="h-4 w-4" />,
};

export function RiskRadarPanel() {
  const navigate = useNavigate();
  const { topRisks, loading: topLoading } = useTopRisks(5);
  const { summary, loading: summaryLoading } = useRiskRadar();

  const handleOpenRiskRadar = () => {
    navigate('/grabba/risk-radar');
  };

  const handleOpenPlaybooks = () => {
    navigate('/grabba/ai-playbooks');
  };

  const handleFixRisk = (riskType: string) => {
    const commands: Record<string, string> = {
      churn: 'Create a route for critical churn risk stores tomorrow at 10am',
      non_payment: 'Send payment reminders to all high-risk unpaid invoices',
      low_stock: 'Generate reorder list for critical low stock items',
      overworked: 'Redistribute routes from overworked drivers',
      inactive_ambassador: 'Send re-engagement messages to inactive ambassadors',
    };
    navigate(`/grabba/ai-console?command=${encodeURIComponent(commands[riskType] || '')}`);
  };

  const loading = topLoading || summaryLoading;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Risk Radar & Forecasts
            </CardTitle>
            <CardDescription>
              Live watchlist of your most vulnerable spots
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenPlaybooks}>
              <Sparkles className="h-4 w-4 mr-1" />
              Fix Playbooks
            </Button>
            <Button size="sm" onClick={handleOpenRiskRadar}>
              View Full Radar
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <div className="font-semibold">
                    {summary.byType.churn}
                  </div>
                  <div className="text-xs text-muted-foreground">Churn Risk Stores</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-red-500/10">
                  <DollarSign className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <div className="font-semibold">
                    {summary.byType.non_payment}
                  </div>
                  <div className="text-xs text-muted-foreground">High-Risk Invoices</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Package className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="font-semibold">
                    {summary.byType.low_stock}
                  </div>
                  <div className="text-xs text-muted-foreground">Low Stock Items</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-purple-500/10">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <div className="font-semibold">
                    {summary.byType.overworked + summary.byType.inactive_ambassador}
                  </div>
                  <div className="text-xs text-muted-foreground">Team Risks</div>
                </div>
              </div>
            </div>

            {/* Top Risks */}
            <div>
              <h4 className="text-sm font-medium mb-3">Highest Priority Risks</h4>
              {topRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No high or critical risks detected. 🎉
                </p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {topRisks.map((risk) => (
                      <div
                        key={risk.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-muted">
                            {RISK_TYPE_ICONS[risk.risk_type] || <ShieldAlert className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{risk.headline}</span>
                              <Badge className={`${RISK_LEVEL_COLORS[risk.risk_level]} text-xs`}>
                                {risk.risk_level}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {risk.entity_type} • Score: {risk.risk_score}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFixRisk(risk.risk_type)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Fix
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Quick Actions */}
            {(summary.critical > 0 || summary.high > 0) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <span className="text-sm font-medium">
                  {summary.critical} critical, {summary.high} high priority risks require attention
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={handleOpenRiskRadar}
                >
                  Review Now
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
