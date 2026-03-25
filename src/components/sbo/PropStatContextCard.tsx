import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, TrendingUp, TrendingDown, Activity, Shield, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropStatContextCardProps {
  propId: string;
  playerName: string;
  propType: string;
  line: number;
  compact?: boolean;
}

interface StatContext {
  season_avg: number | null;
  last_5_avg: number | null;
  last_10_avg: number | null;
  vs_opponent_avg: number | null;
  vs_opponent_games: number;
  opponent_team: string | null;
  opponent_def_rating: number | null;
  opponent_ppg_allowed: number | null;
  team_pace: number | null;
  minutes_avg: number | null;
  usage_rate: number | null;
  variance_score: number | null;
  injury_status: string | null;
  projection_value: number | null;
  edge_vs_line: number | null;
  data_quality: string;
  last_5_values: number[];
  last_10_values: number[];
  vs_opponent_values: number[];
}

const QualityBadge = ({ quality }: { quality: string }) => {
  const config: Record<string, { label: string; className: string }> = {
    full: { label: 'Full Stats', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    good: { label: 'Good', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    partial: { label: 'Partial', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    minimal: { label: 'Minimal', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const c = config[quality] || config.minimal;
  return <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', c.className)}>{c.label}</Badge>;
};

const StatBar = ({ label, value, line, icon: Icon }: { label: string; value: number | null; line: number; icon?: any }) => {
  if (value == null) return null;
  const diff = value - line;
  const isOver = diff > 0;
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono font-medium">{value.toFixed(1)}</span>
        <span className={cn('font-mono text-[10px]', isOver ? 'text-emerald-400' : 'text-red-400')}>
          {isOver ? '+' : ''}{diff.toFixed(1)}
        </span>
      </div>
    </div>
  );
};

const MiniSparkline = ({ values, line }: { values: number[]; line: number }) => {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, line) + 2;
  const min = Math.min(...values, line) - 2;
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const lineY = h - ((line - min) / range) * h;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <svg width={w} height={h} className="block">
      <line x1="0" y1={lineY} x2={w} y2={lineY} stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      {values.map((v, i) => (
        <circle key={i} cx={(i / (values.length - 1)) * w} cy={h - ((v - min) / range) * h} r="2"
          fill={v >= line ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)'} />
      ))}
    </svg>
  );
};

export function PropStatContextCard({ propId, playerName, propType, line, compact = false }: PropStatContextCardProps) {
  const [open, setOpen] = useState(false);

  const { data: ctx, isLoading } = useQuery({
    queryKey: ['prop-stat-context', propId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_prop_stat_context')
        .select('*')
        .eq('prop_id', propId)
        .maybeSingle();
      if (error) throw error;
      return data as StatContext | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="text-[10px] text-muted-foreground animate-pulse">Loading stats...</div>;
  if (!ctx) return <div className="text-[10px] text-muted-foreground">No stat context</div>;

  // Compact inline view
  if (compact) {
    const hitsOver = (ctx.last_5_values || []).filter(v => v >= line).length;
    const total = (ctx.last_5_values || []).length;
    return (
      <div className="flex items-center gap-2 text-[10px] flex-wrap">
        <QualityBadge quality={ctx.data_quality} />
        <span className="text-muted-foreground">
          Szn: <span className="font-mono text-foreground">{ctx.season_avg?.toFixed(1) ?? '–'}</span>
        </span>
        <span className="text-muted-foreground">
          L5: <span className="font-mono text-foreground">{ctx.last_5_avg?.toFixed(1) ?? '–'}</span>
        </span>
        {ctx.vs_opponent_avg != null && (
          <span className="text-muted-foreground">
            vs{ctx.opponent_team ? ` ${ctx.opponent_team.split(' ').pop()}` : ''}: <span className="font-mono text-foreground">{ctx.vs_opponent_avg.toFixed(1)}</span>
          </span>
        )}
        {ctx.edge_vs_line != null && (
          <span className={cn('font-mono', ctx.edge_vs_line > 0 ? 'text-emerald-400' : 'text-red-400')}>
            {ctx.edge_vs_line > 0 ? '▲' : '▼'}{Math.abs(ctx.edge_vs_line).toFixed(1)}
          </span>
        )}
        {total > 0 && (
          <span className="text-muted-foreground">
            Hit: <span className="font-mono text-foreground">{hitsOver}/{total}</span>
          </span>
        )}
      </div>
    );
  }

  // Full expandable view
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between h-7 px-2 text-xs hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-primary" />
            <span>Stat Intelligence</span>
            <QualityBadge quality={ctx.data_quality} />
          </div>
          <div className="flex items-center gap-2">
            {ctx.edge_vs_line != null && (
              <span className={cn('font-mono text-[10px]', ctx.edge_vs_line > 0 ? 'text-emerald-400' : 'text-red-400')}>
                Edge: {ctx.edge_vs_line > 0 ? '+' : ''}{ctx.edge_vs_line.toFixed(1)}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-1 px-2 space-y-2">
        {/* Averages vs Line */}
        <div className="space-y-0.5">
          <StatBar label="Season Avg" value={ctx.season_avg} line={line} icon={Activity} />
          <StatBar label="Last 5 Avg" value={ctx.last_5_avg} line={line} icon={TrendingUp} />
          <StatBar label="Last 10 Avg" value={ctx.last_10_avg} line={line} icon={TrendingUp} />
          {ctx.vs_opponent_avg != null && (
            <StatBar
              label={`vs ${ctx.opponent_team?.split(' ').pop() || 'Opp'} (${ctx.vs_opponent_games}g)`}
              value={ctx.vs_opponent_avg} line={line} icon={Shield}
            />
          )}
          {ctx.projection_value != null && (
            <StatBar label="Projection" value={ctx.projection_value} line={line} icon={Zap} />
          )}
        </div>

        {/* Sparkline */}
        {ctx.last_5_values && ctx.last_5_values.length > 1 && (
          <div className="pt-1">
            <span className="text-[10px] text-muted-foreground">Last 5 Games (line = dashed)</span>
            <MiniSparkline values={[...ctx.last_5_values].reverse()} line={line} />
          </div>
        )}

        {/* Context details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] pt-1 border-t border-border/50">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pace</span>
            <span className="font-mono">{ctx.team_pace?.toFixed(1) ?? '–'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Opp Def Rtg</span>
            <span className="font-mono">{ctx.opponent_def_rating?.toFixed(1) ?? '–'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Minutes</span>
            <span className="font-mono">{ctx.minutes_avg?.toFixed(1) ?? '–'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Usage</span>
            <span className="font-mono">{ctx.usage_rate ? `${ctx.usage_rate.toFixed(1)}%` : '–'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Variance</span>
            <span className="font-mono">{ctx.variance_score?.toFixed(2) ?? '–'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Opp PPG Allow</span>
            <span className="font-mono">{ctx.opponent_ppg_allowed?.toFixed(1) ?? '–'}</span>
          </div>
        </div>

        {/* Injury */}
        {ctx.injury_status && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 pt-1">
            <AlertTriangle className="h-3 w-3" />
            {ctx.injury_status}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
