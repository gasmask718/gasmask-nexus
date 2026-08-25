import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, PackageSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ReturnRequestDialog } from '@/components/dynasty-direct/ReturnRequestDialog';
import { OrderSupportLink } from '@/components/dynasty-direct/OrderSupportPanel';

/**
 * Guest order lookup + tracking.
 * Calls dd-lookup-guest-order, which enforces exact-email match and a
 * per-IP rate limit and returns {} for every miss — so this screen shows the
 * SAME message for "wrong email" and "no such order" on purpose.
 */
export default function TrackOrder() {
  const [params] = useSearchParams();
  const [orderId, setOrderId] = useState(params.get('order_id') ?? '');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = 'Track your order — Dynasty Direct';
  }, []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setNotFound(false);
    const { data, error } = await supabase.functions.invoke('dd-lookup-guest-order', {
      body: { order_id: orderId.trim(), email: email.trim() },
    });
    setLoading(false);
    if (error) {
      setNotFound(true);
      return;
    }
    if (!data || Object.keys(data).length === 0) {
      setNotFound(true);
      return;
    }
    setResult(data);
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Track your order</h1>

      <Card>
        <CardHeader><CardTitle>Find your order</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={lookup}>
            <div className="space-y-2">
              <Label htmlFor="order">Order reference</Label>
              <Input id="order" value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email used at checkout</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PackageSearch className="h-4 w-4 mr-2" />}
              Look up order
            </Button>
          </form>
        </CardContent>
      </Card>

      {notFound && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            We couldn't match that order reference and email. Check both and try again — if it still
            doesn't match, reply to your order email and we'll find it for you.
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> Order status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {result.status && <Badge>{String(result.status)}</Badge>}
              {result.payment_status && <Badge variant="outline">{String(result.payment_status)}</Badge>}
            </div>
            {Array.isArray(result.shipments) && result.shipments.length > 0 ? (
              <div className="space-y-3">
                {result.shipments.map((s: any, i: number) => (
                  <div key={i} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{s.status ?? 'pending'}</Badge>
                      {s.carrier && <span className="text-muted-foreground">{s.carrier}</span>}
                    </div>
                    {s.tracking_number ? (
                      <a
                        className="text-primary underline break-all"
                        href={s.tracking_url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.tracking_number}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">Tracking number appears once the label is bought.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No shipments yet — your supplier is preparing the order.
              </p>
            )}

            {/* Something wrong with this order? — return + support, both proven
                by the same order-id + checkout-email pair used above. */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-muted-foreground">Something wrong with this order?</span>
              <ReturnRequestDialog orderId={orderId.trim()} email={email.trim()} />
            </div>
            <OrderSupportLink orderId={orderId.trim()} email={email.trim()} />
          </CardContent>
        </Card>
      )}

      <Button asChild variant="ghost">
        <Link to="/shop">Back to shop</Link>
      </Button>
    </div>
  );
}
