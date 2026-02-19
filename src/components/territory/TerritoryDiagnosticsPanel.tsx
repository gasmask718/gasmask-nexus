/**
 * TerritoryDiagnosticsPanel - Read-only admin panel for territory intelligence health
 * Shows geo_identities coverage, verification rates, and API usage estimates
 */
import { useQuery } from '@tanstack/react-query';
import { MapPin, CheckCircle2, AlertTriangle, Globe, Clock, Shield, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

export function TerritoryDiagnosticsPanel() {
  const { data: diagnostics, isLoading } = useQuery({
    queryKey: ['territory-diagnostics'],
    queryFn: async () => {
      // Fetch geo_identities stats
      const { data: geoRows, error: geoErr } = await supabase
        .from('geo_identities')
        .select('id, verified, last_geo_check, source, region_name, neighborhood, city, created_at');
      if (geoErr) throw geoErr;

      const geo = geoRows || [];
      const total = geo.length;
      const verified = geo.filter(g => g.verified).length;
      const unverified = total - verified;
      const withRegion = geo.filter(g => g.region_name).length;
      const withNeighborhood = geo.filter(g => g.neighborhood).length;

      // Last sync time
      const lastCheck = geo
        .filter(g => g.last_geo_check)
        .sort((a, b) => new Date(b.last_geo_check!).getTime() - new Date(a.last_geo_check!).getTime())[0];

      // Source breakdown
      const bySource: Record<string, number> = {};
      geo.forEach(g => {
        bySource[g.source || 'unknown'] = (bySource[g.source || 'unknown'] || 0) + 1;
      });

      // Stores without geo
      const { count: storesTotal } = await supabase
        .from('store_master')
        .select('id', { count: 'exact', head: true });
      const { count: storesWithGeo } = await supabase
        .from('store_master')
        .select('id', { count: 'exact', head: true })
        .not('geo_id', 'is', null);

      const storesWithout = (storesTotal || 0) - (storesWithGeo || 0);

      return {
        total,
        verified,
        unverified,
        withRegion,
        withNeighborhood,
        lastSync: lastCheck?.last_geo_check || null,
        bySource,
        storesTotal: storesTotal || 0,
        storesWithGeo: storesWithGeo || 0,
        storesWithout,
        verificationRate: total > 0 ? Math.round((verified / total) * 100) : 0,
        coverageRate: (storesTotal || 0) > 0 ? Math.round(((storesWithGeo || 0) / (storesTotal || 0)) * 100) : 0,
      };
    },
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading territory diagnostics...</CardContent>
      </Card>
    );
  }

  if (!diagnostics) return null;

  return (
    <div className="space-y-6">
      {/* Governance Banner */}
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Shield className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-muted-foreground">
          Territory diagnostics are read-only and observational. No auto-sync or enforcement is active.
        </AlertDescription>
      </Alert>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Globe className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{diagnostics.total}</div>
            <p className="text-xs text-muted-foreground">Geo Identities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <div className="text-xl font-bold">{diagnostics.verified}</div>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="text-xl font-bold">{diagnostics.unverified}</div>
            <p className="text-xs text-muted-foreground">Unverified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MapPin className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{diagnostics.storesWithout}</div>
            <p className="text-xs text-muted-foreground">Stores No Geo</p>
          </CardContent>
        </Card>
      </div>

      {/* Coverage & Verification Bars */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Store Coverage</CardTitle>
            <CardDescription>{diagnostics.storesWithGeo} of {diagnostics.storesTotal} stores geo-resolved</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={diagnostics.coverageRate} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground text-right">{diagnostics.coverageRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verification Rate</CardTitle>
            <CardDescription>{diagnostics.verified} of {diagnostics.total} identities verified</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={diagnostics.verificationRate} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground text-right">{diagnostics.verificationRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resolution Depth</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">With Region</span>
              <Badge variant="outline">{diagnostics.withRegion}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">With Neighborhood</span>
              <Badge variant="outline">{diagnostics.withNeighborhood}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Sync</span>
              <span className="text-sm">
                {diagnostics.lastSync
                  ? new Date(diagnostics.lastSync).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(diagnostics.bySource).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{source}</span>
                <Badge variant="secondary">{count as number}</Badge>
              </div>
            ))}
            {Object.keys(diagnostics.bySource).length === 0 && (
              <p className="text-sm text-muted-foreground">No sources recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* API Usage Estimate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            API Usage Estimate
          </CardTitle>
          <CardDescription>Estimated Mapbox API calls based on current data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stores needing geocoding</span>
            <span className="font-medium">{diagnostics.storesWithout}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Est. API calls (1 per store)</span>
            <span className="font-medium">{diagnostics.storesWithout}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Re-verification queue</span>
            <span className="font-medium">{diagnostics.unverified}</span>
          </div>
          <p className="text-xs text-muted-foreground italic mt-2">
            Estimates are advisory. No background sync is active. Geocoding must be triggered manually.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default TerritoryDiagnosticsPanel;
