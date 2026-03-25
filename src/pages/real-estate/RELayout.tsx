import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, Target, Phone, FileText, Building2, Users, Calculator, MapPin, TrendingUp, Bot
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const GREEN = '#3B6D11';

const reNavSections = [
  {
    title: 'Penthouse',
    items: [
      { path: '/real-estate', label: 'Command Center', icon: BarChart3 },
    ],
  },
  {
    title: 'Acquisition',
    items: [
      { path: '/real-estate/leads', label: 'Floor 1 — Lead Intelligence', icon: Target },
      { path: '/real-estate/campaigns', label: 'Floor 2 — DC Campaigns', icon: Phone },
    ],
  },
  {
    title: 'Deals',
    items: [
      { path: '/real-estate/deals', label: 'Floor 3 — Active Deals', icon: FileText },
      { path: '/real-estate/buyers', label: 'Floor 4 — Buyer Network', icon: Building2 },
    ],
  },
  {
    title: 'Operations',
    items: [
      { path: '/real-estate/va-desk', label: 'Floor 5 — VA Desk', icon: Users },
      { path: '/real-estate/analyzer', label: 'Floor 6 — Deal Analyzer', icon: Calculator },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/real-estate/automation', label: 'Floor 7 — Automation', icon: Bot },
      { path: '/real-estate/markets', label: 'Floor 8 — Markets', icon: MapPin },
      { path: '/real-estate/analytics', label: 'Floor 9 — Analytics', icon: TrendingUp },
    ],
  },
];

export default function RELayout() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/real-estate') return location.pathname === '/real-estate';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-64 border-r border-border bg-card/50 flex-shrink-0 hidden lg:block">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="h-6 w-6" style={{ color: GREEN }} />
              <div>
                <h2 className="font-bold text-lg" style={{ color: GREEN }}>Real Estate OS</h2>
                <p className="text-xs text-muted-foreground">$1M/month Acquisition Engine</p>
              </div>
            </div>

            {reNavSections.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                        isActive(item.path)
                          ? "font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      style={isActive(item.path) ? { backgroundColor: 'rgba(59,109,17,0.1)', color: GREEN } : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
