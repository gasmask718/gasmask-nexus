import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Brain,
  Sparkles,
  AlertTriangle,
  Zap,
  TrendingUp,
  Clock,
  Building2,
  Filter,
  RefreshCw,
} from 'lucide-react';

const BUSINESSES = [
  { id: 'all', name: 'All Businesses' },
  { id: 'gasmask', name: 'GasMask / Grabba' },
  { id: 'toptier', name: 'TopTier Experience' },
  { id: 'unforgettable', name: 'Unforgettable Times' },
  { id: 'playboxxx', name: 'Playboxxx' },
  { id: 'iclean', name: 'iClean WeClean' },
  { id: 'funding', name: 'Funding Company' },
  { id: 'grants', name: 'Grant Company' },
  { id: 'wealth', name: 'Wealth Engine' },
  { id: 'realestate', name: 'Real Estate Holdings' },
  { id: 'betting', name: 'Sports Betting AI' },
];

const TIMEFRAMES = [
  { id: 'today', name: 'Today' },
  { id: 'week', name: 'This Week' },
  { id: 'month', name: 'This Month' },
];

const insights = [
  {
    type: 'opportunity',
    title: 'Scale TopTier Experience NYC & ATL',
    content: 'Bundle "Black Truck + Roses" celebration campaigns for 30% higher AOV. Weekend demand is 2x weekday.',
    business: 'TopTier Experience',
    priority: 'high',
    potentialValue: '$12,000/mo',
  },
  {
    type: 'opportunity',
    title: 'Expand Grabba to New Borough',
    content: '3 wholesalers in untapped zone showing interest. Quick market entry possible.',
    business: 'GasMask / Grabba',
    priority: 'medium',
    potentialValue: '$8,000/mo',
  },
  {
    type: 'risk',
    title: 'Funding Files Over SLA',
    content: '4 files stuck in underwriting >48 hours. Create forced follow-up rule to prevent delays.',
    business: 'Funding Company',
    priority: 'critical',
    potentialLoss: '$15,000',
  },
  {
    type: 'risk',
    title: 'Grant Deadlines Approaching',
    content: '2 client applications due in 72 hours without complete documentation.',
    business: 'Grant Company',
    priority: 'high',
    potentialLoss: '$25,000',
  },
  {
    type: 'quickwin',
    title: 'Raise Weekend Base Price',
    content: 'Increase black truck weekend rate by $10-15. Demand supports it.',
    business: 'TopTier Experience',
    priority: 'low',
    potentialValue: '$3,000/mo',
  },
  {
    type: 'quickwin',
    title: 'Activate Dormant Ambassadors',
    content: '12 ambassadors inactive >30 days. Send re-engagement campaign.',
    business: 'GasMask / Grabba',
    priority: 'medium',
    potentialValue: '$2,000/mo',
  },
];

export default function OwnerAIAdvisorPage() {
  const [timeframe, setTimeframe] = useState('week');
  const [business, setBusiness] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const filteredInsights = insights.filter(
    (i) => business === 'all' || i.business.toLowerCase().includes(business)
  );

  const opportunities = filteredInsights.filter((i) => i.type === 'opportunity');
  const risks = filteredInsights.filter((i) => i.type === 'risk');
  const quickWins = filteredInsights.filter((i) => i.type === 'quickwin');

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 border border-purple-500/30">
            <Brain className="h-8 w-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Advisor</h1>
            <p className="text-sm text-muted-foreground">
              Empire-wide AI insights across all businesses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[140px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={business} onValueChange={setBusiness}>
            <SelectTrigger className="w-[180px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESSES.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 to-emerald-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Opportunities</p>
                <p className="text-3xl font-bold text-emerald-400">{opportunities.length}</p>
              </div>
              <Sparkles className="h-8 w-8 text-emerald-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-amber-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Risks</p>
                <p className="text-3xl font-bold text-amber-400">{risks.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-blue-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quick Wins</p>
                <p className="text-3xl font-bold text-blue-400">{quickWins.length}</p>
              </div>
              <Zap className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Opportunities */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Opportunities
            </CardTitle>
            <CardDescription className="text-xs">Growth opportunities identified by AI</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {opportunities.map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} color="emerald" />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Risks */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Risks
            </CardTitle>
            <CardDescription className="text-xs">Issues requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {risks.map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} color="amber" />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Wins */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-400" />
              Quick Wins
            </CardTitle>
            <CardDescription className="text-xs">Low-effort, high-impact actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {quickWins.map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} color="blue" />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InsightCard({ insight, color }: { insight: typeof insights[0]; color: string }) {
  const priorityColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-colors hover:bg-muted/50",
      `border-${color}-500/20`
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm">{insight.title}</h4>
        <Badge variant="outline" className={priorityColors[insight.priority as keyof typeof priorityColors]}>
          {insight.priority}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{insight.content}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{insight.business}</span>
        {'potentialValue' in insight && (
          <span className="text-emerald-400 font-medium">+{insight.potentialValue}</span>
        )}
        {'potentialLoss' in insight && (
          <span className="text-red-400 font-medium">-{insight.potentialLoss}</span>
        )}
      </div>
    </div>
  );
}
