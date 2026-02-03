import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Sticker, 
  RefreshCw, 
  DoorOpen, 
  User, 
  BadgeCheck, 
  Phone,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { 
  useBrandStickers, 
  STICKER_TYPES,
  STICKER_BRANDS,
  StickerTypeId,
  RequestedStickerTypeId,
  BrandStickerStatus,
  canEditStickers,
  getRequestedColumnForSticker,
} from '@/hooks/useBrandStickers';
import { TubeIntelRole } from '@/hooks/useTubeIntelligence';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BrandStickersCardProps {
  storeId: string;
  role?: TubeIntelRole;
  compact?: boolean;
}

const STICKER_ICONS: Record<StickerTypeId, React.ReactNode> = {
  front_door_sticker: <DoorOpen className="h-4 w-4" />,
  brand_character_sticker: <User className="h-4 w-4" />,
  authorized_retailer_sticker: <BadgeCheck className="h-4 w-4" />,
  telephone_number_sticker: <Phone className="h-4 w-4" />,
};

export function BrandStickersCard({ 
  storeId, 
  role = 'admin',
  compact = false 
}: BrandStickersCardProps) {
  const { 
    data, 
    isLoading, 
    refetch, 
    initializeBrands, 
    updateSticker, 
    updateRequestedSticker,
    updateNotes,
    getCompletionStats,
    getRequestedStats,
  } = useBrandStickers(storeId);
  
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  
  const canEdit = canEditStickers(role);

  // Initialize brands if needed
  useEffect(() => {
    if (storeId && data.length === 0 && !isLoading) {
      initializeBrands.mutate(storeId);
    }
  }, [storeId, data.length, isLoading]);

  // Match brand data by name, not by ID (since STICKER_BRANDS uses slugs, not UUIDs)
  const getBrandData = (brandName: string) => {
    return data.find(d => d.brand_name === brandName);
  };

  const handleStickerToggle = (
    record: BrandStickerStatus | undefined,
    brandName: string,
    stickerType: StickerTypeId,
    currentValue: boolean | null
  ) => {
    if (!canEdit) return;

    updateSticker.mutate({
      id: record?.id,
      store_id: storeId,
      brand_name: brandName,
      sticker_type: stickerType,
      value: !currentValue,
    });
  };

  const handleRequestedToggle = (
    record: BrandStickerStatus | undefined,
    brandName: string,
    stickerType: StickerTypeId,
    currentValue: boolean | null
  ) => {
    if (!canEdit) return;

    const requestedType = getRequestedColumnForSticker(stickerType);
    updateRequestedSticker.mutate({
      id: record?.id,
      store_id: storeId,
      brand_name: brandName,
      requested_type: requestedType,
      value: !currentValue,
    });
  };

  const handleNotesEdit = (record: BrandStickerStatus) => {
    setEditingNotes(record.id);
    setNotesValue(record.notes || '');
  };

  const handleNotesSave = (id: string) => {
    updateNotes.mutate({ id, notes: notesValue });
    setEditingNotes(null);
    setNotesValue('');
  };

  const handleNotesCancel = () => {
    setEditingNotes(null);
    setNotesValue('');
  };

  // Calculate overall completion
  const overallStats = data.reduce(
    (acc, record) => {
      const stats = getCompletionStats(record);
      const reqStats = getRequestedStats(record);
      acc.installed += stats.installed;
      acc.total += stats.total;
      acc.requested += reqStats.requested;
      return acc;
    },
    { installed: 0, total: 0, requested: 0 }
  );
  const overallPercentage = overallStats.total > 0 
    ? Math.round((overallStats.installed / overallStats.total) * 100) 
    : 0;

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
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sticker className="h-5 w-5 text-primary" />
            Brand Stickers
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {overallStats.installed} / {overallStats.total} Installed
            </Badge>
            {overallStats.requested > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Package className="h-3 w-3" />
                {overallStats.requested} Requested
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={overallPercentage} className="w-20 h-2" />
          <span className="text-sm font-medium">{overallPercentage}%</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {STICKER_BRANDS.map((brand) => {
          const record = getBrandData(brand.name);
          const stats = record ? getCompletionStats(record) : { installed: 0, total: 4, percentage: 0 };
          const reqStats = record ? getRequestedStats(record) : { requested: 0, total: 4 };
          const isExpanded = expandedBrand === brand.slug;
          const isEditingThisNotes = editingNotes === record?.id;

          return (
            <Collapsible
              key={brand.slug}
              open={isExpanded}
              onOpenChange={() => setExpandedBrand(isExpanded ? null : brand.slug)}
            >
              <div
                className={cn(
                  'rounded-lg border transition-colors',
                  stats.percentage === 100
                    ? 'bg-green-500/10 border-green-500/30'
                    : stats.percentage > 0
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-secondary/30 border-transparent'
                )}
              >
                {/* Brand Header Row */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: brand.color }}
                      />
                      <span className="font-medium" style={{ color: brand.color }}>
                        {brand.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.installed} / {stats.total}
                      </Badge>
                      {reqStats.requested > 0 && (
                        <Badge variant="outline" className="text-xs gap-1 text-orange-600 border-orange-300">
                          <Package className="h-3 w-3" />
                          {reqStats.requested}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={stats.percentage} className="w-16 h-2" />
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Expanded Content */}
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                    {/* Sticker Toggles - 2 columns: Installed | Requested */}
                    <div className="space-y-2">
                      {/* Header Row */}
                      <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-xs font-medium text-muted-foreground px-2">
                        <span>Sticker Type</span>
                        <span className="text-center">Installed</span>
                        <span className="text-center">Requested</span>
                      </div>
                      
                      {STICKER_TYPES.map((stickerType) => {
                        const isInstalled = record?.[stickerType.id] ?? false;
                        const requestedColumn = getRequestedColumnForSticker(stickerType.id);
                        const isRequested = record?.[requestedColumn as keyof BrandStickerStatus] as boolean ?? false;
                        
                        return (
                          <div
                            key={stickerType.id}
                            className={cn(
                              'grid grid-cols-[1fr_80px_80px] gap-2 items-center p-2 rounded-md border',
                              isInstalled 
                                ? 'bg-green-500/10 border-green-500/30' 
                                : isRequested
                                ? 'bg-orange-500/10 border-orange-500/30'
                                : 'bg-muted/30 border-transparent'
                            )}
                          >
                            {/* Sticker Name with Icon */}
                            <div className="flex items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={cn(
                                      'p-1 rounded',
                                      isInstalled ? 'text-green-600' : 'text-muted-foreground'
                                    )}>
                                      {STICKER_ICONS[stickerType.id]}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{stickerType.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Label 
                                htmlFor={`${brand.slug}-${stickerType.id}`}
                                className="text-xs truncate"
                              >
                                {stickerType.name.replace(' Sticker', '')}
                              </Label>
                            </div>
                            
                            {/* Installed Toggle */}
                            <div className="flex justify-center">
                              <Switch
                                id={`${brand.slug}-${stickerType.id}`}
                                checked={isInstalled}
                                onCheckedChange={() => handleStickerToggle(
                                  record,
                                  brand.name,
                                  stickerType.id,
                                  isInstalled
                                )}
                                disabled={!canEdit || updateSticker.isPending}
                              />
                            </div>
                            {/* Requested Toggle */}
                            <div className="flex justify-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={isRequested ? "default" : "outline"}
                                      size="sm"
                                      className={cn(
                                        "h-7 px-2 text-xs gap-1",
                                        isRequested && "bg-orange-500 hover:bg-orange-600"
                                      )}
                                      onClick={() => handleRequestedToggle(
                                        record,
                                        brand.name,
                                        stickerType.id,
                                        isRequested
                                      )}
                                      disabled={!canEdit || updateRequestedSticker.isPending || isInstalled}
                                    >
                                      <Package className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{isInstalled ? 'Already installed' : isRequested ? 'Store requested this sticker' : 'Mark as requested'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Notes Section */}
                    {record && (
                      <div className="space-y-2">
                        {isEditingThisNotes ? (
                          <div className="space-y-2">
                            <Textarea
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              placeholder="Add notes about sticker placement..."
                              className="min-h-[60px] text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleNotesSave(record.id)}
                                disabled={updateNotes.isPending}
                              >
                                {updateNotes.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleNotesCancel}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="text-sm text-muted-foreground p-2 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50"
                            onClick={() => canEdit && handleNotesEdit(record)}
                          >
                            {record.notes || (canEdit ? 'Click to add notes...' : 'No notes')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Last Updated */}
                    {record?.last_verified_at && (
                      <div className="text-xs text-muted-foreground">
                        Last verified {formatDistanceToNow(new Date(record.last_verified_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
