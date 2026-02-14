// ═══════════════════════════════════════════════════════════════════════════════
// AI ACTION OUTCOME ATTRIBUTION — Phase 9: Read-Only Executive Analytics
// ═══════════════════════════════════════════════════════════════════════════════
// Connects AI confidence → human action → real-world outcomes.
// No writes, no toggles, no sliders, no "Apply changes" buttons.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Info, ShieldAlert, Activity, BarChart3, Layers } from 'lucide-react';
import { useActionOutcomeAttribution, ConfidenceBandOutcome, FalseConfidenceZone } from '@/hooks/useActionOutcomeAttribution';

export function AIActionOutcomeAttribution() {
  const { analysis, isLoading } = useActionOutcomeAttribution();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <GovernanceBanner />
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Computing outcome attribution...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysis || analysis.totalRecords === 0) {
    return (
      <div className="space-y-4">
        <GovernanceBanner />
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No attribution data available yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Outcome attribution requires AI dispatch feedback events with downstream data.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <GovernanceBanner />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Acceptance → Success"
            value={`${analysis.kpis.overallAcceptanceSuccessRate}%`}
            description="Applied suggestions that led to positive outcomes"
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          />
          <KPICard
            title="Rejection → Missed"
            value={`${analysis.kpis.overallRejectionMissedRate}%`}
            description="Dismissed suggestions where outcomes were positive"
            icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          />
          <KPICard
            title="Correction Lift"
            value={`${analysis.kpis.correctionLiftPercent > 0 ? '+' : ''}${analysis.kpis.correctionLiftPercent}%`}
            description="Improvement from Phase 8 confidence corrections"
            icon={analysis.kpis.correctionLiftPercent >= 0
              ? <TrendingUp className="h-5 w-5 text-green-500" />
              : <TrendingDown className="h-5 w-5 text-red-500" />}
          />
          <KPICard
            title="Total Attributed"
            value={`${analysis.kpis.totalAttributed}`}
            description="Feedback events with downstream outcomes"
            icon={<Layers className="h-5 w-5 text-primary" />}
          />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="confidence-outcome" className="space-y-4">
          <TabsList>
            <TabsTrigger value="confidence-outcome">Confidence → Outcome</TabsTrigger>
            <TabsTrigger value="trust-delta">Trust Delta</TabsTrigger>
            <TabsTrigger value="false-zones">False Confidence</TabsTrigger>
            <TabsTrigger value="contextual">Contextual</TabsTrigger>
          </TabsList>

          {/* Tab 1: Confidence Band vs Outcome */}
          <TabsContent value="confidence-outcome" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Raw Confidence → Outcomes</CardTitle>
                <CardDescription>
                  Success and missed opportunity rates by raw AI confidence band
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BandOutcomeTable bands={analysis.rawBands} label="Raw" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Displayed Confidence → Outcomes</CardTitle>
                <CardDescription>
                  Same analysis using Phase 8 corrected confidence values
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BandOutcomeTable bands={analysis.displayedBands} label="Displayed" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Trust Delta */}
          <TabsContent value="trust-delta">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Correction Lift Analysis</CardTitle>
                <CardDescription>
                  Did Phase 8 confidence corrections improve alignment between confidence and outcomes?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Band</TableHead>
                      <TableHead className="text-right">Raw Success %</TableHead>
                      <TableHead className="text-right">Corrected Success %</TableHead>
                      <TableHead className="text-right">Lift Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.correctionLift.map(cl => (
                      <TableRow key={cl.band}>
                        <TableCell className="font-mono text-sm">{cl.band}%</TableCell>
                        <TableCell className="text-right">{cl.rawAcceptanceSuccess}%</TableCell>
                        <TableCell className="text-right">{cl.displayedAcceptanceSuccess}%</TableCell>
                        <TableCell className="text-right">
                          <LiftBadge lift={cl.lift} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <strong>Overall Correction Lift:</strong>{' '}
                  <LiftBadge lift={analysis.overallLift} />
                  <span className="ml-2">
                    — {analysis.overallLift >= 0
                      ? 'Corrections are improving outcome alignment.'
                      : 'Corrections have not yet improved outcome alignment.'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: False Confidence Zones */}
          <TabsContent value="false-zones">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">False Confidence Zones</CardTitle>
                <CardDescription>
                  Bands where confidence and outcomes diverge significantly
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.falseZones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No false confidence zones detected with current data.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analysis.falseZones.map((zone, i) => (
                      <FalseZoneCard key={i} zone={zone} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Contextual Slices */}
          <TabsContent value="contextual" className="space-y-4">
            {analysis.contextualSlices.map(cs => (
              <Card key={cs.dimension}>
                <CardHeader>
                  <CardTitle className="text-base">By {cs.dimension}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cs.slices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Insufficient data for this dimension.</p>
                  ) : (
                    cs.slices.map(slice => (
                      <div key={slice.label}>
                        <h4 className="text-sm font-medium mb-2 capitalize">{slice.label}</h4>
                        <BandOutcomeTable bands={slice.bands} label={slice.label} compact />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function GovernanceBanner() {
  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-blue-500 shrink-0" />
          <div>
            <p className="font-semibold text-blue-500 text-sm">Read-Only Analysis</p>
            <p className="text-xs text-muted-foreground">
              No system behavior is modified by these results. This is observational attribution only — no feedback loops, no learning hooks, no scoring changes.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KPICard({ title, value, description, icon }: {
  title: string; value: string; description: string; icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function BandOutcomeTable({ bands, label, compact }: {
  bands: ConfidenceBandOutcome[]; label: string; compact?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Band</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Applied</TableHead>
          <TableHead className="text-right">Dismissed</TableHead>
          {!compact && <TableHead className="text-right">Ignored</TableHead>}
          <TableHead className="text-right">
            <Tooltip>
              <TooltipTrigger className="underline decoration-dotted">Success %</TooltipTrigger>
              <TooltipContent>Applied suggestions leading to positive outcomes</TooltipContent>
            </Tooltip>
          </TableHead>
          <TableHead className="text-right">
            <Tooltip>
              <TooltipTrigger className="underline decoration-dotted">Missed %</TooltipTrigger>
              <TooltipContent>Dismissed suggestions where outcomes were positive anyway</TooltipContent>
            </Tooltip>
          </TableHead>
          {!compact && <TableHead className="text-right">SLA Breach %</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {bands.map(band => (
          <TableRow key={band.range}>
            <TableCell className="font-mono text-sm">{band.range}%</TableCell>
            <TableCell className="text-right">{band.total}</TableCell>
            <TableCell className="text-right">{band.applied}</TableCell>
            <TableCell className="text-right">{band.dismissed}</TableCell>
            {!compact && <TableCell className="text-right">{band.ignored}</TableCell>}
            <TableCell className="text-right">
              <span className={band.successRate >= 60 ? 'text-green-500' : band.successRate >= 40 ? 'text-amber-500' : 'text-red-500'}>
                {band.successRate}%
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className={band.missedOpportunityRate >= 30 ? 'text-amber-500' : 'text-muted-foreground'}>
                {band.missedOpportunityRate}%
              </span>
            </TableCell>
            {!compact && (
              <TableCell className="text-right">
                <span className={band.slaBreachRate > 10 ? 'text-red-500' : 'text-muted-foreground'}>
                  {band.slaBreachRate}%
                </span>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LiftBadge({ lift }: { lift: number }) {
  if (lift === 0) return <Badge variant="outline" className="text-xs">0%</Badge>;
  if (lift > 0) return <Badge className="bg-green-500/10 text-green-500 text-xs">+{lift}%</Badge>;
  return <Badge className="bg-red-500/10 text-red-500 text-xs">{lift}%</Badge>;
}

function FalseZoneCard({ zone }: { zone: FalseConfidenceZone }) {
  const isHigh = zone.type === 'high_confidence_poor_outcome';
  return (
    <Card className={isHigh ? 'border-red-500/30' : 'border-amber-500/30'}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          {isHigh
            ? <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            : <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{zone.range}%</span>
              <Badge variant="outline" className={isHigh ? 'text-red-500' : 'text-amber-500'}>
                {isHigh ? 'Overconfident' : 'Underconfident'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Success: {zone.successRate}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{zone.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AIActionOutcomeAttribution;
