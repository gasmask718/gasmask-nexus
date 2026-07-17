import { Outlet, Link } from 'react-router-dom';
import { Crown, ShoppingBag, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * PublicLayout — Marketing wrapper for unauthenticated pages
 * SEO-friendly (no noindex), marketing navbar + footer
 */
export default function PublicLayout() {
  const { canInstall, triggerInstall } = usePwaInstall();

  return (
    <div className="min-h-screen bg-background flex flex-col safe-area-top safe-area-x">
      {/* Marketing Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md safe-area-top">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary flex items-center justify-center">
              <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base sm:text-lg text-foreground tracking-tight">GasMask</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Shop
            </Link>
            <Link to="/locations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Locations
            </Link>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {canInstall && (
              <Button variant="outline" size="sm" onClick={triggerInstall} className="gap-1.5 touch-target">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild className="touch-target">
              <Link to="/cart">
                <ShoppingBag className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Cart</span>
              </Link>
            </Button>
            <Button size="sm" asChild className="touch-target">
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
      <footer className="border-t border-border bg-card/50 safe-area-bottom">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">GasMask</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/shop" className="hover:text-foreground transition-colors">Shop</Link>
              <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
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
