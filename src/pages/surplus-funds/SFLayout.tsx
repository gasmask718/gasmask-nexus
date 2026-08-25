import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, FileText, Search, Phone, Briefcase, Scale, TrendingUp,
  DollarSign, Bot, FileCheck, Users
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const sfNavSections = [
  {
    title: '💰 Penthouse',
    items: [
      { path: '/surplus-funds', label: 'Command Center', icon: DollarSign },
    ],
  },
  {
    title: '🏢 Acquisition',
    items: [
      { path: '/surplus-funds/leads', label: 'Floor 1 — Lead Intelligence', icon: FileText },
      { path: '/surplus-funds/discovery', label: 'Discovery', icon: Search },
      { path: '/surplus-funds/campaigns', label: 'Floor 2 — DC Campaigns', icon: Phone },
    ],
  },
  {
    title: '📋 Operations',
    items: [
      { path: '/surplus-funds/cases', label: 'Floor 3 — Case Management', icon: Briefcase },
      { path: '/surplus-funds/attorneys', label: 'Floor 4 — Attorney Network', icon: Scale },
      { path: '/surplus-funds/attorney-crm', label: 'Attorney CRM', icon: Users },
      { path: '/surplus-funds/documents', label: 'Floor 5 — Documents', icon: FileCheck },
      { path: '/surplus-funds/contracts', label: 'Contracts', icon: FileCheck },
      { path: '/surplus-funds/human-queue', label: 'Human Queue', icon: Users },
    ],
  },
  {
    title: '🤖 Intelligence',
    items: [
      { path: '/surplus-funds/automation', label: 'Floor 6 — AI & Automation', icon: Bot },
      { path: '/surplus-funds/analytics', label: 'Floor 7 — Analytics', icon: TrendingUp },
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
          <div className="px-4 pb-4 pt-1.5">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="h-6 w-6 text-amber-500" />
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

      <main className="flex-1 px-6 pb-6 pt-1.5 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
