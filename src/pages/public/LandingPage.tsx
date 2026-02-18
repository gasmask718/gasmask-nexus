import { Link } from 'react-router-dom';
import { Crown, ShoppingBag, ArrowRight, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * LandingPage — Public marketing landing page for unauthenticated visitors
 * Served at "/" when user is not logged in
 */
export default function LandingPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg" style={{ boxShadow: 'var(--shadow-glow)' }}>
            <Crown className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight leading-tight">
          GasMask <span className="text-primary">Approved</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Premium tobacco products. Authentic quality. Direct to your store.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" asChild className="gap-2 px-8">
            <Link to="/shop">
              <ShoppingBag className="h-5 w-5" />
              Shop Now
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="gap-2">
            <Link to="/auth">
              Sign In
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
          {['Wholesale Pricing', 'Fast Delivery', 'Store Portal', 'Ambassador Program'].map((feature) => (
            <span
              key={feature}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
            >
              <Flame className="h-3 w-3 text-primary" />
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
