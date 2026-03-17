import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSEOOverview } from '@/hooks/useBrandaroSEO';
import { Globe, FileText, Layers, MapPin, Users, TrendingUp, Search, Lightbulb, BarChart3 } from 'lucide-react';

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

export default function GoogleDominationPage() {
  const {
    pages, clusters, rankings, clientSeo,
    published, indexed, totalImpressions, totalClicks,
    activeClusters, totalTrafficEst, activeClientSeo, seoMRR,
    topCities, topIndustries,
  } = useSEOOverview();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Google Domination Engine</h1>
          <p className="text-muted-foreground">SEO pages · keyword clusters · local rankings · client SEO services</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { icon: FileText, label: 'Pages Published', value: published },
          { icon: Search, label: 'Indexed', value: indexed },
          { icon: BarChart3, label: 'Impressions', value: fmt(totalImpressions) },
          { icon: TrendingUp, label: 'Clicks', value: fmt(totalClicks) },
          { icon: Layers, label: 'Active Clusters', value: activeClusters },
          { icon: Users, label: 'SEO Clients', value: activeClientSeo },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <kpi.icon className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SEO MRR highlight */}
      {seoMRR > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">SEO Service MRR</p>
              <p className="text-2xl font-bold text-primary">${seoMRR.toLocaleString()}/mo</p>
            </div>
            <p className="text-sm text-muted-foreground">Est. traffic: {fmt(totalTrafficEst)}/mo</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pages" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pages">📄 SEO Pages ({pages.length})</TabsTrigger>
          <TabsTrigger value="clusters">🧠 Clusters ({clusters.length})</TabsTrigger>
          <TabsTrigger value="rankings">📍 Rankings ({rankings.length})</TabsTrigger>
          <TabsTrigger value="client">💰 Client SEO ({clientSeo.length})</TabsTrigger>
          <TabsTrigger value="opportunities">💡 Opportunities</TabsTrigger>
        </TabsList>

        {/* SEO Pages */}
        <TabsContent value="pages" className="space-y-3">
          {pages.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No SEO pages yet. Generate city + service pages to start dominating local search.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {pages.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={p.status === 'published' ? 'default' : 'secondary'}>{p.status}</Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{p.page_title || p.slug}</p>
                        <p className="text-xs text-muted-foreground">{p.city}{p.state ? `, ${p.state}` : ''} · {p.industry} · {p.keyword_primary}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right shrink-0">
                      {p.indexed && <Badge variant="outline" className="text-xs">Indexed</Badge>}
                      <div>
                        <p className="text-sm font-bold text-foreground">{p.clicks} clicks</p>
                        <p className="text-xs text-muted-foreground">{p.impressions} impr · {Number(p.ctr || 0).toFixed(1)}% CTR</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Clusters */}
        <TabsContent value="clusters" className="space-y-3">
          {clusters.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No keyword clusters yet. Build topical clusters to dominate search verticals.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((c: any) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{c.cluster_name}</CardTitle>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">{c.industry} · {c.city}</p>
                    <p className="text-sm"><span className="font-medium text-foreground">Pillar:</span> {c.pillar_keyword}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{c.page_count} pages</span>
                      <span className="text-primary font-medium">{fmt(c.traffic_estimate)} est. traffic</span>
                    </div>
                    {c.support_keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.support_keywords.slice(0, 5).map((kw: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rankings */}
        <TabsContent value="rankings" className="space-y-3">
          {rankings.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No ranking data yet. Track your target keywords to monitor Google position.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {rankings.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{r.target_keyword}</p>
                      <p className="text-xs text-muted-foreground">{r.city}{r.state ? `, ${r.state}` : ''} · {r.domain}</p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-lg font-bold text-foreground">#{Number(r.avg_position).toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Avg Position</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.clicks} clicks</p>
                        <p className="text-xs text-muted-foreground">{Number(r.ctr || 0).toFixed(1)}% CTR</p>
                      </div>
                      <div>
                        <Progress value={Math.min(r.rank_score || 0, 100)} className="w-16 h-2" />
                        <p className="text-xs text-muted-foreground mt-1">Score: {r.rank_score}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Client SEO */}
        <TabsContent value="client" className="space-y-3">
          {clientSeo.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No SEO clients yet. Upsell Local SEO services to your website clients.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {clientSeo.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{c.client_name || 'Client'}</p>
                        <p className="text-xs text-muted-foreground">{c.domain} · {c.city}{c.state ? `, ${c.state}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right shrink-0">
                      <div>
                        <p className="text-sm font-bold text-foreground">{c.pages_created} pages</p>
                        <p className="text-xs text-muted-foreground">{c.current_traffic} traffic</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">${Number(c.service_fee).toLocaleString()}/mo</p>
                        <p className="text-xs text-muted-foreground">+{Number(c.ranking_growth_pct || 0).toFixed(0)}% growth</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Top Cities</CardTitle>
              </CardHeader>
              <CardContent>
                {topCities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add city pages to see top locations</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topCities.map((city, i) => (
                      <Badge key={i} variant="outline">{city}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Top Industries</CardTitle>
              </CardHeader>
              <CardContent>
                {topIndustries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add industry pages to see verticals</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topIndustries.map((ind, i) => (
                      <Badge key={i} variant="outline">{ind}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" /> Attack Recommendations</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Generate city + service pages for underserved markets</li>
                <li>• Build topical clusters around high-close-rate industries</li>
                <li>• Expand winning SEO clusters with support content</li>
                <li>• Duplicate best-performing page structures to new cities</li>
                <li>• Upsell SEO services to active website clients</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
