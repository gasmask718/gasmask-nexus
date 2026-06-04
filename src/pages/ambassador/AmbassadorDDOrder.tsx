/**
 * AmbassadorDDOrder — 🛒 Dynasty Direct Catalog (field-sales bridge)
 *
 * Mobile-first. Ambassador picks one of their portfolio stores, builds a
 * cart at STORE pricing (what they pitch), and places the order through
 * `dd_create_marketplace_order` with full attribution:
 *   - ambassador_id      → drives commission row in canonical ledger
 *   - ordering_store_id  → links the order back to the store buyer
 *   - shipping_address   → store's address
 *
 * After a successful order:
 *   - Show toast with totals + commission earned
 *   - Offer one-tap "Invite this store to the portal" (deep link)
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { useAmbassadorPortfolio, type PortfolioStore } from '@/hooks/useAmbassadorPortfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Store, Plus, Minus, ShoppingCart, Send, UserPlus, Loader2, ImageOff } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface DDProduct {
  id: string;
  name: string;
  sku: string | null;
  store_price: number | null;
  image_url: string | null;
  units_per_box: number | null;
  category: string | null;
}

type CartLine = { product_id: string; quantity: number; unit_price: number; name: string };

function useDDProducts() {
  return useQuery({
    queryKey: ['amb-dd-products'],
    queryFn: async (): Promise<DDProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,sku,store_price,image_url,units_per_box,category')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []).filter((p) => p.store_price && p.store_price > 0) as DDProduct[];
    },
    staleTime: 60_000,
  });
}

export default function AmbassadorDDOrder() {
  const navigate = useNavigate();
  const { ambassador, stores } = useAmbassadorPortfolio();
  const ambassadorId: string | undefined = ambassador?.id;

  const { data: products = [], isLoading: productsLoading } = useDDProducts();

  const [storeId, setStoreId] = useState<string>('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [lastOrder, setLastOrder] = useState<{ order_id: string; total: number; commission: number | null } | null>(
    null
  );

  const selectedStore = useMemo(() => stores.find((s) => s.store_id === storeId), [stores, storeId]);

  const subtotal = useMemo(
    () => Object.values(cart).reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
    [cart]
  );
  const cartLines = Object.values(cart);

  function setQty(p: DDProduct, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) {
        delete next[p.id];
      } else {
        next[p.id] = {
          product_id: p.id,
          quantity: qty,
          unit_price: p.store_price!,
          name: p.name,
        };
      }
      return next;
    });
  }

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!ambassadorId) throw new Error('No active ambassador record for this account.');
      if (!selectedStore) throw new Error('Pick one of your stores first.');
      if (cartLines.length === 0) throw new Error('Cart is empty.');

      const shipping = {
        name: selectedStore.store_name,
        address1: selectedStore.store_address ?? '',
        city: selectedStore.store_city ?? '',
        state: selectedStore.store_state ?? '',
        zip: '',
      };

      const { data, error } = await supabase.rpc('dd_create_marketplace_order' as any, {
        p_items: cartLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        p_shipping_address: shipping,
        p_guest_email: null,
        p_guest_phone: selectedStore.store_phone || null,
        p_customer_id: null,
        p_subtotal: subtotal,
        p_shipping_cost: 0,
        p_tax_amount: 0,
        p_notes: `Placed by ambassador on behalf of ${selectedStore.store_name}`,
        p_ambassador_id: ambassadorId,
        p_ordering_store_id: selectedStore.store_id,
      } as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: (result: any) => {
      const commission = result?.ambassador?.commission_amount ?? null;
      toast.success(
        `Order placed: ${formatCurrency(result.total)} · commission ${
          commission != null ? formatCurrency(commission) : '—'
        }`
      );
      setLastOrder({ order_id: result.order_id, total: result.total, commission });
      setCart({});
    },
    onError: (e: any) => toast.error(`Order failed: ${e?.message ?? e}`),
  });

  return (
    <PortalRBACGate allowedRoles={['admin', 'ambassador']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title="🛒 Dynasty Direct Catalog"
        subtitle="Browse at store pricing & place an order on behalf of one of your stores"
        backPath="/ambassador/dashboard"
      >
        <div className="space-y-4">
          {/* Store picker */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" /> Order for store
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Pick one of your stores…" />
                </SelectTrigger>
                <SelectContent>
                  {stores.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No stores assigned yet.</div>
                  )}
                  {stores.map((s) => (
                    <SelectItem key={s.store_id} value={s.store_id}>
                      {s.store_name}
                      {s.store_city ? ` · ${s.store_city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStore && (
                <p className="text-xs text-muted-foreground">
                  Ships to: {selectedStore.store_address || '—'}, {selectedStore.store_city ?? ''}{' '}
                  {selectedStore.store_state ?? ''}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Catalog */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Catalog (store pricing)</span>
                <Badge variant="outline" className="text-xs">
                  {products.length} active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 rounded-lg" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active products in the DD catalog yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {products.map((p) => {
                    const line = cart[p.id];
                    const qty = line?.quantity ?? 0;
                    return (
                      <div key={p.id} className="border rounded-lg p-2 bg-card flex flex-col gap-2">
                        <div className="aspect-square w-full bg-muted/40 rounded flex items-center justify-center overflow-hidden">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <ImageOff className="h-8 w-8 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold leading-tight line-clamp-2">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatCurrency(p.store_price!)} / tube
                          </p>
                        </div>
                        <div className="flex items-center gap-1 mt-auto">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setQty(p, Math.max(0, qty - 1))}
                            disabled={qty === 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={qty}
                            min={0}
                            onChange={(e) => setQty(p, Math.max(0, parseInt(e.target.value || '0', 10)))}
                            className="h-8 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setQty(p, qty + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart summary + place order */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Cart
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cartLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cart is empty.</p>
              ) : (
                <>
                  {cartLines.map((l) => (
                    <div key={l.product_id} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">
                        {l.name} <span className="text-muted-foreground">× {l.quantity}</span>
                      </span>
                      <span className="font-medium">{formatCurrency(l.unit_price * l.quantity)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                </>
              )}
              <Button
                className="w-full h-12 text-base"
                disabled={!selectedStore || cartLines.length === 0 || placeOrder.isPending}
                onClick={() => placeOrder.mutate()}
              >
                {placeOrder.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" /> Place order for this store
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Last order receipt + invite hook */}
          {lastOrder && selectedStore && (
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Order placed ✓</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Order <span className="font-mono text-xs">{lastOrder.order_id.slice(0, 8)}</span> ·{' '}
                  {formatCurrency(lastOrder.total)} ·{' '}
                  {lastOrder.commission != null ? (
                    <>commission earned {formatCurrency(lastOrder.commission)}</>
                  ) : (
                    'commission pending'
                  )}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/ambassador/invites?store_id=${selectedStore.store_id}`)}
                >
                  <UserPlus className="h-4 w-4 mr-2" /> Invite this store to the portal
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
