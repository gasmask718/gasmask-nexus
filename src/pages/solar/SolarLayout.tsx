import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, Target, Phone, FileText, Users, Calculator, MapPin, TrendingUp, Bot, Sun, Handshake, DollarSign, Brain, Zap, MessageSquare
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const SOLAR_AMBER = '#E8A317';

const solarNavSections = [
  {
    title: 'Penthouse',
    items: [
      { path: '/solar', label: 'Command Center', icon: BarChart3 },
    ],
  },
  {
    title: 'AI Closing Engine',
    items: [
      { path: '/solar/estimator', label: '☀️ Solar Estimator + AI Chat', icon: Zap },
      { path: '/solar/closing', label: '📊 Closing Dashboard', icon: Target },
      { path: '/solar/followups', label: '📬 Follow-Up Engine', icon: MessageSquare },
      { path: '/solar/bookings', label: '📅 Appointment Booking', icon: FileText },
    ],
  },
  {
    title: 'Acquisition',
    items: [
      { path: '/solar/leads', label: 'Floor 1 — Lead Intelligence', icon: Target },
      { path: '/solar/outreach', label: 'Floor 2 — AI Outreach', icon: Phone },
      { path: '/solar/qualification', label: 'Floor 3 — Qualification', icon: Brain },
    ],
  },
  {
    title: 'Closing',
    items: [
      { path: '/solar/appointments', label: 'Floor 4 — Appointments', icon: FileText },
      { path: '/solar/live-calls', label: 'Floor 5 — Live Call Assist', icon: Phone },
      { path: '/solar/deals', label: 'Floor 6 — Deals', icon: DollarSign },
    ],
  },
  {
    title: 'Operations',
    items: [
      { path: '/solar/partners', label: 'Floor 7 — Partner Network', icon: Handshake },
      { path: '/solar/agents', label: 'Floor 8 — Agents', icon: Users },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/solar/ai-brain', label: 'Floor 9 — AI Brain', icon: Bot },
      { path: '/solar/analytics', label: 'Floor 10 — Analytics', icon: TrendingUp },
      { path: '/solar/installer-map', label: '🗺️ Installer Map', icon: MapPin },
    ],
  },
  {
    title: 'CRM',
    items: [
      { path: '/solar/crm', label: 'CRM', icon: Users },
    ],
  },
];

export default function SolarLayout() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/solar') return location.pathname === '/solar';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-64 border-r border-border bg-card/50 flex-shrink-0 hidden lg:block">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <Sun className="h-6 w-6" style={{ color: SOLAR_AMBER }} />
              <div>
                <h2 className="font-bold text-lg" style={{ color: SOLAR_AMBER }}>BrightSun Solar</h2>
                <p className="text-xs text-muted-foreground">AI-Powered Solar Deal Engine</p>
              </div>
            </div>

            {solarNavSections.map((section) => (
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
                      style={isActive(item.path) ? { backgroundColor: 'rgba(232,163,23,0.1)', color: SOLAR_AMBER } : undefined}
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
