import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, MapPin, CreditCard, User, ArrowLeft, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/account/orders", label: "Orders", icon: Package },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/payment", label: "Payment Methods", icon: CreditCard },
  { to: "/account/profile", label: "Profile", icon: User },
];

export default function AccountLayout() {
  const { user, loading } = useAuth() as any;
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <User className="h-14 w-14 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-bold">Sign in to your account</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to view your Dynasty Direct order history, saved addresses, payment methods, and profile.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild>
                <Link to={`/auth?redirect=${redirect}`}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign in
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/shop">Back to shop</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/shop" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Shop
          </Link>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
            My Account
          </span>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 grid md:grid-cols-4 gap-6">
        <nav className="md:col-span-1">
          <Card>
            <CardContent className="p-2">
              <ul className="space-y-1">
                {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </nav>

        <div className="md:col-span-3">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
