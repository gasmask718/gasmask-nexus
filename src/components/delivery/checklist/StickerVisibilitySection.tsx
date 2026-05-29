import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sticker, ChevronDown, ChevronRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BRANDS = ['GasMask', 'Hot Mama', 'HotScalati', 'Grabba R Us'] as const;
const STICKER_TYPES = ['Front Door', 'Brand Character', 'Authorized Retailer', 'Telephone Number'] as const;
const PERSON_TYPES = ['drivers', 'bikers', 'ambassadors'] as const;

const BRAND_COLORS: Record<string, { bg: string; text: string; border: string; initials: string }> = {
  'GasMask':      { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/30', initials: 'GM' },
  'Hot Mama':     { bg: 'bg-pink-500/10',    text: 'text-pink-600',    border: 'border-pink-500/30',    initials: 'HM' },
  'Hotscolatti':   { bg: 'bg-orange-500/10',  text: 'text-orange-600',  border: 'border-orange-500/30',  initials: 'HS' },
  'Grabba R Us':  { bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'border-blue-500/30',    initials: 'GR' },
};

interface StickerRow {
  id: string;
  store_id: string;
  person_type: string;
  brand: string;
  sticker_type: string;
  installed: boolean;
  requested: boolean;
  mark_seen: boolean;
  seen_at: string | null;
  notes: string | null;
  brand_notes: string | null;
}

interface StickerVisibilitySectionProps {
  storeId: string;
}

export function StickerVisibilitySection({ storeId }: StickerVisibilitySectionProps) {
  const [activeTab, setActiveTab] = useState<string>('drivers');
  const queryClient = useQueryClient();

  const queryKey = ['checklist-sticker-visibility', storeId, activeTab];

  const { data: stickers = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      // Seed if needed
      const { count } = await (supabase as any)
        .from('checklist_sticker_visibility')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId);

      if (!count || count === 0) {
        const seedRows: any[] = [];
        for (const pt of PERSON_TYPES) {
          for (const brand of BRANDS) {
            for (const st of STICKER_TYPES) {
              seedRows.push({ store_id: storeId, person_type: pt, brand, sticker_type: st });
            }
          }
        }
        await (supabase as any).from('checklist_sticker_visibility').insert(seedRows);
      }

      const { data, error } = await (supabase as any)
        .from('checklist_sticker_visibility')
        .select('*')
        .eq('store_id', storeId)
        .eq('person_type', activeTab)
        .order('brand')
        .order('sticker_type');

      if (error) throw error;
      return (data || []) as StickerRow[];
    },
    enabled: !!storeId,
  });

  const updateField = useMutation({
    mutationFn: async (params: { id: string; field: string; value: any }) => {
      const updateData: any = { [params.field]: params.value, updated_at: new Date().toISOString() };
      if (params.field === 'mark_seen' && params.value === true) {
        updateData.seen_at = new Date().toISOString();
      }
      const { error } = await (supabase as any)
        .from('checklist_sticker_visibility')
        .update(updateData)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      toast.error('Failed to save: ' + err.message);
    },
  });

  const updateBrandNotes = useMutation({
    mutationFn: async (params: { brand: string; value: string }) => {
      const { error } = await (supabase as any)
        .from('checklist_sticker_visibility')
        .update({ brand_notes: params.value, updated_at: new Date().toISOString() })
        .eq('store_id', storeId)
        .eq('person_type', activeTab)
        .eq('brand', params.brand);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const grouped = useMemo(() => {
    const map: Record<string, StickerRow[]> = {};
    for (const brand of BRANDS) map[brand] = [];
    for (const s of stickers) {
      if (map[s.brand]) map[s.brand].push(s);
    }
    return map;
  }, [stickers]);

  const totalInstalled = useMemo(() => stickers.filter(s => s.installed).length, [stickers]);
  const compliancePct = Math.round((totalInstalled / 16) * 100);

  return (
    <Card>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Sticker className="h-5 w-5 text-violet-500" />
          <h3 className="font-semibold text-sm">Sticker & Visibility</h3>
          <Badge variant="secondary" className="text-xs ml-auto">
            {totalInstalled}/16
          </Badge>
        </div>

        {/* Person Type Tabs */}
        <div className="flex gap-1 mb-4 bg-muted/50 p-1 rounded-lg">
          {PERSON_TYPES.map(pt => (
            <button
              key={pt}
              onClick={() => setActiveTab(pt)}
              className={cn(
                'flex-1 text-xs font-medium py-1.5 px-3 rounded-md capitalize transition-colors',
                activeTab === pt
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {pt}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <SummaryCard label="Brands" value="4" />
          <SummaryCard label="Total Stickers" value="16" />
          <SummaryCard label="Installed" value={String(totalInstalled)} highlight={totalInstalled > 0} />
          <SummaryCard label="Compliance" value={`${compliancePct}%`} highlight={compliancePct === 100} />
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Loading sticker data...</div>
        ) : (
          BRANDS.map(brand => (
            <BrandAccordion
              key={brand}
              brand={brand}
              rows={grouped[brand] || []}
              onUpdate={(id, field, value) => updateField.mutate({ id, field, value })}
              onBrandNotesUpdate={(value) => updateBrandNotes.mutate({ brand, value })}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border p-2 text-center',
      highlight ? 'border-green-500/30 bg-green-500/5' : 'border-border'
    )}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function BrandAccordion({
  brand,
  rows,
  onUpdate,
  onBrandNotesUpdate,
}: {
  brand: string;
  rows: StickerRow[];
  onUpdate: (id: string, field: string, value: any) => void;
  onBrandNotesUpdate: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const colors = BRAND_COLORS[brand] || BRAND_COLORS['GasMask'];
  const installedCount = rows.filter(r => r.installed).length;
  const brandNotesValue = rows[0]?.brand_notes || '';
  const [localBrandNotes, setLocalBrandNotes] = useState(brandNotesValue);

  useEffect(() => {
    setLocalBrandNotes(rows[0]?.brand_notes || '');
  }, [rows]);

  // Sort rows in correct sticker type order
  const sortedRows = useMemo(() => {
    const order = STICKER_TYPES as readonly string[];
    return [...rows].sort((a, b) => order.indexOf(a.sticker_type) - order.indexOf(b.sticker_type));
  }, [rows]);

  return (
    <div className={cn('rounded-lg border', colors.border)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn('w-full flex items-center gap-3 p-3 text-left', colors.bg)}
      >
        <span className={cn('text-xs font-bold w-7 h-7 rounded-md flex items-center justify-center', colors.bg, colors.text)}>
          {colors.initials}
        </span>
        <span className="text-sm font-semibold flex-1">{brand}</span>
        <Badge variant={installedCount === 4 ? 'default' : 'secondary'} className={cn('text-xs', installedCount === 4 && 'bg-green-500')}>
          {installedCount}/4
        </Badge>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_60px_60px_80px_1fr] gap-2 text-[10px] text-muted-foreground uppercase tracking-wider px-1">
            <span>Type</span>
            <span className="text-center">Installed</span>
            <span className="text-center">Requested</span>
            <span className="text-center">Seen</span>
            <span>Notes</span>
          </div>

          {sortedRows.map(row => (
            <StickerTypeRow key={row.id} row={row} onUpdate={onUpdate} />
          ))}

          {/* General Brand Notes */}
          <div className="pt-2 border-t border-border mt-3">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              General Brand Notes
            </label>
            <Textarea
              value={localBrandNotes}
              onChange={(e) => setLocalBrandNotes(e.target.value)}
              onBlur={() => {
                if (localBrandNotes !== (rows[0]?.brand_notes || '')) {
                  onBrandNotesUpdate(localBrandNotes);
                }
              }}
              placeholder="Click to add notes..."
              className="text-xs min-h-[60px] resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StickerTypeRow({
  row,
  onUpdate,
}: {
  row: StickerRow;
  onUpdate: (id: string, field: string, value: any) => void;
}) {
  const [localNotes, setLocalNotes] = useState(row.notes || '');

  useEffect(() => {
    setLocalNotes(row.notes || '');
  }, [row.notes]);

  return (
    <div className={cn(
      'grid grid-cols-[1fr_60px_60px_80px_1fr] gap-2 items-center px-1 py-1.5 rounded-md',
      row.installed ? 'bg-green-500/5' : 'hover:bg-muted/30'
    )}>
      <span className={cn('text-xs font-medium', row.installed && 'text-green-600')}>
        {row.sticker_type}
      </span>

      <div className="flex justify-center">
        <Switch
          checked={row.installed}
          onCheckedChange={(v) => onUpdate(row.id, 'installed', v)}
          className="scale-75"
        />
      </div>

      <div className="flex justify-center">
        <Switch
          checked={row.requested}
          onCheckedChange={(v) => onUpdate(row.id, 'requested', v)}
          className="scale-75"
        />
      </div>

      <div className="flex justify-center">
        <Button
          size="sm"
          variant={row.mark_seen ? 'default' : 'outline'}
          className={cn('h-6 text-[10px] px-2', row.mark_seen && 'bg-green-500 hover:bg-green-600')}
          onClick={() => {
            if (!row.mark_seen) onUpdate(row.id, 'mark_seen', true);
          }}
          disabled={row.mark_seen}
        >
          {row.mark_seen ? (
            <><Eye className="h-3 w-3 mr-1" />Seen</>
          ) : (
            <><EyeOff className="h-3 w-3 mr-1" />Mark</>
          )}
        </Button>
      </div>

      <Input
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={() => {
          if (localNotes !== (row.notes || '')) {
            onUpdate(row.id, 'notes', localNotes);
          }
        }}
        placeholder="Add note..."
        className="h-6 text-xs"
      />
    </div>
  );
}
