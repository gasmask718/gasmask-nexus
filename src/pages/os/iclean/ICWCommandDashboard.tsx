import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Users, Activity, CalendarRange, DollarSign, Sparkles } from 'lucide-react';

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday start
  const s = new Date(d.setDate(diff));
  s.setHours(0, 0, 0, 0);
  return s;
}

export default function ICWCommandDashboard() {
  const weekStart = startOfWeek().toISOString();

  const { data, isLoading, error } = useQuery({
    queryKey: ['icw-command-metrics', weekStart],
    queryFn: async () => {
      const [workers, activeJobs, weekJobs] = await Promise.all([
        supabase.from('icw_workers').select('id', { count: 'exact', head: true }),
        supabase
          .from('icw_jobs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'matched', 'in_progress']),
        supabase
          .from('icw_jobs')
          .select('id, price, status')
          .gte('scheduled_at', weekStart),
      ]);

      if (workers.error) throw workers.error;
      if (activeJobs.error) throw activeJobs.error;
      if (weekJobs.error) throw weekJobs.error;

      const rows = weekJobs.data ?? [];
      const revenue = rows
        .filter((r) => r.status === 'complete')
        .reduce((sum, r) => sum + Number(r.price ?? 0), 0);

      return {
        totalWorkers: workers.count ?? 0,
        activeJobs: activeJobs.count ?? 0,
        jobsThisWeek: rows.length,
        revenueThisWeek: revenue,
      };
    },
  });

  const stats = [
    { label: 'Total Workers', value: data?.totalWorkers ?? 0, icon: Users, color: 'text-cyan-500' },
    { label: 'Active Jobs', value: data?.activeJobs ?? 0, icon: Activity, color: 'text-blue-500' },
    { label: 'Jobs This Week', value: data?.jobsThisWeek ?? 0, icon: CalendarRange, color: 'text-purple-500' },
    {
      label: 'Revenue This Week',
      value: `$${(data?.revenueThisWeek ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'text-emerald-500',
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-500 bg-clip-text text-transparent">
            I Clean We Clean — Command
          </h1>
          <p className="text-muted-foreground mt-1">
            Internal dispatch console · Cash Flow Engines layer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10">
            Public booking site not connected yet
          </Badge>
          <Button asChild className="bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-700 hover:to-blue-600">
            <Link to="/os/icw/workers">
              <Users className="h-4 w-4 mr-2" />
              Worker Roster
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-gradient-to-br from-background to-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{isLoading ? '—' : stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-500" />
            Build Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Foundation pass: schema, command dashboard, worker roster, stubbed intake/status-sync functions.</p>
          <p>Not built yet: matching/dispatch algorithm, licensing gate enforcement, public-site webhook sync.</p>
          <p>State configuration seeded with 51 placeholder rows pending verified data.</p>
        </CardContent>
      </Card>
    </div>
  );
}
