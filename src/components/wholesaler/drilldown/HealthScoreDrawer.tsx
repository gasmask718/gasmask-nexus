import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingCart,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import type { WholesalerHealthSnapshot } from '@/hooks/useWholesalerIntelligence';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface HealthScoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  snapshots: WholesalerHealthSnapshot[];
}

export function HealthScoreDrawer({
  open,
  onOpenChange,
  profile,
  snapshots,
}: HealthScoreDrawerProps) {
  const currentScore = profile?.relationship_health_score || 50;
  const latestSnapshot = snapshots[0];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getTierLabel = (score: number) => {
    if (score >= 80) return { label: 'Elite', color: 'text-green-400 bg-green-500/20' };
    if (score >= 60) return { label: 'Strong', color: 'text-blue-400 bg-blue-500/20' };
    if (score >= 40) return { label: 'Neutral', color: 'text-amber-400 bg-amber-500/20' };
    return { label: 'Fragile', color: 'text-red-400 bg-red-500/20' };
  };

  const tier = getTierLabel(currentScore);

  const scoreComponents = [
    {
      label: 'Order Consistency',
      score: latestSnapshot?.order_consistency_score || 0,
      icon: ShoppingCart,
      tooltip: 'Based on order frequency and regularity',
    },
    {
      label: 'Payment Punctuality',
      score: latestSnapshot?.payment_punctuality_score || 0,
      icon: CreditCard,
      tooltip: 'Based on on-time payment rate',
    },
    {
      label: 'Communication',
      score: latestSnapshot?.communication_score || 0,
      icon: MessageSquare,
      tooltip: 'Based on interaction frequency and sentiment',
    },
    {
      label: 'Dispute History',
      score: latestSnapshot?.dispute_score || 100,
      icon: AlertTriangle,
      tooltip: 'Based on dispute frequency and resolution',
    },
    {
      label: 'Contract Adherence',
      score: latestSnapshot?.contract_adherence_score || 0,
      icon: FileText,
      tooltip: 'Based on meeting contract terms',
    },
    {
      label: 'Price Sensitivity',
      score: latestSnapshot?.price_sensitivity_score || 0,
      icon: DollarSign,
      tooltip: 'Lower score = more price sensitive',
    },
  ];

  // Prepare chart data
  const chartData = [...snapshots].reverse().map((s) => ({
    date: format(new Date(s.snapshot_date), 'MMM d, yyyy'),
    score: s.health_score,
  }));

  const getTrendIcon = () => {
    if (snapshots.length < 2) return <Minus className="h-5 w-5 text-muted-foreground" />;
    const trend = snapshots[0]?.trend;
    if (trend === 'improving') return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Health Score Breakdown
          </SheetTitle>
          <SheetDescription>
            Detailed analysis of {profile?.name}'s relationship health
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* Main Score */}
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className={`text-6xl font-bold ${getScoreColor(currentScore)}`}>
                  {currentScore}
                </span>
                {getTrendIcon()}
              </div>
              <Badge className={tier.color}>{tier.label}</Badge>
              <Progress
                value={currentScore}
                className="mt-4 h-3"
                style={{ 
                  background: 'hsl(var(--muted))',
                }}
              />
            </div>

            {/* Trend Chart */}
            {chartData.length > 1 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Score History (30 days)</h4>
                <div className="h-40 bg-muted/30 rounded-lg p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} />
                      <YAxis stroke="#666" fontSize={10} tickLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <ReferenceLine y={60} stroke="#666" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ fill: '#8b5cf6', r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <Separator />

            {/* Score Components */}
            <div>
              <h4 className="text-sm font-medium mb-4">Contributing Factors</h4>
              <div className="space-y-4">
                {scoreComponents.map((component, index) => {
                  const Icon = component.icon;
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{component.label}</span>
                        </div>
                        <span className={`text-sm font-medium ${getScoreColor(component.score)}`}>
                          {component.score}/100
                        </span>
                      </div>
                      <Progress
                        value={component.score}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{component.tooltip}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Risk Factors */}
            {latestSnapshot?.risk_factors && latestSnapshot.risk_factors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Active Risk Factors
                </h4>
                <div className="space-y-2">
                  {latestSnapshot.risk_factors.map((factor: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                    >
                      <XCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{factor.name || factor}</p>
                        {factor.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {factor.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Recommended Actions
              </h4>
              <div className="space-y-2">
                {currentScore < 60 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Calendar className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Schedule a relationship call</p>
                      <p className="text-xs text-muted-foreground">
                        Low health score indicates need for direct communication
                      </p>
                    </div>
                  </div>
                )}
                {(latestSnapshot?.payment_punctuality_score || 0) < 70 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <CreditCard className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Review payment terms</p>
                      <p className="text-xs text-muted-foreground">
                        Consider adjusting payment terms or setting up reminders
                      </p>
                    </div>
                  </div>
                )}
                {(latestSnapshot?.order_consistency_score || 0) < 60 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <ShoppingCart className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Re-engage with promotions</p>
                      <p className="text-xs text-muted-foreground">
                        Order frequency is declining—consider special offers
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
