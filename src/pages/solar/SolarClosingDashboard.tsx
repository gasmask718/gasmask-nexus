import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import {
  Brain, Target, TrendingUp, AlertTriangle, Zap, Eye, MessageSquare,
  Phone, ArrowUpRight, CheckCircle
} from 'lucide-react';

const AMBER = '#E8A317';

export default function SolarClosingDashboard() {
  const [stageFilter, setStageFilter] = useState<string>('all');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['solar-closing-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_closing_sessions' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: objections = [] } = useQuery({
    queryKey: ['solar-objection-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_objection_library' as any)
        .select('*')
        .order('success_rate', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ['solar-property-estimates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_property_intelligence' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = stageFilter === 'all' ? sessions : sessions.filter((s: any) => s.closing_stage === stageFilter);

  const highIntent = sessions.filter((s: any) => (s.intent_score || 0) >= 80).length;
  const avgIntent = sessions.length
    ? Math.round(sessions.reduce((a: number, s: any) => a + (s.intent_score || 0), 0) / sessions.length)
    : 0;
  const booked = sessions.filter((s: any) => s.closing_stage === 'booked').length;

  const stages = ['all', 'intro', 'qualify', 'present', 'objection', 'close_attempt', 'booked', 'lost'];
  const stageColors: Record<string, string> = {
    intro: 'bg-blue-500/20 text-blue-400',
    qualify: 'bg-purple-500/20 text-purple-400',
    present: 'bg-amber-500/20 text-amber-400',
    objection: 'bg-red-500/20 text-red-400',
    close_attempt: 'bg-orange-500/20 text-orange-400',
    booked: 'bg-green-500/20 text-green-400',
    lost: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6" style={{ color: AMBER }} />
          AI Closing Dashboard
        </h1>
        <p className="text-muted-foreground">Monitor intent scores, objections, and closing progress</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length, icon: MessageSquare, color: 'text-blue-400' },
          { label: 'High Intent', value: highIntent, icon: Zap, color: 'text-green-400' },
          { label: 'Avg Intent Score', value: avgIntent, icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Booked', value: booked, icon: CheckCircle, color: 'text-green-400' },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stage Filter */}
      <div className="flex gap-2 flex-wrap">
        {stages.map((s) => (
          <Button
            key={s}
            variant={stageFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStageFilter(s)}
            style={stageFilter === s ? { backgroundColor: AMBER, color: '#000' } : undefined}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Sessions Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Closing Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Objections</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : !filtered.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sessions yet. Start conversations from the Solar Estimator.</TableCell></TableRow>
              ) : (
                filtered.map((sess: any) => {
                  const objCount = Array.isArray(sess.objections_detected) ? sess.objections_detected.length : 0;
                  return (
                    <TableRow key={sess.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sess.session_type === 'chat' ? <MessageSquare className="h-3 w-3 mr-1" /> : <Phone className="h-3 w-3 mr-1" />}
                          {sess.session_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={stageColors[sess.closing_stage] || 'bg-muted'}>
                          {sess.closing_stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold text-lg ${
                          (sess.intent_score || 0) >= 80 ? 'text-green-400' :
                          (sess.intent_score || 0) >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {sess.intent_score || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        {objCount > 0 ? (
                          <Badge variant="outline" className="text-red-400 border-red-400/30">
                            <AlertTriangle className="h-3 w-3 mr-1" /> {objCount}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{sess.outcome || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(sess.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Objection Library */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: AMBER }} />
            Objection Library — Self-Learning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {objections.map((obj: any) => (
            <div key={obj.id} className="p-3 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-red-400 border-red-400/30">
                  {obj.objection_type?.replace('_', ' ')}
                </Badge>
                <Badge className="bg-green-500/20 text-green-400">
                  {obj.success_rate}% success
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(obj.trigger_keywords || []).map((kw: string, i: number) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">"{kw}"</span>
                ))}
              </div>
              <div className="space-y-1">
                {(Array.isArray(obj.recommended_responses) ? obj.recommended_responses : []).map((resp: any, i: number) => (
                  <p key={i} className="text-xs italic text-muted-foreground">
                    → {typeof resp === 'string' ? resp : resp.response}
                  </p>
                ))}
              </div>
            </div>
          ))}
          {objections.length === 0 && (
            <p className="text-center text-muted-foreground py-4">Objection library seeded — will self-improve with each session.</p>
          )}
        </CardContent>
      </Card>

      {/* Property Estimates */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" style={{ color: AMBER }} />
            Recent Property Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Panels</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Savings</TableHead>
                <TableHead>Sun Score</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No estimates yet</TableCell></TableRow>
              ) : (
                estimates.map((est: any) => (
                  <TableRow key={est.id}>
                    <TableCell className="text-sm font-medium">{est.address}</TableCell>
                    <TableCell>{est.estimated_panel_count}</TableCell>
                    <TableCell>{est.estimated_system_kw} kW</TableCell>
                    <TableCell className="text-green-400">${est.estimated_monthly_savings}/mo</TableCell>
                    <TableCell>{est.sunlight_score}/100</TableCell>
                    <TableCell>
                      <Badge className={est.confidence_score >= 75 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                        {est.confidence_score}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
