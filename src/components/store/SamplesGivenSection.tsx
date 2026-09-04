import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Gift, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { CANONICAL_TUBE_SKUS, brandForProductId } from '@/lib/inventory/skuDisplay';
import { unitLabelForProductId } from '@/lib/inventory/unitLabel';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  storeId: string;
  variant?: 'compact' | 'full';
}

interface SampleRow {
  id: string;
  product_id: string | null;
  brand: string | null;
  quantity: number;
  given_at: string;
  given_by: string | null;
  note: string | null;
}

export function SamplesGivenSection({ storeId, variant = 'compact' }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState<string>(CANONICAL_TUBE_SKUS[0].product_id);
  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState('');

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['store-samples-given', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_samples_given' as any)
        .select('id,product_id,brand,quantity,given_at,given_by,note')
        .eq('store_id', storeId)
        .order('given_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as SampleRow[];
    },
  });

  const logSample = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error('Pick a product');
      if (!qty || qty < 1) throw new Error('Quantity must be at least 1');
      const brand = brandForProductId(productId);
      const { error } = await supabase.from('store_samples_given' as any).insert({
        store_id: storeId,
        product_id: productId,
        brand,
        quantity: qty,
        given_by: user?.id ?? null,
        note: note.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sample logged');
      setShowForm(false);
      setQty(1);
      setNote('');
      qc.invalidateQueries({ queryKey: ['store-samples-given', storeId] });
      qc.invalidateQueries({ queryKey: ['samples-by-brand'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to log sample'),
  });

  // Historical rows keep their original product/brand naming — never rewritten.
  const displayName = (s: Pick<SampleRow, 'product_id' | 'brand'>) =>
    CANONICAL_TUBE_SKUS.find((c) => c.product_id === s.product_id)?.display ??
    (s.brand?.trim() || 'Unknown');

  return (
    <div className="space-y-2 rounded-md border border-border/50 bg-background/30 p-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Gift className="h-3 w-3" /> Samples Given
          {samples.length > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[9px]">{samples.length}</Badge>
          )}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-3 w-3" /> Log
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded border border-border/40 bg-muted/30 p-2">
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                {CANONICAL_TUBE_SKUS.map((s) => (
                  <SelectItem key={s.product_id} value={s.product_id}>
                    {s.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
              className="h-8 text-xs"
            />
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)…"
            className="min-h-[48px] text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => logSample.mutate()}
              disabled={logSample.isPending}
            >
              {logSample.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : samples.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No samples logged yet</p>
      ) : (
        <ul className="space-y-1">
          {samples.slice(0, variant === 'compact' ? 5 : 50).map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-medium">{displayName(s.product_id)}</span>
                <span className="text-muted-foreground">
                  {' '}· {s.quantity} {unitLabelForProductId(s.product_id)}
                </span>
                {s.note && <p className="text-[10px] text-muted-foreground truncate">{s.note}</p>}
              </div>
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(s.given_at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
