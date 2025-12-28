import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStateCompliance, STATE_LABELS, FORMAT_LABELS, SupportedState, FormatTag } from '@/hooks/useStateCompliance';
import { format, subDays } from 'date-fns';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function BettingAnalytics() {
  const { platforms } = useStateCompliance();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterState, setFilterState] = useState<SupportedState | ''>('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterSport, setFilterSport] = useState('');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['analytics-entries', dateFrom, dateTo, filterState, filterPlatform, filterSport],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('pick_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'settled')
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (filterState) query = query.eq('state', filterState);
      if (filterPlatform) query = query.eq('platform', filterPlatform);
      if (filterSport) query = query.eq('sport', filterSport);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!entries || entries.length === 0) {
      return {
        totalEntries: 0,
        totalStaked: 0,
        totalPL: 0,
        roi: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        winRate: 0,
        byState: [],
        byPlatform: [],
        byFormat: [],
        byMarket: [],
        dailyPL: [],
      };
    }

    const totalStaked = entries.reduce((sum, e) => sum + e.stake, 0);
    const totalPL = entries.reduce((sum, e) => sum + e.profit_loss, 0);
    const wins = entries.filter(e => e.result === 'W').length;
    const losses = entries.filter(e => e.result === 'L').length;
    const pushes = entries.filter(e => e.result === 'Push').length;
    const decisioned = wins + losses;

    // Group by state
    const stateGroups: Record<string, { staked: number; pl: number; count: number }> = {};
    entries.forEach(e => {
      if (!stateGroups[e.state]) stateGroups[e.state] = { staked: 0, pl: 0, count: 0 };
      stateGroups[e.state].staked += e.stake;
      stateGroups[e.state].pl += e.profit_loss;
      stateGroups[e.state].count++;
    });

    // Group by platform
    const platformGroups: Record<string, { staked: number; pl: number; count: number }> = {};
    entries.forEach(e => {
      if (!platformGroups[e.platform]) platformGroups[e.platform] = { staked: 0, pl: 0, count: 0 };
      platformGroups[e.platform].staked += e.stake;
      platformGroups[e.platform].pl += e.profit_loss;
      platformGroups[e.platform].count++;
    });

    // Group by format
    const formatGroups: Record<string, { staked: number; pl: number; count: number }> = {};
    entries.forEach(e => {
      if (!formatGroups[e.format_tag]) formatGroups[e.format_tag] = { staked: 0, pl: 0, count: 0 };
      formatGroups[e.format_tag].staked += e.stake;
      formatGroups[e.format_tag].pl += e.profit_loss;
      formatGroups[e.format_tag].count++;
    });

    // Group by market
    const marketGroups: Record<string, { staked: number; pl: number; count: number; wins: number }> = {};
    entries.forEach(e => {
      if (!marketGroups[e.market]) marketGroups[e.market] = { staked: 0, pl: 0, count: 0, wins: 0 };
      marketGroups[e.market].staked += e.stake;
      marketGroups[e.market].pl += e.profit_loss;
      marketGroups[e.market].count++;
      if (e.result === 'W') marketGroups[e.market].wins++;
    });

    // Daily P/L
    const dailyGroups: Record<string, number> = {};
    entries.forEach(e => {
      if (!dailyGroups[e.date]) dailyGroups[e.date] = 0;
      dailyGroups[e.date] += e.profit_loss;
    });

    return {
      totalEntries: entries.length,
      totalStaked,
      totalPL,
      roi: totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0,
      wins,
      losses,
      pushes,
      winRate: decisioned > 0 ? (wins / decisioned) * 100 : 0,
      byState: Object.entries(stateGroups).map(([state, data]) => ({
        name: STATE_LABELS[state as SupportedState] || state,
        roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
        pl: data.pl,
        count: data.count,
      })),
      byPlatform: Object.entries(platformGroups).map(([platform, data]) => ({
        name: platform,
        roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
        pl: data.pl,
        count: data.count,
      })),
      byFormat: Object.entries(formatGroups).map(([fmt, data]) => ({
        name: FORMAT_LABELS[fmt as FormatTag] || fmt,
        roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
        pl: data.pl,
        count: data.count,
      })),
      byMarket: Object.entries(marketGroups)
        .map(([market, data]) => ({
          name: market,
          roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
          pl: data.pl,
          count: data.count,
          winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
        }))
        .sort((a, b) => b.pl - a.pl)
        .slice(0, 10),
      dailyPL: Object.entries(dailyGroups)
        .map(([date, pl]) => ({ date, pl }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [entries]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground">Track ROI across states, platforms, and formats</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={filterState} onValueChange={(v) => setFilterState(v as SupportedState)}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="GA">Georgia</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {platforms?.map(p => (
                    <SelectItem key={p.platform_key} value={p.platform_key}>{p.platform_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select value={filterSport} onValueChange={setFilterSport}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="NBA">NBA</SelectItem>
                  <SelectItem value="NFL">NFL</SelectItem>
                  <SelectItem value="MLB">MLB</SelectItem>
                  <SelectItem value="NHL">NHL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Entries</CardDescription>
            <CardTitle className="text-3xl">{metrics.totalEntries}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">{metrics.wins}W</span>
              <span className="text-red-600">{metrics.losses}L</span>
              <span className="text-amber-600">{metrics.pushes}P</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total P/L</CardDescription>
            <CardTitle className={`text-3xl ${metrics.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.totalPL >= 0 ? '+' : ''}${metrics.totalPL.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              ${metrics.totalStaked.toFixed(2)} staked
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ROI</CardDescription>
            <CardTitle className={`text-3xl flex items-center gap-2 ${metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.roi >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              {metrics.roi.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Target className="h-6 w-6" />
              {metrics.winRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily P/L</TabsTrigger>
          <TabsTrigger value="state">By State</TabsTrigger>
          <TabsTrigger value="platform">By Platform</TabsTrigger>
          <TabsTrigger value="format">By Format</TabsTrigger>
          <TabsTrigger value="market">By Market</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Daily Profit/Loss</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.dailyPL.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.dailyPL}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'M/d')} />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'P/L']} />
                    <Line 
                      type="monotone" 
                      dataKey="pl" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="state">
          <Card>
            <CardHeader>
              <CardTitle>ROI by State</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.byState.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.byState}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']} />
                    <Bar dataKey="roi" fill="hsl(var(--primary))">
                      {metrics.byState.map((entry, index) => (
                        <Cell key={index} fill={entry.roi >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform">
          <Card>
            <CardHeader>
              <CardTitle>ROI by Platform</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.byPlatform.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.byPlatform} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']} />
                    <Bar dataKey="roi">
                      {metrics.byPlatform.map((entry, index) => (
                        <Cell key={index} fill={entry.roi >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="format">
          <Card>
            <CardHeader>
              <CardTitle>ROI by Format</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.byFormat.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.byFormat}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']} />
                    <Bar dataKey="roi">
                      {metrics.byFormat.map((entry, index) => (
                        <Cell key={index} fill={entry.roi >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Markets</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.byMarket.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.byMarket} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'P/L']} />
                    <Bar dataKey="pl">
                      {metrics.byMarket.map((entry, index) => (
                        <Cell key={index} fill={entry.pl >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
