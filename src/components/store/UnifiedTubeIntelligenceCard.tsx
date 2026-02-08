import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSimulationSafeMutation } from '@/hooks/useSimulationSafeMutation';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useTubeIntelligence, canEditField, TubeIntelRole } from '@/hooks/useTubeIntelligence';
import {
  Package, Save, RefreshCw, Clock, Calendar, ShoppingCart, FlaskConical,
  Gift, ThumbsUp, ThumbsDown, AlertTriangle, User, MapPin, Phone, MessageSquare, Monitor
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TUBE_BRAND_COLORS } from '@/constants/tubeColors';
import { CardHelper } from '@/components/portal/guidance';
import { useTranslation } from '@/hooks/useTranslation';
import type { UpdateMethod } from '@/services/fieldGovernance/types';

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED TUBE INTELLIGENCE CARD
// THE ONE AND ONLY tube component per store - combines:
//   - Editable tube counts (WRITE)
//   - Last order date per brand (READ - from v_store_tube_kpi)
//   - Color flow logic (🟢 🟡 🔴)
//   - Operational signals: Needs Order / Bring Samples / Bring Starter Kit
//   - Interest state: Interested / Not Interested (mutually exclusive)
//   - Attribution: Last Updated timestamp + Updated By role
//   - Role-based write access via governance pipeline
// ═══════════════════════════════════════════════════════════════════════════════

// AUTHORITATIVE TUBE BRANDS — names derived from canonical registry + tube variants
export const VALID_TUBE_BRANDS = [
  { id: 'gasmask', name: 'GasMask Bags', color: TUBE_BRAND_COLORS.gasmask.hex },
  { id: 'gasmasktubes', name: 'GasMask Tubes', color: TUBE_BRAND_COLORS.gasmasktubes.hex },
  { id: 'hotmama', name: TUBE_BRAND_COLORS.hotmama.name, color: TUBE_BRAND_COLORS.hotmama.hex },
  { id: 'grabba', name: TUBE_BRAND_COLORS.grabba.name, color: TUBE_BRAND_COLORS.grabba.hex },
  { id: 'hotscolatti-light', name: 'Hot Scolatti Light', color: TUBE_BRAND_COLORS['hotscolatti-light'].hex },
  { id: 'hotscolatti-dark', name: 'Hot Scolatti Dark', color: TUBE_BRAND_COLORS['hotscolatti-dark'].hex },
] as const;

interface TubeInventoryRecord {
  id: string;
  brand: string;
  current_tubes_left: number;
  last_updated: string;
  created_by: string;
}

interface TubeKPIData {
  brand_id: string;
  brand_name: string;
  tube_count: number;
  last_order_date: string | null;
  last_order_label: string;
  color_status: 'green' | 'yellow' | 'red' | 'muted';
  needs_order: boolean;
  bring_samples: boolean;
  bring_starter_kit: boolean;
  owner_interested: boolean | null;
  inventory_updated_at: string | null;
}

interface UnifiedTubeIntelligenceCardProps {
  storeId: string;
  role?: 'admin' | 'ambassador' | 'driver' | 'biker';
}

