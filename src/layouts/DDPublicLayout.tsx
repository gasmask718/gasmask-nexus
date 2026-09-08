import { Outlet, Link, NavLink } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { DDMark, DDChevron } from '@/components/dynasty-direct/DDMark';

const NAV = [
  { to: '/shop', label: 'Catalog' },
  { to: '/direct/wholesale', label: 'Suppliers' },
  { to: '/track', label: 'Track order' },
];

/**
 * DDPublicLayout — public, unauthenticated chrome for Dynasty Direct's own
 * storefront and marketing pages. Scoped entirely to `.dd-theme`; GasMask and
 * every other business keep PublicLayout untouched.
 */
export default function DDPublicLayout() {
  return (
    <div className="dd-theme min-h-screen flex flex-col bg-[hsl(var(--dd-paper))] text-[hsl(var(--dd-ink))]">
      <header className="sticky top-0 z-40 bg-[hsl(var(--dd-navy-deep))]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6 px-4 h-16">
          <Link to="/direct" aria-label="Dynasty Direct home">
            <DDMark size={30} withWordmark onDark />
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm ${
                    isActive ? 'text-white' : 'text-white/65 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <DDChevron size={11} />}
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/cart"
              className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
            </Link>
            <Link
              to="/direct/wholesale"
              className="hidden sm:inline-flex items-center px-4 h-9 text-sm font-medium text-[hsl(var(--dd-navy-deep))] bg-[hsl(var(--dd-gold))] hover:bg-[hsl(var(--dd-gold-soft))]"
            >
              Supply with us
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[hsl(var(--dd-navy))] text-white/70">
        <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-3">
          <div className="space-y-3">
            <DDMark size={26} withWordmark onDark />
            <p className="text-sm max-w-xs">
              Sourced from vetted suppliers, held to one standard, shipped direct to the buyer.
            </p>
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-medium">Buy</p>
            <Link to="/shop" className="block hover:text-white">Catalog</Link>
            <Link to="/cart" className="block hover:text-white">Cart</Link>
            <Link to="/track" className="block hover:text-white">Track an order</Link>
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-medium">Supply</p>
            <Link to="/direct/wholesale" className="block hover:text-white">Become a supplier</Link>
            <Link to="/portal/wholesaler" className="block hover:text-white">Supplier portal</Link>
            <Link to="/privacy" className="block hover:text-white">Privacy</Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="max-w-6xl mx-auto px-4 py-4 text-xs">
            © {new Date().getFullYear()} Dynasty Direct
          </p>
        </div>
      </footer>
    </div>
  );
}
