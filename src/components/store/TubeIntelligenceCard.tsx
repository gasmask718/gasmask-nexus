import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, RefreshCw, Check, X, HelpCircle, ShoppingCart, FlaskConical, Gift, Calendar, ThumbsUp, ThumbsDown, Ban } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { dynastyDate } from '@/lib/dates';
import { 
  useTubeIntelligence, 
  TUBE_BRANDS, 
  TubeIntelStatus,
  TubeIntelRole,
  canEditField 
} from '@/hooks/useTubeIntelligence';
import { cn } from '@/lib/utils';
import { usePromoSampleProductIds, isPromoSampleBrandKey } from '@/lib/inventory/promoSample';

interface TubeIntelligenceCardProps {
  storeId: string;
  role?: TubeIntelRole;
  compact?: boolean;
}

// Interest status type (replaces separate introduced + interested fields)
type InterestStatus = 'interested' | 'not_interested' | 'not_asked';

export function TubeIntelligenceCard({ 
  storeId, 
  role = 'admin',
  compact = false 
}: TubeIntelligenceCardProps) {
  const { data, isLoading, refetch, initializeBrands, updateField } = useTubeIntelligence(storeId);
  const { data: promoSampleIds } = usePromoSampleProductIds();

  // Initialize brands if needed
  useEffect(() => {
    if (storeId && data.length === 0 && !isLoading) {
      initializeBrands.mutate(storeId);
    }
  }, [storeId, data.length, isLoading]);

  // Derive interest status from legacy fields (backward compatible)
  const getInterestStatus = (record: TubeIntelStatus | undefined): InterestStatus => {
    if (!record) return 'not_asked';
    
    // If owner_interested is explicitly set, use that
    if (record.owner_interested === true) return 'interested';
    if (record.owner_interested === false) return 'not_interested';
    
    // If product was introduced but no interest recorded, still show as not_asked
    // (This simplifies the old two-step flow)
    return 'not_asked';
  };

  // Update interest status (maps to owner_interested field for backward compatibility)
  const handleInterestChange = (
    record: TubeIntelStatus | undefined,
    brandId: string,
    newStatus: InterestStatus
  ) => {
    if (!canEditField(role, 'owner_interested')) return;

    // Map new status to owner_interested field
    let ownerInterested: boolean | null;
    let productIntroduced: boolean;
    
    switch (newStatus) {
      case 'interested':
        ownerInterested = true;
        productIntroduced = true; // Implicitly introduced
        break;
      case 'not_interested':
        ownerInterested = false;
        productIntroduced = true; // Implicitly introduced
        break;
      case 'not_asked':
      default:
        ownerInterested = null;
        productIntroduced = false;
        break;
    }

    // Update both fields to maintain data consistency
    updateField.mutate({
      id: record?.id,
      store_id: storeId,
      brand_id: brandId,
      field: 'owner_interested',
      value: ownerInterested,
      role,
    });

    // Also update product_introduced for backward compatibility
    if (record?.id) {
      updateField.mutate({
        id: record.id,
        store_id: storeId,
        brand_id: brandId,
        field: 'product_introduced',
        value: productIntroduced,
        role,
      });
    }
  };

  const handleActionToggle = (
    record: TubeIntelStatus | undefined, 
    brandId: string,
    field: 'needs_order' | 'bring_samples' | 'bring_starter_kit',
    currentValue: boolean
  ) => {
    if (!canEditField(role, field)) return;

    updateField.mutate({
      id: record?.id,
      store_id: storeId,
      brand_id: brandId,
      field,
      value: !currentValue,
      role,
    });
  };

  const getBrandData = (brandId: string) => {
    return data.find(d => d.brand_id === brandId);
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
          const interestStatus = getInterestStatus(record);
          const needsOrder = record?.needs_order ?? false;
          const bringSamples = record?.bring_samples ?? false;
          const bringStarterKit = record?.bring_starter_kit ?? false;
          const lastOrderDate = record?.last_order_date;
          const canEditInterest = canEditField(role, 'owner_interested');

          return (
            <div
              key={brand.id}
              className={cn(
                'p-3 rounded-lg border transition-colors',
                (needsOrder || bringStarterKit || bringSamples)
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
                    <span>Last: {dynastyDate(lastOrderDate)}</span>
                  </div>
                )}
              </div>

              {/* Interest Status Selector (ONE CLICK) */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="flex items-center rounded-lg border overflow-hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 rounded-none border-r text-xs px-3 gap-1',
                      interestStatus === 'interested' && 'bg-green-500 text-white hover:bg-green-600 hover:text-white',
                      !canEditInterest && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => handleInterestChange(record, brand.id, 'interested')}
                    disabled={!canEditInterest || updateField.isPending}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Interested
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 rounded-none border-r text-xs px-3 gap-1',
                      interestStatus === 'not_interested' && 'bg-red-500 text-white hover:bg-red-600 hover:text-white',
                      !canEditInterest && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => handleInterestChange(record, brand.id, 'not_interested')}
                    disabled={!canEditInterest || updateField.isPending}
                  >
                    <ThumbsDown className="h-3 w-3" />
                    Not Interested
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 rounded-none text-xs px-3 gap-1',
                      interestStatus === 'not_asked' && 'bg-gray-500 text-white hover:bg-gray-600 hover:text-white',
                      !canEditInterest && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => handleInterestChange(record, brand.id, 'not_asked')}
                    disabled={!canEditInterest || updateField.isPending}
                  >
                    <HelpCircle className="h-3 w-3" />
                    Not Asked
                  </Button>
                </div>
              </div>

              {/* Action Buttons Row - ALL THREE ALWAYS VISIBLE */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Need Order - ALWAYS VISIBLE */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={needsOrder ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1',
                          needsOrder && 'bg-red-500 hover:bg-red-600 text-white',
                          !canEditField(role, 'needs_order') && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => handleActionToggle(record, brand.id, 'needs_order', needsOrder)}
                        disabled={!canEditField(role, 'needs_order') || updateField.isPending}
                      >
                        <ShoppingCart className="h-3 w-3" />
                        Need Order
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Flag for reorder - no prior order required</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Bring Samples — only the brand's one promo sample SKU */}
                {isPromoSampleBrandKey(brand.id, promoSampleIds) && (
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
                        onClick={() => handleActionToggle(record, brand.id, 'bring_samples', bringSamples)}
                        disabled={!canEditField(role, 'bring_samples') || updateField.isPending}
                      >
                        <FlaskConical className="h-3 w-3" />
                        Samples
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Bring the promo sample on next visit</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                )}


                {/* Starter Kit */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={bringStarterKit ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1',
                          bringStarterKit && 'bg-amber-500 hover:bg-amber-600 text-white',
                          !canEditField(role, 'bring_starter_kit') && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => handleActionToggle(record, brand.id, 'bring_starter_kit', bringStarterKit)}
                        disabled={!canEditField(role, 'bring_starter_kit') || updateField.isPending}
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
              </div>

              {/* Last Updated */}
              {record?.last_updated_at && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(record.last_updated_at), { addSuffix: true })}
                  {record.last_updated_by_role && (
                    <span className="ml-1 capitalize">by {record.last_updated_by_role}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
