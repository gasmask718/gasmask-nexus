import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  Eye,
  FileText,
  Clock,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { dynastyDate } from '@/lib/dates';
import { 
  useBrandStickers, 
  STICKER_TYPES,
  STICKER_BRANDS,
  StickerTypeId,
  RequestedStickerTypeId,
  BrandStickerStatus,
  canEditStickers,
  getRequestedColumnForSticker,
  getStickerDates,
  stickerHasNotes,
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
    markStickerSeen,
    updateStickerNotes,
    updateNotes,
    getCompletionStats,
    getRequestedStats,
    getNotesStats,
  } = useBrandStickers(storeId);
  
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  
  // Per-sticker notes dialog state
  const [stickerNotesDialog, setStickerNotesDialog] = useState<{
    open: boolean;
    recordId: string;
    stickerType: StickerTypeId;
    brandName: string;
  } | null>(null);
  const [stickerNotesValue, setStickerNotesValue] = useState('');
  
  const canEdit = canEditStickers(role);

  // Initialize brands if needed
  useEffect(() => {
    if (storeId && data.length === 0 && !isLoading) {
      initializeBrands.mutate(storeId);
    }
  }, [storeId, data.length, isLoading]);

  // Match brand data by name
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
      role,
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
      role,
    });
  };

  const handleMarkSeen = (record: BrandStickerStatus, stickerType: StickerTypeId) => {
    if (!canEdit || role === 'driver') return;
    
    markStickerSeen.mutate({
      id: record.id,
      sticker_type: stickerType,
      role,
    });
  };

  const handleOpenStickerNotes = (
    record: BrandStickerStatus,
    stickerType: StickerTypeId,
    brandName: string
  ) => {
    const dates = getStickerDates(record, stickerType);
    setStickerNotesValue(dates.notes || '');
    setStickerNotesDialog({
      open: true,
      recordId: record.id,
      stickerType,
      brandName,
    });
  };

  const handleSaveStickerNotes = () => {
    if (!stickerNotesDialog || !canEdit) return;
    
    updateStickerNotes.mutate({
      id: stickerNotesDialog.recordId,
      sticker_type: stickerNotesDialog.stickerType,
      notes: stickerNotesValue,
      role,
    });
    setStickerNotesDialog(null);
    setStickerNotesValue('');
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
      const notesCount = getNotesStats(record);
      acc.installed += stats.installed;
      acc.total += stats.total;
      acc.requested += reqStats.requested;
      acc.notes += notesCount;
      return acc;
    },
    { installed: 0, total: 0, requested: 0, notes: 0 }
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
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sticker className="h-5 w-5 text-primary" />
              Brand Stickers & Compliance
            </CardTitle>
            <Badge variant="outline" className="gap-1 text-xs">
              <ShieldCheck className="h-3 w-3" />
              4 Brands
            </Badge>
          </div>
          <div className="flex items-center gap-2">
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
              {overallStats.notes > 0 && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <FileText className="h-3 w-3" />
                  {overallStats.notes} Notes
                </Badge>
              )}
            </div>
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
            const notesCount = record ? getNotesStats(record) : 0;
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
                        {notesCount > 0 && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <FileText className="h-3 w-3" />
                            {notesCount}
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
                      {/* Sticker Grid */}
                      <div className="space-y-2">
                        {/* Header Row */}
                        <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-2 text-xs font-medium text-muted-foreground px-2">
                          <span>Sticker Type</span>
                          <span className="text-center">Installed</span>
                          <span className="text-center">Requested</span>
                          <span className="text-center">Notes</span>
                          <span className="text-center">Mark Seen</span>
                        </div>
                        
                        {STICKER_TYPES.map((stickerType) => {
                          const isInstalled = record?.[stickerType.id] ?? false;
                          const requestedColumn = getRequestedColumnForSticker(stickerType.id);
                          const isRequested = record?.[requestedColumn as keyof BrandStickerStatus] as boolean ?? false;
                          const hasNotes = record ? stickerHasNotes(record, stickerType.id) : false;
                          const dates = record ? getStickerDates(record, stickerType.id) : { putOnAt: null, lastSeenAt: null, notes: null };
                          
                          return (
                            <div key={stickerType.id} className="space-y-1">
                              <div
                                className={cn(
                                  'grid grid-cols-[1fr_70px_70px_70px_70px] gap-2 items-center p-2 rounded-md border',
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
                                            "h-7 w-7 p-0",
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

                                {/* Notes Button */}
                                <div className="flex justify-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={cn(
                                            "h-7 w-7 p-0",
                                            hasNotes && "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                          )}
                                          onClick={() => record && handleOpenStickerNotes(record, stickerType.id, brand.name)}
                                          disabled={!record}
                                        >
                                          <FileText className={cn("h-4 w-4", hasNotes && "drop-shadow-[0_0_4px_rgba(239,68,68,0.6)]")} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{hasNotes ? 'View/Edit Notes' : 'Add Notes'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>

                                {/* Mark Seen Button */}
                                <div className="flex justify-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => record && handleMarkSeen(record, stickerType.id)}
                                          disabled={!canEdit || role === 'driver' || !record || !isInstalled || markStickerSeen.isPending}
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          {role === 'driver' 
                                            ? 'Read-only for drivers' 
                                            : !isInstalled 
                                            ? 'Install sticker first' 
                                            : 'Mark as seen today'}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>

                              {/* Date tracking row - only show if installed or has dates */}
                              {(isInstalled || dates.putOnAt || dates.lastSeenAt) && (
                                <div className="flex items-center gap-3 px-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>Put on:</span>
                                  {dates.putOnAt ? (
                                    <Badge variant="outline" className="text-xs py-0">
                                      {dynastyDate(dates.putOnAt)}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                  <span className="mx-1">/</span>
                                  <span>Last seen:</span>
                                  {dates.lastSeenAt ? (
                                    <Badge variant="outline" className="text-xs py-0 bg-green-500/10 text-green-600 border-green-500/30">
                                      {formatDistanceToNow(new Date(dates.lastSeenAt), { addSuffix: true })}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs py-0 text-muted-foreground">Never</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* General Brand Notes Section */}
                      {record && (
                        <div className="space-y-2 pt-2 border-t border-border/30">
                          <Label className="text-xs text-muted-foreground">General Brand Notes</Label>
                          {isEditingThisNotes ? (
                            <div className="space-y-2">
                              <Textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                placeholder="Add general notes about this brand's stickers..."
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
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3" />
                          Last verified {formatDistanceToNow(new Date(record.last_verified_at), { addSuffix: true })}
                          {record.last_updated_by_role && (
                            <Badge variant="outline" className="text-xs py-0">
                              by {record.last_updated_by_role}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

          {/* Compliance Footer */}
          <div className="pt-2 border-t border-border/30">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" />
              Only approved brands and sticker types are available. Changes are auditable.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Per-Sticker Notes Dialog */}
      <Dialog 
        open={stickerNotesDialog?.open ?? false} 
        onOpenChange={(open) => !open && setStickerNotesDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {stickerNotesDialog && (
                <>
                  {STICKER_TYPES.find(t => t.id === stickerNotesDialog.stickerType)?.name} - {stickerNotesDialog.brandName}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={stickerNotesValue}
                onChange={(e) => setStickerNotesValue(e.target.value)}
                placeholder="Add notes about this sticker (placement, condition, issues...)"
                rows={4}
                className="resize-none"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Notes with content are flagged with a red indicator for quick visibility.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setStickerNotesDialog(null)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveStickerNotes} 
              disabled={!canEdit || updateStickerNotes.isPending}
            >
              {updateStickerNotes.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
