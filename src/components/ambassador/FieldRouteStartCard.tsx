/**
 * FieldRouteStartCard — set/change the start address of one route and
 * (re)build a practical driving sequence from it.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Navigation, RefreshCw, AlertTriangle } from 'lucide-react';
import { useRouteStart, useOptimizeFieldRoute } from '@/hooks/useFieldRouteOptimizer';

interface Props {
  routeId: string;
  stopCount: number;
}

export function FieldRouteStartCard({ routeId, stopCount }: Props) {
  const { data: routeStart } = useRouteStart(routeId);
  const { optimize, isOptimizing, markStale } = useOptimizeFieldRoute();
  const [address, setAddress] = useState('');
  const [fillCount, setFillCount] = useState(12);

  useEffect(() => {
    setAddress(routeStart?.start_address ?? '');
  }, [routeStart?.start_address, routeId]);

  const saved = routeStart?.start_address ?? '';
  const changed = address.trim().length > 0 && address.trim() !== saved;
  const stale = !!routeStart?.sequence_stale;

  const run = async (autoFill = 0) => {
    if (!address.trim()) return;
    await optimize({ routeId, startAddress: address.trim(), autoFill });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="h-4 w-4" /> Start address &amp; stop order
        </CardTitle>
        <CardDescription>
          Where your day begins. Changing it recalculates the driving order of your stops.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="route-start-address">Start address</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="route-start-address"
              value={address}
              placeholder="e.g. 1200 Flatbush Ave, Brooklyn, NY"
              onChange={(e) => {
                setAddress(e.target.value);
                if (saved && e.target.value.trim() !== saved && !stale) markStale(routeId);
              }}
            />
            <Button onClick={() => run(0)} disabled={isOptimizing || !address.trim()}>
              {isOptimizing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {stopCount ? 'Set start & reorder stops' : 'Save start address'}
            </Button>
          </div>
        </div>

        {stopCount === 0 && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="route-fill-count">Build from my nearest stores</Label>
              <Input
                id="route-fill-count"
                type="number"
                min={1}
                max={40}
                value={fillCount}
                onChange={(e) => setFillCount(Number(e.target.value) || 1)}
                className="w-28"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => run(fillCount)}
              disabled={isOptimizing || !address.trim()}
            >
              {isOptimizing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Build optimized route
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {saved && <Badge variant="secondary">Start: {saved}</Badge>}
          {routeStart?.estimated_duration_minutes ? (
            <Badge variant="outline">
              ~{routeStart.estimated_duration_minutes} min · {routeStart.estimated_distance_km} km
            </Badge>
          ) : null}
          {(stale || changed) && (
            <span className="flex items-center gap-1 text-amber-500">
              <AlertTriangle className="h-4 w-4" /> Stop order is out of date for this start address
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default FieldRouteStartCard;
