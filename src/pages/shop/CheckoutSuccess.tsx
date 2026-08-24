import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

/**
 * Landing page Stripe redirects to after a successful checkout session.
 * Deliberately makes NO claim about payment state — the webhook is the only
 * authority on that. It confirms the handoff and points at order tracking.
 */
export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');

  useEffect(() => {
    document.title = 'Order received — Dynasty Direct';
    try {
      window.localStorage.removeItem('dd_guest_cart_v1');
      window.dispatchEvent(new Event('dd_guest_cart_changed'));
    } catch {
      /* non-fatal */
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-20 max-w-xl">
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Thank you — your order is in</h1>
          <p className="text-muted-foreground">
            We're confirming the payment with our processor now. You'll get an email as soon as it
            clears, and another when your supplier ships with a tracking number.
          </p>
          {orderId && (
            <p className="text-sm">
              Order reference: <span className="font-mono">{orderId}</span>
            </p>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <Button asChild>
              <Link to={orderId ? `/track?order_id=${orderId}` : '/track'}>Track this order</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/shop">Keep shopping</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
