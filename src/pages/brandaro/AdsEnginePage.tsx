import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdsOverview } from '@/hooks/useBrandaroAdsEngine';
import { Megaphone, Users, DollarSign, TrendingUp, Target, Zap, BarChart3, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;

export default function AdsEnginePage() {
  const {
    internalAds, clientAds, adLeads,
    totalInternalSpend, totalInternalLeads, totalInternalRevenue,
    totalClientSpend, totalClientLeads, totalServiceFees,
    inboundToday, conversionRate, activeInternalCount, activeClientCount,
  } = useAdsOverview();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ads & Lead Engine</h1>
          <p className="text-muted-foreground">Automated lead printing machine — internal + client campaigns</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{inboundToday}</p>
            <p className="text-xs text-muted-foreground">Inbound Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto text-accent-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalInternalLeads + totalClientLeads}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{fmt(totalServiceFees)}/mo</p>
            <p className="text-xs text-muted-foreground">Client Service Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="internal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="internal">🚀 Internal Ads ({activeInternalCount})</TabsTrigger>
          <TabsTrigger value="client">💰 Client Ads ({activeClientCount})</TabsTrigger>
          <TabsTrigger value="leads">📥 Inbound Leads ({adLeads.length})</TabsTrigger>
        </TabsList>

        {/* Internal Ads */}
        <TabsContent value="internal" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalInternalSpend)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Leads Generated</p>
                <p className="text-xl font-bold text-foreground">{totalInternalLeads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Revenue from Ads</p>
                <p className="text-xl font-bold text-primary">{fmt(totalInternalRevenue)}</p>
              </CardContent>
            </Card>
          </div>
          {internalAds.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No internal campaigns yet. Create your first campaign to start generating inbound leads.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {internalAds.map((ad: any) => (
                <Card key={ad.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={ad.status === 'active' ? 'default' : 'secondary'}>{ad.status}</Badge>
                      <div>
                        <p className="font-medium text-foreground">{ad.campaign_name}</p>
                        <p className="text-xs text-muted-foreground">{ad.platform} · ${Number(ad.budget_daily).toFixed(0)}/day</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{ad.leads_generated} leads</p>
                      <p className="text-xs text-muted-foreground">${Number(ad.cost_per_lead || 0).toFixed(2)}/lead</p>
                    </div>
                    <div className="text-right">
                      {Number(ad.roi_pct || 0) > 0 ? (
                        <p className="text-sm font-bold text-primary">+{Number(ad.roi_pct).toFixed(0)}% ROI</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{fmt(Number(ad.total_spent || 0))} spent</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Client Ads */}
        <TabsContent value="client" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Client Ad Spend</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalClientSpend)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Client Leads</p>
                <p className="text-xl font-bold text-foreground">{totalClientLeads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Monthly Fees</p>
                <p className="text-xl font-bold text-primary">{fmt(totalServiceFees)}/mo</p>
              </CardContent>
            </Card>
          </div>
          {clientAds.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No client ad campaigns yet. Upsell ads management to your active clients.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {clientAds.map((ad: any) => (
                <Card key={ad.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={ad.status === 'active' ? 'default' : 'secondary'}>{ad.status}</Badge>
                      <div>
                        <p className="font-medium text-foreground">{ad.client_name || 'Client'}</p>
                        <p className="text-xs text-muted-foreground">{ad.platform} · {ad.campaign_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{ad.leads_generated} leads</p>
                      <p className="text-xs text-muted-foreground">${Number(ad.cost_per_lead || 0).toFixed(2)}/lead</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{fmt(Number(ad.service_fee))}/mo fee</p>
                      {Number(ad.roi_pct || 0) > 0 && (
                        <p className="text-xs text-muted-foreground">+{Number(ad.roi_pct).toFixed(0)}% ROI</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Inbound Leads */}
        <TabsContent value="leads" className="space-y-4">
          {adLeads.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No inbound ad leads yet. Launch campaigns to start receiving leads automatically.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {adLeads.map((lead: any) => (
                <Card key={lead.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={lead.converted ? 'default' : lead.status === 'new' ? 'destructive' : 'secondary'}>
                        {lead.converted ? 'Converted' : lead.status}
                      </Badge>
                      <div>
                        <p className="font-medium text-foreground">{lead.business_name || lead.contact_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{lead.industry} · {lead.source_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.auto_called && <Badge variant="outline" className="text-xs">Called</Badge>}
                      {lead.demo_generated && <Badge variant="outline" className="text-xs">Demo</Badge>}
                      <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Failsafe Alerts */}
      {internalAds.some((a: any) => Number(a.cost_per_lead || 0) > 50 && a.status === 'active') && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-foreground">High CPL Alert</p>
              <p className="text-sm text-muted-foreground">Some campaigns have cost per lead above $50. Consider pausing and optimizing.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
