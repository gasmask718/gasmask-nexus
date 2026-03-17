import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useGlobalPerformance } from '@/hooks/useBrandaroOptimization';
import { Brain, Zap, TrendingUp, AlertTriangle, Rocket, PauseCircle, DollarSign, Target, Search, BarChart3, ArrowUpRight } from 'lucide-react';

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;

const priorityColor: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-primary text-primary-foreground',
  medium: 'bg-secondary text-secondary-foreground',
  low: 'bg-muted text-muted-foreground',
};

const typeIcon: Record<string, typeof Zap> = {
  scale: Rocket,
  pause: PauseCircle,
  alert: AlertTriangle,
  expand: ArrowUpRight,
  duplicate: Zap,
};

export default function OptimizationEnginePage() {
  const {
    topInternalAds, topClientAds, topSEOPages,
    highCPL, negativeROI, scalable, hotLeads,
    recommendations, optimizationLog,
    totalAdRevenue, totalSEOLeads, totalMRR,
    adsOverview, seoOverview,
  } = useGlobalPerformance();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Self-Optimization Engine</h1>
          <p className="text-muted-foreground">AI-driven performance analysis · auto-scaling · revenue intelligence</p>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{fmt(totalMRR)}/mo</p>
            <p className="text-xs text-muted-foreground">Total Service MRR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{fmt(totalAdRevenue)}</p>
            <p className="text-xs text-muted-foreground">Ad Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Search className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalSEOLeads}</p>
            <p className="text-xs text-muted-foreground">SEO Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Rocket className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{scalable.length}</p>
            <p className="text-xs text-muted-foreground">Ready to Scale</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {(negativeROI.length > 0 || highCPL.length > 0) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="font-bold text-foreground">Action Required</p>
            </div>
            {negativeROI.map((c: any) => (
              <p key={c.id} className="text-sm text-muted-foreground">
                🔴 <span className="font-medium">"{c.campaign_name}"</span> has negative ROI ({Number(c.roi_pct).toFixed(0)}%) — consider pausing
              </p>
            ))}
            {highCPL.map((c: any) => (
              <p key={c.id} className="text-sm text-muted-foreground">
                🟡 <span className="font-medium">"{c.campaign_name}"</span> CPL spike — ${Number(c.cost_per_lead).toFixed(2)}/lead
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="recommendations">🧠 Recommendations ({recommendations.length})</TabsTrigger>
          <TabsTrigger value="performers">🏆 Top Performers</TabsTrigger>
          <TabsTrigger value="leads">🔥 Hot Leads ({hotLeads.length})</TabsTrigger>
          <TabsTrigger value="log">📋 Action Log ({optimizationLog.length})</TabsTrigger>
        </TabsList>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-3">
          {recommendations.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No recommendations yet. Add campaigns and SEO pages to start getting optimization insights.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {recommendations.map((r, i) => {
                const Icon = typeIcon[r.type] || Zap;
                return (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{r.text}</p>
                        <p className="text-xs text-muted-foreground capitalize">{r.engine} · {r.type}</p>
                      </div>
                      <Badge className={priorityColor[r.priority]}>{r.priority}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Top Performers */}
        <TabsContent value="performers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Ad Campaigns */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" /> Top Ad Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topInternalAds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active campaigns</p>
                ) : topInternalAds.map((ad: any, i: number) => (
                  <div key={ad.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{ad.campaign_name}</p>
                        <p className="text-xs text-muted-foreground">{ad.platform} · L{ad.scaling_level || 1}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">+{Number(ad.roi_pct || 0).toFixed(0)}% ROI</p>
                      <p className="text-xs text-muted-foreground">Score: {Number(ad.performance_score || 0).toFixed(1)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top SEO Pages */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" /> Top SEO Pages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topSEOPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No SEO pages yet</p>
                ) : topSEOPages.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{p.page_title || p.slug}</p>
                        <p className="text-xs text-muted-foreground">{p.city} · {p.industry}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{p.clicks} clicks</p>
                      <p className="text-xs text-muted-foreground">{p.leads_generated || 0} leads</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Client Campaigns */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Top Client Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topClientAds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No client campaigns</p>
                ) : topClientAds.map((ad: any, i: number) => (
                  <div key={ad.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{ad.client_name || 'Client'}</p>
                        <p className="text-xs text-muted-foreground">{ad.platform} · {ad.campaign_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">${Number(ad.service_fee || 0).toLocaleString()}/mo</p>
                      <p className="text-xs text-muted-foreground">+{Number(ad.roi_pct || 0).toFixed(0)}% ROI</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Revenue Attribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Revenue Attribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid Ads</span>
                    <span className="font-medium text-foreground">{fmt(totalAdRevenue)}</span>
                  </div>
                  <Progress value={totalAdRevenue > 0 ? Math.min((totalAdRevenue / (totalAdRevenue + totalSEOLeads * 500 + 1)) * 100, 100) : 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SEO / Organic</span>
                    <span className="font-medium text-foreground">{totalSEOLeads} leads</span>
                  </div>
                  <Progress value={totalSEOLeads > 0 ? Math.min((totalSEOLeads / (totalSEOLeads + 1)) * 50, 100) : 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service MRR</span>
                    <span className="font-bold text-primary">{fmt(totalMRR)}/mo</span>
                  </div>
                  <Progress value={totalMRR > 0 ? Math.min(totalMRR / 100000 * 100, 100) : 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hot Leads */}
        <TabsContent value="leads" className="space-y-3">
          {hotLeads.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No high-quality leads yet. Leads earn quality scores from calls (+20), demo views (+30), and payment intent (+50).</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {hotLeads.map((lead: any) => (
                <Card key={lead.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{lead.lead_quality_score}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{lead.business_name || lead.contact_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.industry} · {lead.source_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.auto_called && <Badge variant="outline" className="text-xs">Called</Badge>}
                      {lead.demo_generated && <Badge variant="outline" className="text-xs">Demo</Badge>}
                      {lead.converted && <Badge className="text-xs">Converted</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Action Log */}
        <TabsContent value="log" className="space-y-3">
          {optimizationLog.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No optimization actions logged yet. The system records auto-scaling decisions and manual interventions.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {optimizationLog.map((entry: any) => (
                <Card key={entry.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={entry.auto_executed ? 'default' : 'secondary'}>
                        {entry.auto_executed ? 'Auto' : 'Manual'}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-foreground">{entry.recommendation}</p>
                        <p className="text-xs text-muted-foreground">{entry.engine} · {entry.action_type}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
