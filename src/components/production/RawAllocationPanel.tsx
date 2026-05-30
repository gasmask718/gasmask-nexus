/**
 * RAW ALLOCATION PANEL
 * Executive overview of material reservations + manual override controls.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useAllocationOverview,
  useMaterialInventory,
  useUpdateMaterialInventory,
  useOverrideAllocation,
  useAllocationOverrides,
  useRunAutoReservation,
} from '@/hooks/useMaterialAllocations';
import {
  Warehouse,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Edit,
  History,
  Loader2,
  Package,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  officeId: string;
}

function getCoverageColor(pct: number) {
  if (pct >= 30) return 'text-emerald-500';
  if (pct >= 20) return 'text-amber-500';
  return 'text-destructive';
}

function getCoverageBadge(pct: number) {
  if (pct >= 30) return 'default' as const;
  if (pct >= 20) return 'secondary' as const;
  return 'destructive' as const;
}

export function RawAllocationPanel({ officeId }: Props) {
  const { data: overview, isLoading } = useAllocationOverview(officeId);
  const { data: inventory } = useMaterialInventory(officeId);
  const { data: overrides = [] } = useAllocationOverrides(officeId);
  const updateInventory = useUpdateMaterialInventory();
  const overrideAllocation = useOverrideAllocation();
  const runAutoReserve = useRunAutoReservation();

  const [inventoryDialog, setInventoryDialog] = useState(false);
  const [inventoryLbs, setInventoryLbs] = useState('');
  const [overrideDialog, setOverrideDialog] = useState<'tubes' | 'bags' | null>(null);
  const [overrideLbs, setOverrideLbs] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const totalLbs = Number(overview?.total_lbs_available) || 0;
  const tubesReserved = Number(overview?.tubes_reserved_lbs) || 0;
  const bagsReserved = Number(overview?.bags_reserved_lbs) || 0;
  const unallocated = Number(overview?.unallocated_lbs) || 0;
  const unallocatedPct = Number(overview?.unallocated_pct) || 0;
  const bufferRisk = unallocatedPct < 10 && totalLbs > 0;

  const handleUpdateInventory = async () => {
    const lbs = parseFloat(inventoryLbs);
    if (isNaN(lbs) || lbs < 0) return;
    await updateInventory.mutateAsync({ officeId, totalLbs: lbs });
    setInventoryDialog(false);
    setInventoryLbs('');
  };

  const handleOverride = async () => {
    if (!overrideDialog || !overrideReason.trim()) return;
    const lbs = parseFloat(overrideLbs);
    if (isNaN(lbs) || lbs < 0) return;
    await overrideAllocation.mutateAsync({
      officeId,
      productType: overrideDialog,
      newManualLbs: lbs,
      reason: overrideReason,
    });
    setOverrideDialog(null);
    setOverrideLbs('');
    setOverrideReason('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading allocation data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Buffer Risk Alert */}
      {bufferRisk && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Raw Buffer Risk:</strong> Unallocated tobacco is below 10% ({unallocatedPct.toFixed(1)}%).
            Procure more tobacco or adjust allocations.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Allocation Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Warehouse className="h-4 w-4" />
                Raw Allocation Overview
              </CardTitle>
              <CardDescription>Logical tobacco reservation across product types</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAutoReserve.mutate()}
                disabled={runAutoReserve.isPending}
              >
                {runAutoReserve.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                Auto-Reserve
              </Button>
              <Dialog open={inventoryDialog} onOpenChange={setInventoryDialog}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setInventoryLbs(String(totalLbs || ''))}
                  >
                    <Package className="h-3.5 w-3.5 mr-1" />
                    Set Inventory
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Total Tobacco Inventory</DialogTitle>
                    <DialogDescription>Set the total physical lbs available at this office.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <Label>Total LBS Available</Label>
                    <Input
                      type="number"
                      value={inventoryLbs}
                      onChange={(e) => setInventoryLbs(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleUpdateInventory} disabled={updateInventory.isPending}>
                      {updateInventory.isPending ? 'Saving...' : 'Update Inventory'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Total LBS */}
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total LBS</p>
              <p className="text-2xl font-bold font-mono">{totalLbs.toLocaleString()}</p>
            </div>

            {/* Tubes Reserved */}
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">🔧 Tubes</p>
              <p className="text-2xl font-bold font-mono">{tubesReserved.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">lbs reserved</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 text-xs"
                onClick={() => {
                  setOverrideDialog('tubes');
                  setOverrideLbs(String(overview?.tubes_manual_reserved || 0));
                }}
              >
                <Edit className="h-3 w-3 mr-1" />
                Override
              </Button>
            </div>

            {/* Bags Reserved */}
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">👜 Bags</p>
              <p className="text-2xl font-bold font-mono">{bagsReserved.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">lbs reserved</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 text-xs"
                onClick={() => {
                  setOverrideDialog('bags');
                  setOverrideLbs(String(overview?.bags_manual_reserved || 0));
                }}
              >
                <Edit className="h-3 w-3 mr-1" />
                Override
              </Button>
            </div>

            {/* Unallocated */}
            <div className={cn(
              'p-3 rounded-lg text-center',
              bufferRisk ? 'bg-destructive/10' : 'bg-muted/50'
            )}>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Unallocated</p>
              <p className={cn('text-2xl font-bold font-mono', bufferRisk && 'text-destructive')}>
                {unallocated.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{unallocatedPct.toFixed(1)}% buffer</p>
            </div>

            {/* Coverage Status */}
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Coverage</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant={getCoverageBadge(overview?.tubes_coverage_target || 0)}>
                  🔧 {overview?.tubes_coverage_target || 30}d
                </Badge>
                <Badge variant={getCoverageBadge(overview?.bags_coverage_target || 0)}>
                  👜 {overview?.bags_coverage_target || 30}d
                </Badge>
              </div>
              <div className="flex items-center justify-center gap-1 mt-2">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Protected</span>
              </div>
            </div>
          </div>

          {/* Breakdown detail */}
          {overview && (
            <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium mb-1">🔧 Tubes Breakdown</p>
                <p className="text-muted-foreground">Auto: {Number(overview.tubes_auto_reserved).toLocaleString()} lbs</p>
                <p className="text-muted-foreground">Manual: {Number(overview.tubes_manual_reserved).toLocaleString()} lbs</p>
              </div>
              <div>
                <p className="font-medium mb-1">👜 Bags Breakdown</p>
                <p className="text-muted-foreground">Auto: {Number(overview.bags_auto_reserved).toLocaleString()} lbs</p>
                <p className="text-muted-foreground">Manual: {Number(overview.bags_manual_reserved).toLocaleString()} lbs</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override History */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Allocation Override Log
            <Badge variant="outline" className="ml-2 text-xs">{overrides.length}</Badge>
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {overrides.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No overrides recorded.</p>
            ) : (
              <div className="space-y-2">
                {overrides.slice(0, 20).map((o) => (
                  <div key={o.id} className="flex items-start gap-3 text-xs border-b pb-2 last:border-0">
                    <Badge variant="outline" className="text-xs mt-0.5">
                      {o.product_type === 'tubes' ? '🔧' : '👜'} {o.product_type}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-mono">
                        {Number(o.previous_reserved_lbs).toLocaleString()} → {Number(o.new_reserved_lbs).toLocaleString()} lbs
                      </p>
                      {o.reason && <p className="text-muted-foreground mt-0.5">{o.reason}</p>}
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(o.created_at), 'MMM d, yyyy, h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Override Dialog */}
      <Dialog open={!!overrideDialog} onOpenChange={() => setOverrideDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Override {overrideDialog === 'tubes' ? '🔧 Tubes' : '👜 Bags'} Manual Reservation
            </DialogTitle>
            <DialogDescription>
              Adjust the manual reservation. Auto-reservations will remain separate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Manual Reserved LBS</Label>
              <Input
                type="number"
                value={overrideLbs}
                onChange={(e) => setOverrideLbs(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Reason (required)</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why is this override needed..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialog(null)}>Cancel</Button>
            <Button
              onClick={handleOverride}
              disabled={!overrideReason.trim() || overrideAllocation.isPending}
            >
              {overrideAllocation.isPending ? 'Saving...' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
