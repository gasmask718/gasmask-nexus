import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, Activity, Users, Zap, AlertTriangle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
  icon: React.ElementType;
  loading?: boolean;
  accentColor?: string;
}

function KPICard({ title, value, change, changeType = 'neutral', subtitle, icon: Icon, loading, accentColor = 'emerald' }: KPICardProps) {
  if (loading) {
    return (
      <Card className="rounded-xl shadow-lg border-border/50 bg-gradient-to-br from-card to-card/80">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <Card className="rounded-xl shadow-lg border-border/50 bg-gradient-to-br from-card to-card/80 hover:shadow-xl transition-all duration-300 hover:border-primary/30">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardDescription className="text-xs font-medium uppercase tracking-wider">{title}</CardDescription>
        <div className={cn('p-2 rounded-lg border', colorClasses[accentColor as keyof typeof colorClasses] || colorClasses.emerald)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
          {change && (
            <span className={cn(
              'text-xs font-semibold flex items-center gap-0.5',
              changeType === 'positive' && 'text-emerald-400',
              changeType === 'negative' && 'text-red-400',
              changeType === 'neutral' && 'text-muted-foreground'
            )}>
              {changeType === 'positive' && <TrendingUp className="h-3 w-3" />}
              {changeType === 'negative' && <TrendingDown className="h-3 w-3" />}
              {change}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

interface ExecutiveKPIsProps {
  loading?: boolean;
}

export function ExecutiveKPIs({ loading = false }: ExecutiveKPIsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Empire Revenue (MTD)"
        value="$428,540"
        change="+18.4%"
        changeType="positive"
        subtitle="vs. last month"
        icon={DollarSign}
        loading={loading}
        accentColor="emerald"
      />
      <KPICard
        title="Daily Revenue"
        value="$14,285"
        change="+$2,140"
        changeType="positive"
        subtitle="Today so far"
        icon={Activity}
        loading={loading}
        accentColor="blue"
      />
      <KPICard
        title="Active OS Systems"
        value="10"
        change="All online"
        changeType="positive"
        subtitle="Across all businesses"
        icon={Building2}
        loading={loading}
        accentColor="purple"
      />
      <KPICard
        title="Open Alerts"
        value="7"
        change="3 critical"
        changeType="negative"
        subtitle="Needs review"
        icon={AlertTriangle}
        loading={loading}
        accentColor="amber"
      />
    </div>
  );
}

export default ExecutiveKPIs;