// ── Update Method helpers ──
const UPDATE_METHOD_CONFIG: Record<string, { label: string; icon: typeof MapPin; className: string }> = {
  in_person: { label: 'In-Person', icon: MapPin, className: 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400' },
  call: { label: 'Phone Call', icon: Phone, className: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400' },
  text: { label: 'Text / SMS', icon: MessageSquare, className: 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400' },
  system: { label: 'System', icon: Monitor, className: 'bg-muted text-muted-foreground border-border' },
};

function detectDefaultMethod(role: string): UpdateMethod {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  // Visit flows are always in-person
  if (path.includes('/visit') || path.includes('/check-in')) return 'in_person';
  // Admin/VA/system overrides
  if (role === 'admin' || role === 'va' || role === 'owner' || role === 'ceo') return 'system';
  // Default for field roles
  return 'in_person';
}

export function UnifiedTubeIntelligenceCard({ storeId, role = 'admin' }: UnifiedTubeIntelligenceCardProps) {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();
  const { t } = useTranslation();
  const [editedCounts, setEditedCounts] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<UpdateMethod>(() => detectDefaultMethod(role));

  const canEditCounts = role === 'admin' || role === 'ambassador' || role === 'biker';
  const tubeIntelRole: TubeIntelRole = role as TubeIntelRole;

  // ── Fetch intelligence status from store_tube_inventory_status ──
  const {
    data: intelData,
    isLoading: intelLoading,
    refetch: refetchIntel,
    initializeBrands,
    updateField,
  } = useTubeIntelligence(storeId);

  // Auto-initialize brands if missing
  useEffect(() => {
    if (!intelLoading && intelData && intelData.length < VALID_TUBE_BRANDS.length && storeId) {
      initializeBrands.mutate(storeId);
    }
  }, [intelData, intelLoading, storeId]);

  // ── Fetch KPI view data (last order dates, color status) ──
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKPI } = useQuery({
    queryKey: ['store-tube-kpi', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_store_tube_kpi')
        .select('*')
        .eq('store_id', storeId)
        .order('brand_name');
      if (error) {
        console.error('Failed to fetch tube KPI:', error);
        return [];
      }
      return (data || []) as TubeKPIData[];
    },
    enabled: !!storeId,
  });

  // ── Fetch editable inventory records (tube counts) ──
  const { data: inventory, isLoading: invLoading, refetch: refetchInv } = useQuery({
    queryKey: ['store-tube-inventory', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory')
        .select('*')
        .eq('store_id', storeId)
        .neq('brand', 'hotscolatti')
        .order('brand');
      if (error) throw error;
      return data as TubeInventoryRecord[];
    },
    enabled: !!storeId,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`unified-tube-intel-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_tube_inventory', filter: `store_id=eq.${storeId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
          queryClient.invalidateQueries({ queryKey: ['store-tube-kpi', storeId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_tube_inventory_status', filter: `store_id=eq.${storeId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [storeId, queryClient]);

  // Initialize edited counts
  useEffect(() => {
    if (inventory) {
      const counts: Record<string, number> = {};
      inventory.forEach(item => { counts[item.brand] = item.current_tubes_left; });
      VALID_TUBE_BRANDS.forEach(brand => {
        if (!(brand.id in counts)) counts[brand.id] = 0;
      });
      setEditedCounts(counts);
      setHasChanges(false);
    }
  }, [inventory]);

  const saveMutation = useSimulationSafeMutation({
    mutationFn: async (updates: { brand: string; count: number }[], isSimulation: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      for (const update of updates) {
        const { data: existing } = await supabase
          .from('store_tube_inventory')
          .select('id')
          .eq('store_id', storeId)
          .eq('brand', update.brand)
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          await supabase.from('store_tube_inventory').update({
            current_tubes_left: update.count,
            last_updated: new Date().toISOString(),
            created_by: user?.id || 'system',
            is_simulation: isSimulation,
          }).eq('id', existing.id);
        } else if (update.count > 0) {
          await supabase.from('store_tube_inventory').insert({
            store_id: storeId,
            brand: update.brand,
            current_tubes_left: update.count,
            created_by: user?.id || 'system',
            is_simulation: isSimulation,
          });
        }
      }
      return updates;
    },
    simulationMessage: 'Saving inventory to simulation database...',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-tube-kpi', storeId] });
      toast.success(simulationMode ? 'Inventory updated (simulation)' : 'Tube inventory saved');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleCountChange = (brand: string, value: string) => {
    if (!canEditCounts) return;
    const numValue = parseInt(value) || 0;
    setEditedCounts(prev => ({ ...prev, [brand]: numValue }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates = Object.entries(editedCounts).map(([brand, count]) => ({ brand, count }));
    saveMutation.mutate(updates);
  };

  const handleRefresh = () => {
    refetchKPI();
    refetchInv();
    refetchIntel();
  };

  // ── Signal toggle handler ──
  const handleSignalToggle = (
    brandId: string,
    field: 'needs_order' | 'bring_samples' | 'bring_starter_kit',
    currentValue: boolean
  ) => {
    const intelRecord = intelData.find(r => r.brand_id === brandId);
    updateField.mutate({
      id: intelRecord?.id,
      store_id: storeId,
      brand_id: brandId,
      field,
      value: !currentValue,
      role: tubeIntelRole,
      update_method: selectedMethod,
    });
  };

  // ── Interest toggle handler (mutually exclusive) ──
  const handleInterestToggle = (brandId: string, interested: boolean) => {
    const intelRecord = intelData.find(r => r.brand_id === brandId);
    const currentValue = intelRecord?.owner_interested;
    // Toggle off if already set to same value
    const newValue = currentValue === interested ? null : interested;
    updateField.mutate({
      id: intelRecord?.id,
      store_id: storeId,
      brand_id: brandId,
      field: 'owner_interested',
      value: newValue,
      role: tubeIntelRole,
      update_method: selectedMethod,
    });
  };

  const getKPIForBrand = (brandId: string): TubeKPIData | undefined => {
    return kpiData?.find(k => k.brand_id === brandId);
  };

  const getIntelForBrand = (brandId: string) => {
    return intelData.find(r => r.brand_id === brandId);
  };

  const getColorClasses = (status: 'green' | 'yellow' | 'red' | 'muted' | undefined) => {
    switch (status) {
      case 'green': return { bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-500' };
      case 'yellow': return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-500' };
      case 'red': return { bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
      default: return { bg: 'bg-secondary/30', border: 'border-transparent', dot: 'bg-muted-foreground' };
    }
  };

  const isLoading = kpiLoading || invLoading || intelLoading;
  const totalTubes = Object.values(editedCounts).reduce((sum, count) => sum + count, 0);

  const getLastUpdated = () => {
    if (!inventory?.length) return null;
    const sorted = [...inventory].sort(
      (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
    );
    return sorted[0]?.last_updated;
  };

  const lastUpdated = getLastUpdated();

  // ══════════════════════════════════════════════
  // RENDER GUARD — If no brand intelligence rows → show system warning
  // ══════════════════════════════════════════════
  const hasBrandIntelligence = intelData.length > 0;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            {t('card.tube_intel.title')}
            <Badge variant="outline" className="ml-2 text-xs">
              {canEditCounts ? t('card.tube_intel.editable') : t('card.tube_intel.readonly')}
            </Badge>
          </CardTitle>
          <CardHelper
            summary={t('card.tube_intel.helper_purpose')}
            details={t('card.tube_intel.helper_detail')}
            dataSource={t('card.tube_intel.helper_data_source')}
            variant="tooltip"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {hasChanges && canEditCounts && (
            <Button onClick={handleSave} size="sm" className="gap-1" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? t('card.tube_intel.saving') : t('card.tube_intel.save')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {simulationMode && (
          <Alert variant="default" className="border-primary/50 bg-primary/10">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary text-sm">
              {t('card.tube_intel.simulation_mode')}
            </AlertDescription>
          </Alert>
        )}

        {/* Update Method Selector — visible when user can edit signals */}
        {(canEditCounts || canEditField(tubeIntelRole, 'needs_order')) && role !== 'driver' && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/50">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Update via:</span>
            <Select value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as UpdateMethod)}>
              <SelectTrigger className="h-7 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(UPDATE_METHOD_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <SelectItem key={key} value={key} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* RENDER GUARD: Explicit system warning if brand intelligence is missing */}
            {!hasBrandIntelligence && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Tube Intelligence missing — this is a system issue. Brand data is being initialized...
                </AlertDescription>
              </Alert>
            )}

            {/* Total summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="font-medium">{t('card.tube_intel.total_tubes')}</span>
              <span className="text-2xl font-bold text-primary font-mono">{totalTubes.toLocaleString()}</span>
            </div>

            {/* Brand breakdown - ALL IN ONE */}
            <div className="space-y-3">
              {VALID_TUBE_BRANDS.map((brand) => {
                const kpi = getKPIForBrand(brand.id);
                const intel = getIntelForBrand(brand.id);
                const count = editedCounts[brand.id] ?? 0;
                const colorClasses = getColorClasses(kpi?.color_status);
                const originalItem = inventory?.find(i => i.brand === brand.id);
                const hasChange = originalItem ? count !== originalItem.current_tubes_left : count > 0;

                // Signal states from intelligence record
                const needsOrder = intel?.needs_order ?? false;
                const bringSamples = intel?.bring_samples ?? false;
                const bringStarterKit = intel?.bring_starter_kit ?? false;
                const ownerInterested = intel?.owner_interested;

                // Permission checks
                const canToggleSignals = canEditField(tubeIntelRole, 'needs_order');
                const canToggleInterest = canEditField(tubeIntelRole, 'owner_interested');

                return (
                  <div
                    key={brand.id}
                    className={cn(
                      'p-3 rounded-lg border transition-colors',
                      colorClasses.bg,
                      colorClasses.border
                    )}
                  >
                    {/* ── Brand Header Row ── */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: brand.color }}
                        />
                        <span className="font-medium" style={{ color: brand.color }}>
                          {brand.name}
                        </span>
                        {hasChange && (
                          <Badge variant="secondary" className="text-xs">{t('card.tube_intel.modified')}</Badge>
                        )}
                      </div>
                      {/* Tube count input */}
                      <div className="flex items-center gap-2">
                        {canEditCounts ? (
                          <>
                            <Input
                              type="number"
                              min={0}
                              value={count}
                              onChange={(e) => handleCountChange(brand.id, e.target.value)}
                              className="w-20 h-8 text-right bg-background text-sm"
                            />
                            <span className="text-xs text-muted-foreground">{t('card.tube_intel.tubes')}</span>
                          </>
                        ) : (
                          <Badge
                            variant={count === 0 ? 'destructive' : count < 20 ? 'secondary' : 'default'}
                            className="font-mono"
                          >
                            {count} {t('card.tube_intel.tubes')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* ── Last Order Info ── */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {t('card.tube_intel.last_order')}:{' '}
                        <span className={cn(
                          kpi?.last_order_date ? 'text-foreground' : 'text-warning font-medium'
                        )}>
                          {kpi?.last_order_label || t('card.tube_intel.never_ordered')}
                        </span>
                      </span>
                    </div>

                    {/* ═══════════════════════════════════════════════════ */}
                    {/* PER-BRAND OPERATIONAL SIGNALS (RESTORED)          */}
                    {/* ═══════════════════════════════════════════════════ */}
                    <div className="space-y-2 border-t border-border/30 pt-2">
                      {/* Signal Toggles Row */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Needs Order */}
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`needs-order-${brand.id}`}
                            checked={needsOrder}
                            onCheckedChange={() => handleSignalToggle(brand.id, 'needs_order', needsOrder)}
                            disabled={!canToggleSignals || updateField.isPending}
                            className="scale-90"
                          />
                          <Label
                            htmlFor={`needs-order-${brand.id}`}
                            className={cn(
                              'text-xs cursor-pointer',
                              needsOrder ? 'text-destructive font-medium' : 'text-muted-foreground'
                            )}
                          >
                            <ShoppingCart className="h-3 w-3 inline mr-1" />
                            Needs Order
                          </Label>
                        </div>

                        {/* Bring Starter Kit */}
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`starter-kit-${brand.id}`}
                            checked={bringStarterKit}
                            onCheckedChange={() => handleSignalToggle(brand.id, 'bring_starter_kit', bringStarterKit)}
                            disabled={!canToggleSignals || updateField.isPending}
                            className="scale-90"
                          />
                          <Label
                            htmlFor={`starter-kit-${brand.id}`}
                            className={cn(
                              'text-xs cursor-pointer',
                              bringStarterKit ? 'text-warning font-medium' : 'text-muted-foreground'
                            )}
                          >
                            <Gift className="h-3 w-3 inline mr-1" />
                            Bring Starter Kit
                          </Label>
                        </div>

                        {/* Bring Samples */}
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`samples-${brand.id}`}
                            checked={bringSamples}
                            onCheckedChange={() => handleSignalToggle(brand.id, 'bring_samples', bringSamples)}
                            disabled={!canToggleSignals || updateField.isPending}
                            className="scale-90"
                          />
                          <Label
                            htmlFor={`samples-${brand.id}`}
                            className={cn(
                              'text-xs cursor-pointer',
                              bringSamples ? 'text-primary font-medium' : 'text-muted-foreground'
                            )}
                          >
                            <FlaskConical className="h-3 w-3 inline mr-1" />
                            Bring Samples
                          </Label>
                        </div>
                      </div>

                      {/* Interest State (Mutually Exclusive Buttons) */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-1">Interest:</span>
                        <Button
                          variant={ownerInterested === true ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            'h-6 px-2 text-xs gap-1',
                            ownerInterested === true && 'bg-success hover:bg-success/90 text-success-foreground'
                          )}
                          onClick={() => handleInterestToggle(brand.id, true)}
                          disabled={!canToggleInterest || updateField.isPending}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          Interested
                        </Button>
                        <Button
                          variant={ownerInterested === false ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            'h-6 px-2 text-xs gap-1',
                            ownerInterested === false && 'bg-destructive hover:bg-destructive/90 text-white'
                          )}
                          onClick={() => handleInterestToggle(brand.id, false)}
                          disabled={!canToggleInterest || updateField.isPending}
                        >
                          <ThumbsDown className="h-3 w-3" />
                          Not Interested
                        </Button>
                        {ownerInterested === null && (
                          <span className="text-xs text-muted-foreground italic">Not asked</span>
                        )}
                      </div>

                      {/* Attribution: Date + Relative Time + Method Badge + Role */}
                      {intel && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground pt-1.5 border-t border-border/20 mt-1">
                          {/* Date + relative time */}
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {intel.last_updated_at
                              ? <>
                                  {format(new Date(intel.last_updated_at), 'MM/dd/yyyy')}
                                  <span className="opacity-70">
                                    ({formatDistanceToNow(new Date(intel.last_updated_at), { addSuffix: false })} ago)
                                  </span>
                                </>
                              : <span className="italic">Unknown · Legacy data</span>
                            }
                          </span>
                          {/* Method badge */}
                          {(() => {
                            const method = intel.last_updated_method;
                            const cfg = method ? UPDATE_METHOD_CONFIG[method] : null;
                            if (cfg) {
                              const MethodIcon = cfg.icon;
                              return (
                                <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 gap-0.5 border', cfg.className)}>
                                  <MethodIcon className="h-2.5 w-2.5" />
                                  {cfg.label}
                                </Badge>
                              );
                            }
                            if (!method && intel.last_updated_at) {
                              return (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground border-border">
                                  Legacy
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                          {/* Role badge */}
                          {intel.last_updated_by_role && (
                            <span className="flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />
                              <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">
                                {intel.last_updated_by_role}
                              </Badge>
                            </span>
                          )}
                          {/* Render guard for missing attribution */}
                          {intel.last_updated_at && !intel.last_updated_method && !intel.last_updated_by_role && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Attribution missing
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Color legend */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground border-t border-border/50">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span>{t('card.tube_intel.legend_stocked_ordered')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span>{t('card.tube_intel.legend_stocked_never')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span>{t('card.tube_intel.legend_out_of_stock')}</span>
              </div>
            </div>

            {/* Driver read-only notice */}
            {role === 'driver' && (
              <Alert variant="default" className="border-border/50">
                <AlertDescription className="text-xs text-muted-foreground">
                  👁️ Read-only view — tube signals are managed by Ambassadors and Bikers
                </AlertDescription>
              </Alert>
            )}

            {/* Last updated (inventory counts) */}
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <Clock className="h-3 w-3" />
                <span>
                  Inventory updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
