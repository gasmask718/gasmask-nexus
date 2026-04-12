import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTopTierMetrics } from '@/lib/empireApi';
import { Car, CalendarCheck, Users, AlertTriangle, ArrowRight, CircleDot, Star, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TopTierEmpireCard() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['empire-toptier-metrics'],
    queryFn: fetchTopTierMetrics,
    refetchInterval: 30000,
    retry: 2,
  });

  if (isError) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
            <Car className="h-4 w-4" />
            TopTier — Connection Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Unable to fetch live metrics. Check edge function deployment.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/os/toptier')}>
            Open Hub <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const tt = data?.toptier;
  const pendingCount = tt?.pending_assignments ?? data?.pending_confirmations ?? 0;
  const pendingColor = pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <Card className="border-[#C9A84C]/30 bg-gradient-to-br from-card to-[#C9A84C]/5 hover:border-[#C9A84C]/50 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CircleDot className="h-3 w-3 text-[#C9A84C]" />
            TopTier Experience
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
            onClick={() => navigate('/os/toptier')}
          >
            Open Hub <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricBlock
              label="Revenue Today"
              value={`$${(tt?.revenue_today ?? data?.revenue_today ?? 0).toLocaleString()}`}
              className="text-[#C9A84C] font-bold text-lg"
            />
            <MetricBlock
              label="Bookings Today"
              value={tt?.bookings_today ?? data?.active_bookings ?? 0}
              icon={<CalendarCheck className="h-3.5 w-3.5 text-blue-400" />}
            />
            <MetricBlock
              label="Pending Assigns"
              value={pendingCount}
              icon={<AlertTriangle className={cn('h-3.5 w-3.5', pendingColor)} />}
              valueClass={pendingColor}
            />
            <MetricBlock
              label="Active Drivers"
              value={tt?.active_drivers ?? data?.active_partners ?? 0}
              icon={<Users className="h-3.5 w-3.5 text-emerald-400" />}
            />
            <MetricBlock
              label="Avg Rating"
              value={tt?.avg_rating ? `⭐ ${tt.avg_rating}` : '—'}
              icon={<Star className="h-3.5 w-3.5 text-[#C9A84C]" />}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBlock({
  label,
  value,
  icon,
  className,
  valueClass,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div className="p-2.5 rounded-lg border border-border/30 bg-card/50">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={cn('text-sm font-semibold', className, valueClass)}>{value}</span>
      </div>
    </div>
  );
}
