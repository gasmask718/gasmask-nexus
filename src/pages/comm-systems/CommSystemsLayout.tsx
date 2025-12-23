import { ReactNode, useState } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Phone, PhoneCall, FileText, Bot, BarChart3, 
  MessageSquare, Mail, Radio, Brain, Zap, Eye,
  ChevronRight, Home, Menu, X, Building2
} from 'lucide-react';
import { 
  GlobalBusinessFilter, 
  useCommBusinessContext,
  BusinessCompliancePanel 
} from '@/components/comm-systems';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CommSystemsLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showCompliance?: boolean;
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

const CommSystemsLayout = ({ children, title, subtitle, showCompliance = false }: CommSystemsLayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  
  // Global business context from zustand store
  const { context, setContext } = useCommBusinessContext();

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
              <span className="font-bold text-lg">📡 Comm Systems</span>
            </div>
            
            {/* Business Context Summary in Sidebar */}
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-md text-sm",
              context.isLocked ? "bg-amber-500/20 text-amber-500" : "bg-muted"
            )}>
              <Building2 className="h-4 w-4" />
              <span className="truncate">
                {context.mode === 'all' ? '🌐 All Businesses' : context.businessName}
              </span>
              {context.isLocked && <span className="text-xs">🔒</span>}
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
        {/* Top Bar with Global Business Filter */}
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
              <Link to="/comm-systems" className="hover:text-foreground transition-colors">Comm Systems</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{title}</span>
            </div>
          </div>

          {/* Global Business Filter Bar */}
          <div className="px-6 pb-3">
            <GlobalBusinessFilter 
              context={context}
              onContextChange={setContext}
              onCompare={() => setShowCompareDialog(true)}
              showCompare={true}
            />
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          
          {/* Main content with optional compliance sidebar */}
          {showCompliance ? (
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3">
                {children}
              </div>
              <div className="lg:col-span-1">
                <div className="sticky top-40">
                  <BusinessCompliancePanel 
                    businessId={context.businessId}
                    businessName={context.businessName}
                    isAllBusinesses={context.mode === 'all'}
                  />
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Compare Businesses Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Compare Businesses
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>Business comparison dashboard</p>
            <p className="text-sm">Select businesses to compare communication performance</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommSystemsLayout;
