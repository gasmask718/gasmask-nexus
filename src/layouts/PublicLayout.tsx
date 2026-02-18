import { Outlet, Link } from 'react-router-dom';
import { Crown, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PublicLayout — Marketing wrapper for unauthenticated pages
 * SEO-friendly (no noindex), marketing navbar + footer
 */
export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Marketing Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">GasMask</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Shop
            </Link>
            <Link to="/twl-landing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/cart">
                <ShoppingBag className="h-4 w-4 mr-1" />
                Cart
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth">Login</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">GasMask</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/shop" className="hover:text-foreground transition-colors">Shop</Link>
              <Link to="/twl-landing" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/auth" className="hover:text-foreground transition-colors">Login</Link>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} GasMask. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
