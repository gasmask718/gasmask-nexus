import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Brain, TrendingUp, MessageSquare, Zap, Target, Lightbulb, BarChart3 } from 'lucide-react';

const AMBER = '#E8A317';

export default function SolarAIBrain() {
  const { data: interactions = [] } = useQuery({
    queryKey: ['solar-ai-interactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['solar-ai-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_leads')
        .select('lead_score, status, lead_source')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Compute AI insights
  const totalInteractions = interactions.length;
  const avgSentiment = interactions.length
    ? (interactions.reduce((a: number, i: any) => a + (i.sentiment_score || 0), 0) / interactions.length).toFixed(1)
    : '0';
  const objectionCount = interactions.filter((i: any) => i.objections_detected && Object.keys(i.objections_detected).length > 0).length;
  const avgLeadScore = leads.length
    ? (leads.reduce((a: number, l: any) => a + (l.lead_score || 0), 0) / leads.length).toFixed(0)
    : '0';

  // Common objections extracted
  const objectionMap: Record<string, number> = {};
  interactions.forEach((i: any) => {
    if (i.objections_detected && typeof i.objections_detected === 'object') {
      Object.keys(i.objections_detected).forEach((key) => {
        objectionMap[key] = (objectionMap[key] || 0) + 1;
      });
    }
  });
  const topObjections = Object.entries(objectionMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Source performance
  const sourceMap: Record<string, { count: number; totalScore: number }> = {};
  leads.forEach((l: any) => {
    const src = l.lead_source || 'unknown';
    if (!sourceMap[src]) sourceMap[src] = { count: 0, totalScore: 0 };
    sourceMap[src].count++;
    sourceMap[src].totalScore += l.lead_score || 0;
  });

  const insights = [
    { title: 'Score Optimization', desc: 'AI continuously refines lead scoring based on conversion outcomes', icon: Target, active: true },
    { title: 'Script Learning', desc: 'Analyzes winning call patterns to improve agent scripts', icon: MessageSquare, active: true },
    { title: 'Objection Database', desc: 'Builds a knowledge base of common objections and best responses', icon: Lightbulb, active: totalInteractions > 0 },
    { title: 'Source Analysis', desc: 'Tracks which lead sources produce highest quality conversions', icon: BarChart3, active: leads.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" style={{ color: AMBER }} />
          Floor 9 — AI Brain
        </h1>
        <p className="text-muted-foreground">Self-learning intelligence engine — scripts, scoring, and optimization</p>
      </div>

      {/* AI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Interactions Analyzed', value: totalInteractions, icon: MessageSquare, color: 'text-blue-400' },
          { label: 'Avg Sentiment', value: avgSentiment, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Objections Found', value: objectionCount, icon: Zap, color: 'text-orange-400' },
          { label: 'Avg Lead Score', value: avgLeadScore, icon: Brain, color: 'text-purple-400' },
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

      {/* AI Capabilities */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" style={{ color: AMBER }} />
            Self-Learning Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins) => (
              <div key={ins.title} className="flex items-start gap-3 p-4 rounded-lg border border-border/50 bg-muted/20">
                <ins.icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: AMBER }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{ins.title}</p>
                    <Badge variant={ins.active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      {ins.active ? 'Active' : 'Waiting'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ins.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Objections */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Top Objections Detected</CardTitle>
          </CardHeader>
          <CardContent>
            {topObjections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No objections detected yet. Data populates after call interactions.</p>
            ) : (
              <div className="space-y-3">
                {topObjections.map(([obj, count]) => (
                  <div key={obj} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{obj}</span>
                    <Badge variant="outline">{count}x</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Performance */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Lead Source Quality</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(sourceMap).length === 0 ? (
              <p className="text-sm text-muted-foreground">No lead source data yet. Import leads to see analysis.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(sourceMap).map(([source, data]) => (
                  <div key={source} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize">{source}</p>
                      <p className="text-xs text-muted-foreground">{data.count} leads</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: AMBER }}>
                        {(data.totalScore / data.count).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">avg score</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent AI Activity */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Recent AI Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI activity yet. The brain learns from every interaction.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {interactions.slice(0, 10).map((i: any) => (
                <div key={i.id} className="flex items-center gap-3 p-2 rounded bg-muted/20 text-sm">
                  <Badge variant="outline" className="text-[10px] shrink-0">{i.type}</Badge>
                  <p className="truncate flex-1">{i.summary || 'Interaction recorded'}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    sentiment: {i.sentiment_score?.toFixed(1) || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
