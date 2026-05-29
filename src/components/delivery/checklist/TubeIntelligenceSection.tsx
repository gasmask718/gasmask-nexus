import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Beaker } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRODUCTS = [
  'GasMask Bags',
  'GasMask Tubes',
  'HotMama',
  'Grabba R Us',
  'Hotscolatti Light',
  'Hotscolatti Dark',
  'Hotscolatti Bros',
];

type FilterMode = 'all' | 'active' | 'inactive';

interface TubeRow {
  id?: string;
  product_name: string;
  status: string;
  tube_count: number;
  last_order_date: string | null;
  last_order_qty: number | null;
  needs_order: boolean;
  bring_starter_kit: boolean;
  bring_samples: boolean;
  switch_tubes: boolean;
  interest: string | null;
}

interface TubeIntelligenceSectionProps {
  storeId: string;
  personType?: string;
}

export function TubeIntelligenceSection({ storeId, personType = 'drivers' }: TubeIntelligenceSectionProps) {
  const [rows, setRows] = useState<TubeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Seed + fetch
  useEffect(() => {
    async function init() {
      setLoading(true);
      // Seed if needed
      const seedRows = PRODUCTS.map(p => ({
        store_id: storeId,
        person_type: personType,
        product_name: p,
        status: 'inactive',
        visit_date: today,
      }));
      await (supabase as any)
        .from('checklist_tube_intelligence')
        .upsert(seedRows, { onConflict: 'store_id,person_type,product_name,visit_date' });

      // Fetch
      const { data } = await (supabase as any)
        .from('checklist_tube_intelligence')
        .select('*')
        .eq('store_id', storeId)
        .eq('person_type', personType)
        .eq('visit_date', today);

      if (data) {
        setRows(data.map((r: any) => ({
          id: r.id,
          product_name: r.product_name,
          status: r.status || 'inactive',
          tube_count: r.tube_count || 0,
          last_order_date: r.last_order_date,
          last_order_qty: r.last_order_qty,
          needs_order: r.needs_order || false,
          bring_starter_kit: r.bring_starter_kit || false,
          bring_samples: r.bring_samples || false,
          switch_tubes: r.switch_tubes || false,
          interest: r.interest,
        })));
      }
      setLoading(false);
    }
    init();
  }, [storeId, personType, today]);

  const saveField = useCallback(async (productName: string, updates: Partial<TubeRow>) => {
    const { error } = await (supabase as any)
      .from('checklist_tube_intelligence')
      .upsert({
        store_id: storeId,
        person_type: personType,
        product_name: productName,
        visit_date: today,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,person_type,product_name,visit_date' });
    if (error) toast.error(error.message);
  }, [storeId, personType, today]);

  const updateRow = useCallback((productName: string, updates: Partial<TubeRow>, save = true) => {
    setRows(prev => prev.map(r =>
      r.product_name === productName ? { ...r, ...updates } : r
    ));
    if (save) saveField(productName, updates);
  }, [saveField]);

  const totalTubes = rows.reduce((s, r) => s + (r.tube_count || 0), 0);

  const filtered = filter === 'all' ? rows
    : rows.filter(r => filter === 'active' ? r.status === 'active' : r.status === 'inactive');

  const formatLastOrder = (row: TubeRow) => {
    if (!row.last_order_date) return 'Last Order: Never ordered';
    const d = new Date(row.last_order_date);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Last Order: ${monthDay} · ${row.last_order_qty || 0} Tubes · ${days}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Tube Intelligence</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Editable · Update via: System</p>
        </div>

        {/* Warning if no data */}
        {rows.length === 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs">⚠️ Tube Intelligence missing — this is a system issue. Brand data is being initialized...</span>
          </div>
        )}

        {/* Filter tabs + Total */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {(['all', 'active', 'inactive'] as FilterMode[]).map(f => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                className="h-7 text-xs capitalize"
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All Brands' : f === 'active' ? 'Active Only' : 'Inactive Only'}
              </Button>
            ))}
          </div>
          <Badge variant="outline" className="text-xs font-medium">
            Total Tubes {totalTubes}
          </Badge>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Stocked + ordered</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Stocked, never ordered</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Out of stock</span>
        </div>

        {/* Product Cards */}
        <div className="space-y-3">
          {filtered.map(row => {
            const isNew = row.product_name === 'Hotscolatti Bros';
            const isActive = row.status === 'active';
            // Legend dot
            const dotColor = row.tube_count > 0 && row.last_order_date
              ? 'bg-green-500'
              : row.tube_count > 0
              ? 'bg-amber-500'
              : 'bg-red-500';

            return (
              <div
                key={row.product_name}
                className={cn(
                  'rounded-lg border p-3 space-y-3',
                  isNew ? 'border-blue-500/50 bg-blue-500/5' : 'border-border'
                )}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
                    <span className="text-sm font-semibold">{row.product_name}</span>
                    {isNew && <Badge className="bg-blue-500 text-[9px] px-1.5 py-0">New</Badge>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-6 text-[10px] px-2',
                      isActive
                        ? 'bg-green-500/10 border-green-500/30 text-green-600'
                        : 'bg-muted text-muted-foreground'
                    )}
                    onClick={() => {
                      const newStatus = isActive ? 'inactive' : 'active';
                      updateRow(row.product_name, { status: newStatus });
                    }}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Button>
                </div>

                {/* Two Column Body */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Left — Tube Count */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase">Tubes</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.tube_count || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        updateRow(row.product_name, { tube_count: val }, false);
                      }}
                      onBlur={() => saveField(row.product_name, { tube_count: row.tube_count })}
                      className="h-8 text-sm w-full"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {formatLastOrder(row)}
                    </p>
                  </div>

                  {/* Right — Actions */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase">Actions</Label>
                    <div className="space-y-1">
                      {[
                        { key: 'needs_order' as const, label: 'Needs Order' },
                        { key: 'bring_starter_kit' as const, label: 'Bring Starter Kit' },
                        { key: 'bring_samples' as const, label: 'Bring Samples' },
                        { key: 'switch_tubes' as const, label: 'Switch Tubes' },
                      ].map(action => (
                        <label key={action.key} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={row[action.key]}
                            onCheckedChange={(checked) => {
                              updateRow(row.product_name, { [action.key]: !!checked });
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs">{action.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Interest Row */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase">Interest:</span>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          'h-6 text-[10px] px-2',
                          row.interest === 'interested'
                            ? 'bg-green-500/10 border-green-500/30 text-green-600'
                            : ''
                        )}
                        onClick={() => {
                          const val = row.interest === 'interested' ? null : 'interested';
                          updateRow(row.product_name, { interest: val });
                        }}
                      >
                        Interested
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          'h-6 text-[10px] px-2',
                          row.interest === 'not_interested'
                            ? 'bg-red-500/10 border-red-500/30 text-red-600'
                            : ''
                        )}
                        onClick={() => {
                          const val = row.interest === 'not_interested' ? null : 'not_interested';
                          updateRow(row.product_name, { interest: val });
                        }}
                      >
                        Not Interested
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
