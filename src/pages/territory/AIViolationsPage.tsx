/**
 * Floor 9.4 — AI Violation & Denial Monitor
 * READ-ONLY dashboard. No writes, no toggles, no edits.
 * Shows denied AI actions from v_ai_denial_summary view.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldAlert, MapPin, Zap, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DenialSummary {
  action_key: string;
  neighborhood_id: string | null;
  denial_reason: string | null;
  constraint_source: string | null;
  denial_count: number;
  first_denied_at: string;
  last_denied_at: string;
  time_window: string;
}

const CHART_COLORS = [
  'hsl(0, 70%, 50%)',
  'hsl(30, 80%, 50%)',
  'hsl(200, 70%, 50%)',
  'hsl(280, 65%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(45, 90%, 50%)',
];

export default function AIViolationsPage() {
  const [denials, setDenials] = useState<DenialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentDenials, setRecentDenials] = useState<any[]>([]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch aggregated denials from view
      const { data: summary } = await (supabase as any)
        .from('v_ai_denial_summary')
        .select('*')
        .order('denial_count', { ascending: false })
        .limit(100);

      setDenials(summary || []);

      // Fetch recent individual denials
      const { data: recent } = await supabase
        .from('ai_decision_log')
        .select('*')
        .eq('permission_allowed', false)
        .order('created_at', { ascending: false })
        .limit(50);

      setRecentDenials(recent || []);
    } catch (err) {
      console.error('Failed to fetch denial data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const totalDenials = denials.reduce((a, d) => a + d.denial_count, 0);
  const uniqueActions = new Set(denials.map(d => d.action_key)).size;
  const uniqueNeighborhoods = new Set(denials.filter(d => d.neighborhood_id).map(d => d.neighborhood_id)).size;

  // Top denied actions chart
  const actionChart = Object.entries(
    denials.reduce<Record<string, number>>((acc, d) => {
      acc[d.action_key] = (acc[d.action_key] || 0) + d.denial_count;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // Denial reason breakdown
  const reasonChart = Object.entries(
    denials.reduce<Record<string, number>>((acc, d) => {
      const reason = d.denial_reason || 'unknown';
      acc[reason] = (acc[reason] || 0) + d.denial_count;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + '…' : name, value }));

  const timeWindowBadge = (tw: string) => {
    switch (tw) {
      case 'last_hour': return <Badge variant="destructive">Last Hour</Badge>;
      case 'last_24h': return <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">24h</Badge>;
      case 'last_7d': return <Badge variant="secondary">7d</Badge>;
      default: return <Badge variant="outline">Older</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Floor 9.4 — AI Violation & Denial Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Read-only forensic view of all denied AI permission attempts
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" />
              Total Denials
            </div>
            <p className="text-2xl font-bold mt-1">{totalDenials.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Unique Actions Blocked
            </div>
            <p className="text-2xl font-bold mt-1">{uniqueActions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4" />
              Neighborhoods Blocked
            </div>
            <p className="text-2xl font-bold mt-1">{uniqueNeighborhoods}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <ShieldAlert className="h-4 w-4" />
              Recent (50)
            </div>
            <p className="text-2xl font-bold mt-1">{recentDenials.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {actionChart.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Top Denied Actions</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={actionChart}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(0, 70%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Denial Reasons</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={reasonChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {reasonChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* Aggregated Denial Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Aggregated Denials</CardTitle></CardHeader>
        <CardContent>
          {denials.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No denied actions recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">Action Key</th>
                    <th className="p-2 font-medium">Neighborhood</th>
                    <th className="p-2 font-medium">Reason</th>
                    <th className="p-2 font-medium">Source</th>
                    <th className="p-2 font-medium text-right">Count</th>
                    <th className="p-2 font-medium">Window</th>
                    <th className="p-2 font-medium">Last Denied</th>
                  </tr>
                </thead>
                <tbody>
                  {denials.map((d, i) => (
                    <tr key={i} className="border-b border-muted/50 hover:bg-muted/30">
                      <td className="p-2 font-mono text-xs">{d.action_key}</td>
                      <td className="p-2 font-mono text-xs">{d.neighborhood_id?.slice(0, 8) || '—'}</td>
                      <td className="p-2 text-xs">{d.denial_reason || '—'}</td>
                      <td className="p-2"><Badge variant="outline" className="text-xs">{d.constraint_source || '—'}</Badge></td>
                      <td className="p-2 text-right font-bold">{d.denial_count}</td>
                      <td className="p-2">{timeWindowBadge(d.time_window)}</td>
                      <td className="p-2 text-xs text-muted-foreground">{new Date(d.last_denied_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Individual Denials */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Denied Attempts (Raw Log)</CardTitle></CardHeader>
        <CardContent>
          {recentDenials.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No recent denials.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">Timestamp</th>
                    <th className="p-2 font-medium">Agent</th>
                    <th className="p-2 font-medium">Action</th>
                    <th className="p-2 font-medium">Neighborhood</th>
                    <th className="p-2 font-medium">Reason</th>
                    <th className="p-2 font-medium">Enforcement</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDenials.map((d: any) => (
                    <tr key={d.id} className="border-b border-muted/50 hover:bg-muted/30">
                      <td className="p-2 text-xs">{new Date(d.created_at).toLocaleString()}</td>
                      <td className="p-2 font-mono text-xs">{d.ai_agent || '—'}</td>
                      <td className="p-2 font-mono text-xs">{d.action_key}</td>
                      <td className="p-2 font-mono text-xs">{d.neighborhood_id?.slice(0, 8) || '—'}</td>
                      <td className="p-2 text-xs">{d.blocked_reason || '—'}</td>
                      <td className="p-2"><Badge variant="outline" className="text-xs">{d.enforcement_source || '—'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
