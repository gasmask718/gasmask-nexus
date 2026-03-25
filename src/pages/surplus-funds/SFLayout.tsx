import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, FileText, Search, Phone, Briefcase, Scale, TrendingUp
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const sfNavSections = [
  {
    title: '💰 Command',
    items: [
      { path: '/surplus-funds', label: 'Command Center', icon: BarChart3 },
    ],
  },
  {
    title: '📋 Leads',
    items: [
      { path: '/surplus-funds/leads', label: 'Lead Pipeline', icon: FileText },
      { path: '/surplus-funds/discovery', label: 'Lead Discovery', icon: Search },
    ],
  },
  {
    title: '📞 Outreach',
    items: [
      { path: '/surplus-funds/campaigns', label: 'Call Campaigns', icon: Phone },
    ],
  },
  {
    title: '📄 Operations',
    items: [
      { path: '/surplus-funds/cases', label: 'Cases', icon: Briefcase },
      { path: '/surplus-funds/attorneys', label: 'Attorney Network', icon: Scale },
    ],
  },
  {
    title: '📊 Intelligence',
    items: [
      { path: '/surplus-funds/analytics', label: 'Analytics', icon: TrendingUp },
    ],
  },
];

export default function SFLayout() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/surplus-funds') return location.pathname === '/surplus-funds';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-64 border-r border-border bg-card/50 flex-shrink-0 hidden lg:block">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <Scale className="h-6 w-6 text-amber-500" />
              <div>
                <h2 className="font-bold text-lg text-amber-500">Surplus Funds OS</h2>
                <p className="text-xs text-muted-foreground">Recovery Pipeline</p>
              </div>
            </div>

            {sfNavSections.map((section) => (
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
                          ? "bg-amber-500/10 text-amber-500 font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
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
