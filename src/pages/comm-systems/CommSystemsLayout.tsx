import { ReactNode, useState } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useBusiness } from '@/contexts/BusinessContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  Phone, PhoneCall, FileText, Bot, BarChart3, 
  MessageSquare, Mail, Radio, Brain, Zap, Eye,
  ChevronRight, Home, Menu, X, Building2
} from 'lucide-react';

interface CommSystemsLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const navSections = [
  {
    id: 'call-center',
    label: '📞 AI Call Center OS',
    icon: PhoneCall,
    items: [
      { to: '/comm-systems/dialer', icon: Phone, label: 'Dialer' },
      { to: '/comm-systems/call-logs', icon: FileText, label: 'Call Logs' },
      { to: '/comm-systems/ai-agents', icon: Bot, label: 'AI Agents' },
      { to: '/comm-systems/call-analytics', icon: BarChart3, label: 'Call Analytics' },
    ]
  },
  {
    id: 'text-center',
    label: '💬 AI Text Center OS',
    icon: MessageSquare,
    items: [
      { to: '/comm-systems/messages', icon: MessageSquare, label: 'Messages' },
    ]
  },
  {
    id: 'email-center',
    label: '📧 Email Center OS',
    icon: Mail,
    items: [
      { to: '/comm-systems/emails', icon: Mail, label: 'Emails' },
    ]
  },
  {
    id: 'comm-hub',
    label: '📻 Communication Hub',
    icon: Radio,
    items: [
      { to: '/comm-systems/comm-ai', icon: Brain, label: 'Communications AI' },
      { to: '/comm-systems/automation', icon: Zap, label: 'Comm Automation' },
      { to: '/comm-systems/insights', icon: Eye, label: 'Comm Insights' },
    ]
  }
];

const CommSystemsLayout = ({ children, title, subtitle }: CommSystemsLayoutProps) => {
  const { currentBusiness, loading } = useBusiness();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch all businesses for selector
  const { data: businesses } = useQuery({
    queryKey: ['all-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Business selection is handled via context - display only for now
  const selectedBusinessId = currentBusiness?.id || 'all';

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border transition-all duration-300 z-40",
        sidebarOpen ? "w-64" : "w-0 overflow-hidden"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">📡 Communication Systems</span>
            </div>
            
            {/* Business Selector - Display Only */}
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {currentBusiness?.name || '🌐 All Businesses'}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            {navSections.map((section) => (
              <div key={section.id}>
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
                  <section.icon className="h-3.5 w-3.5" />
                  <span>{section.label}</span>
                </div>
                <div className="space-y-0.5 ml-2">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Link 
              to="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-0"
      )}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
          <div className="flex items-center gap-4 px-6 py-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <ChevronRight className="h-3 w-3" />
              <Link to="/comm-systems" className="hover:text-foreground transition-colors">Communication Systems</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{title}</span>
            </div>

            {/* Business indicator */}
            {currentBusiness && (
              <div className="ml-auto flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Active:</span>
                <span className="font-medium">{currentBusiness.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default CommSystemsLayout;
