import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BarChart3, Phone, Brain, Shield, PhoneOutgoing } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { path: '/voice-ops', label: 'Dashboard', icon: BarChart3 },
  { path: '/voice-ops/numbers', label: 'Phone Numbers', icon: Phone },
  { path: '/voice-ops/agents', label: 'Agent Config', icon: Brain },
  { path: '/voice-ops/secrets', label: 'Env Secrets', icon: Shield },
  { path: '/voice-ops/outbound', label: 'Outbound Call', icon: PhoneOutgoing },
];

export default function VoiceOpsLayout() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/voice-ops') return location.pathname === '/voice-ops';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-56 border-r border-border bg-[hsl(var(--card))] flex-shrink-0 hidden lg:block">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="mb-6">
              <h2 className="font-bold text-lg">Voice Ops</h2>
              <p className="text-xs text-muted-foreground">AI Voice Operations</p>
            </div>
            <div className="space-y-1">
              {navItems.map((item) => (
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
        </ScrollArea>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
