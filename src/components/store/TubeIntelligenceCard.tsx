import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, RefreshCw, Check, X, HelpCircle, ShoppingCart, FlaskConical, Gift, Calendar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  useTubeIntelligence, 
  TUBE_BRANDS, 
  TubeIntelStatus,
  TubeIntelRole,
  canEditField 
} from '@/hooks/useTubeIntelligence';
import { cn } from '@/lib/utils';

interface TubeIntelligenceCardProps {
  storeId: string;
  role?: TubeIntelRole;
  compact?: boolean;
}

export function TubeIntelligenceCard({ 
  storeId, 
  role = 'admin',
  compact = false 
}: TubeIntelligenceCardProps) {
  const { data, isLoading, refetch, initializeBrands, updateField } = useTubeIntelligence(storeId);

  // Initialize brands if needed
  useEffect(() => {
    if (storeId && data.length === 0 && !isLoading) {
      initializeBrands.mutate(storeId);
    }
  }, [storeId, data.length, isLoading]);

  const handleToggle = (
    record: TubeIntelStatus | undefined, 
    brandId: string,
    field: keyof Pick<TubeIntelStatus, 'product_introduced' | 'owner_interested' | 'needs_order' | 'bring_samples' | 'bring_starter_kit' | 'starter_kit_delivered'>,
    currentValue: boolean | null
  ) => {
    if (!canEditField(role, field)) return;

    // For boolean fields, toggle. For nullable (owner_interested), cycle null -> true -> false -> null
    let newValue: boolean | null;
    if (field === 'owner_interested') {
      if (currentValue === null) newValue = true;
      else if (currentValue === true) newValue = false;
      else newValue = null;
    } else {
      newValue = !currentValue;
    }

    updateField.mutate({
      id: record?.id,
      store_id: storeId,
      brand_id: brandId,
      field,
      value: newValue,
    });
  };

  const getBrandData = (brandId: string) => {
    return data.find(d => d.brand_id === brandId);
  };

  const getBrandConfig = (brandId: string) => {
    return TUBE_BRANDS.find(b => b.id === brandId);
  };

  // Determine which action button to show based on has_ever_ordered
  const getActionButton = (record: TubeIntelStatus | undefined, brandId: string) => {
    const hasEverOrdered = record?.has_ever_ordered ?? false;
    const starterKitDelivered = record?.starter_kit_delivered ?? false;

    if (!hasEverOrdered && !starterKitDelivered) {
      // Show Starter Kit button
      const isActive = record?.bring_starter_kit ?? false;
      const canEdit = canEditField(role, 'bring_starter_kit');
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 text-xs gap-1',
                  isActive && 'bg-amber-500 hover:bg-amber-600 text-white',
                  !canEdit && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => handleToggle(record, brandId, 'bring_starter_kit', isActive)}
                disabled={!canEdit || updateField.isPending}
              >
                <Gift className="h-3 w-3" />
                Starter Kit
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bring starter kit on next visit</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      // Show Needs Order button
      const isActive = record?.needs_order ?? false;
      const canEdit = canEditField(role, 'needs_order');
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 text-xs gap-1',
                  isActive && 'bg-red-500 hover:bg-red-600 text-white',
                  !canEdit && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => handleToggle(record, brandId, 'needs_order', isActive)}
                disabled={!canEdit || updateField.isPending}
              >
                <ShoppingCart className="h-3 w-3" />
                Need Order
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Flag for reorder</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" />
          Tube Intelligence
          <Badge variant="outline" className="ml-2 text-xs">Operational</Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {TUBE_BRANDS.map((brand) => {
          const record = getBrandData(brand.id);
          const introduced = record?.product_introduced ?? false;
          const interested = record?.owner_interested;
          const bringSamples = record?.bring_samples ?? false;
          const lastOrderDate = record?.last_order_date;

          return (
            <div
              key={brand.id}
              className={cn(
                'p-3 rounded-lg border transition-colors',
                (record?.needs_order || record?.bring_starter_kit) 
                  ? 'bg-orange-500/10 border-orange-500/30' 
                  : 'bg-secondary/30 border-transparent'
              )}
            >
              {/* Brand Header Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  <span className="font-medium" style={{ color: brand.color }}>
                    {brand.name}
                  </span>
                </div>
                {lastOrderDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Last: {format(new Date(lastOrderDate), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>

              {/* Status Toggles Row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Introduced Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={introduced ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1',
                          introduced && 'bg-green-500 hover:bg-green-600 text-white',
                          !canEditField(role, 'product_introduced') && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => handleToggle(record, brand.id, 'product_introduced', introduced)}
                        disabled={!canEditField(role, 'product_introduced') || updateField.isPending}
                      >
                        {introduced ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        Introduced
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Product introduced to store owner</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Interested Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={interested !== null ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1',
                          interested === true && 'bg-blue-500 hover:bg-blue-600 text-white',
                          interested === false && 'bg-gray-500 hover:bg-gray-600 text-white',
                          interested === null && 'border-dashed',
                          !canEditField(role, 'owner_interested') && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => handleToggle(record, brand.id, 'owner_interested', interested)}
                        disabled={!canEditField(role, 'owner_interested') || updateField.isPending}
                      >
                        {interested === true && <Check className="h-3 w-3" />}
                        {interested === false && <X className="h-3 w-3" />}
                        {interested === null && <HelpCircle className="h-3 w-3" />}
                        {interested === null ? 'Not Asked' : interested ? 'Interested' : 'Not Interested'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Owner interest level (click to cycle)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="flex-1" />

                {/* Bring Samples Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={bringSamples ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1',
                          bringSamples && 'bg-purple-500 hover:bg-purple-600 text-white',
                          !canEditField(role, 'bring_samples') && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => handleToggle(record, brand.id, 'bring_samples', bringSamples)}
                        disabled={!canEditField(role, 'bring_samples') || updateField.isPending}
                      >
                        <FlaskConical className="h-3 w-3" />
                        Samples
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Bring samples on next visit</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Action Button (Starter Kit or Needs Order) */}
                {getActionButton(record, brand.id)}
              </div>

              {/* Last Updated */}
              {record?.last_updated_at && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(record.last_updated_at), { addSuffix: true })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
