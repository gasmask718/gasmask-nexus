import { Card } from '@/components/ui/card';
import { Store } from 'lucide-react';

/**
 * D2C Storefront — placeholder.
 * Public consumer storefront for Dynasty Direct products.
 * Real catalog wiring lives in the marketplace control tower; this surface
 * shows an honest empty state until the public-facing checkout flow is wired.
 */
export default function Shop() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-lg p-8 text-center space-y-3">
        <Store className="h-10 w-10 mx-auto text-primary" />
        <h1 className="text-2xl font-bold">Dynasty Direct Storefront</h1>
        <p className="text-muted-foreground">
          The public D2C storefront is under construction. Wholesale buyers should use the
          marketplace at <a href="/wholesale/marketplace" className="text-primary underline">/wholesale/marketplace</a>.
        </p>
      </Card>
    </div>
  );
}
