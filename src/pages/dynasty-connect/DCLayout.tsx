import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  BarChart3, Brain, Phone, Building2, Settings, FileText, 
  Users, Zap, Radio, Target, Headphones, DollarSign, Rocket,
  Inbox, Mic, ClipboardList, ShieldOff, ShieldCheck
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const dcNavSections = [
  {
    title: '🎯 Command Center',
    items: [
      { path: '/dynasty-connect', label: 'Dashboard', icon: BarChart3 },
      { path: '/dynasty-connect/live', label: 'Live Calls', icon: Radio },
      { path: '/dynasty-connect/finished', label: 'Finished Calls', icon: FileText },
    ],
  },
  {
    title: '📞 Call Center',
    items: [
      { path: '/dynasty-connect/phone-manager', label: 'Phone Numbers', icon: Phone },
      { path: '/dynasty-connect/dispatch', label: 'Call Dispatch', icon: Zap },
      { path: '/dynasty-connect/results', label: 'Call Results', icon: FileText },
      { path: '/dynasty-connect/leads', label: 'Leads Inbox', icon: Inbox },
      { path: '/dynasty-connect/recordings', label: 'Recordings', icon: Mic },
      { path: '/dynasty-connect/dispositions', label: 'Dispositions', icon: ClipboardList },
      { path: '/dynasty-connect/analytics-dashboard', label: 'Analytics', icon: BarChart3 },
      { path: '/dynasty-connect/lead-pipeline', label: 'Lead Pipeline', icon: Target },
    ],
  },
  {
    title: '📋 Campaigns',
    items: [
      { path: '/dynasty-connect/bulk-launch', label: 'Bulk Launch', icon: Rocket },
      { path: '/dynasty-connect/campaigns', label: 'All Campaigns', icon: Target },
      { path: '/dynasty-connect/campaigns/builder', label: 'Campaign Builder', icon: Zap },
      { path: '/dynasty-connect/campaigns/outbound', label: 'Outbound Dialer', icon: Phone },
    ],
  },
  {
    title: '🤖 AI Agents',
    items: [
      { path: '/dynasty-connect/agents', label: 'Agent Center', icon: Brain },
    ],
  },
  {
    title: '🧠 Call Intelligence',
    items: [
      { path: '/dynasty-connect/intelligence', label: 'Call Logs', icon: FileText },
    ],
  },
  {
    title: '🏢 Business Pipelines',
    items: [
      { path: '/dynasty-connect/pipelines', label: 'All Pipelines', icon: Building2 },
      { path: '/dynasty-connect/pipelines/surplus-funds', label: 'Surplus Funds', icon: DollarSign },
      { path: '/dynasty-connect/pipelines/real-estate', label: 'Real Estate', icon: Building2 },
      { path: '/dynasty-connect/pipelines/unforgettable-times', label: 'Unforgettable Times', icon: Users },
      { path: '/dynasty-connect/pipelines/playboxxx', label: 'PlayBoxxx', icon: Users },
      { path: '/dynasty-connect/pipelines/brightsun-energy', label: 'BrightSun Energy', icon: Zap },
      { path: '/dynasty-connect/pipelines/gasmask-new-stores', label: 'GasMask New Stores', icon: Building2 },
    ],
  },
  {
    title: '⚙️ Infrastructure',
    items: [
      { path: '/dynasty-connect/infrastructure', label: 'System Health', icon: Settings },
      { path: '/dynasty-connect/phone-numbers', label: 'Phone Config', icon: Phone },
      { path: '/dynasty-connect/infrastructure/numbers', label: 'Phone Numbers', icon: Phone },
      { path: '/dynasty-connect/infrastructure/phone-setup', label: 'Phone Setup', icon: Phone },
    ],
  },
  {
    title: '🛡️ Compliance & Data',
    items: [
      { path: '/dynasty-connect/dnc', label: 'DNC Manager', icon: ShieldOff },
      { path: '/dynasty-connect/compliance', label: 'Compliance', icon: ShieldCheck },
    ],
  },
  {
    title: '💰 Clients',
    items: [
      { path: '/dynasty-connect/clients', label: 'Client Management', icon: DollarSign },
    ],
  },
];
export default function DCLayout() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/dynasty-connect') return location.pathname === '/dynasty-connect';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6 overflow-hidden">
      {/* DC Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 flex-shrink-0 hidden lg:flex flex-col h-full overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <Headphones className="h-6 w-6 text-primary" />
              <div>
                <h2 className="font-bold text-lg">Dynasty Connect</h2>
                <p className="text-xs text-muted-foreground">AI Call Center Hub</p>
              </div>
            </div>

            {dcNavSections.map((section) => (
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
                          ? "bg-primary/10 text-primary font-medium"
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

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
