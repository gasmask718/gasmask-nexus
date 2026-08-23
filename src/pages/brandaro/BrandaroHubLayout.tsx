import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Swords, Phone, Users, TrendingUp, ListTodo, Brain,
  UserCog, GraduationCap, Crown, Settings,
  BarChart3, Globe, Megaphone, Wrench, Eye, FileText,
  Flame, Target, DollarSign, Rocket, Zap, Search,
  Activity, Shield,
  Presentation, Factory, Crosshair,
  HeartPulse, Star, ChevronLeft, ChevronRight, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AIApprovalDrawer } from "@/components/brandaro/AIApprovalDrawer";
import brandaroLogo from "@/assets/brandaro-logo.png";

const hubNav = [
  { section: "Command", items: [
    { title: "War Room", path: "/brandaro", icon: Swords, end: true },
    { title: "CEO Dashboard", path: "/brandaro/ceo", icon: Crown },
  ]},

  { section: "Sales Floor", items: [
    { title: "Live Calls", path: "/brandaro/calling", icon: Phone },
    { title: "VA Dashboard", path: "/brandaro/va-dashboard", icon: Users },
    { title: "VA Roster", path: "/brandaro/va-roster", icon: Users },
    { title: "VA Command", path: "/brandaro/va-command", icon: UserCog },
    { title: "VA Manager", path: "/brandaro/va-manager", icon: GraduationCap },
    { title: "VA Performance", path: "/brandaro/va-performance", icon: BarChart3 },
    { title: "AI Distribution", path: "/brandaro/ai-distribution", icon: Brain },
    { title: "Closer AI", path: "/brandaro/closer-ai", icon: Flame },
    { title: "Bland AI Dial", path: "/brandaro/bland-dial", icon: Bot },
  ]},
  { section: "Pipeline", items: [
    { title: "CRM Pipeline", path: "/brandaro/crm-pipeline", icon: Target },
    { title: "📬 Inbox", path: "/brandaro/inbox", icon: Megaphone },
    { title: "Leads", path: "/brandaro/leads", icon: ListTodo },
    { title: "Discovery", path: "/brandaro/lead-discovery", icon: Search },
    { title: "Scout Agent", path: "/brandaro/scout-agent", icon: Bot },
    { title: "Qualification", path: "/brandaro/lead-qualification", icon: Shield },
    { title: "Follow-Ups", path: "/brandaro/follow-ups", icon: ListTodo },
    { title: "Proposals", path: "/brandaro/proposals", icon: FileText },
    { title: "Build Pipeline", path: "/brandaro/build-pipeline", icon: Wrench },
    { title: "Website Builder", path: "/brandaro/builder", icon: Wrench },
    { title: "Demo Engine", path: "/brandaro/demo-engine", icon: Presentation },
  ]},
  { section: "Execution", items: [
    { title: "Production", path: "/brandaro/production-pipeline", icon: Factory },
  ]},
  { section: "Intelligence", items: [
    { title: "Patterns", path: "/brandaro/patterns", icon: Activity },
  ]},
  { section: "Domination", items: [
    { title: "Competitors", path: "/brandaro/competitors", icon: Crosshair },
  ]},
  { section: "Growth", items: [
    { title: "Revenue", path: "/brandaro/revenue", icon: DollarSign },
    { title: "Ads Engine", path: "/brandaro/ads-engine", icon: Megaphone },
    { title: "Google SEO", path: "/brandaro/google-domination", icon: Globe },
    { title: "Optimization", path: "/brandaro/optimization", icon: Rocket },
    { title: "Result Engine", path: "/brandaro/result-engine", icon: BarChart3 },
  ]},
  { section: "Clients", items: [
    { title: "Client Portal", path: "/brandaro/clients", icon: Users },
    { title: "Retention", path: "/brandaro/retention", icon: HeartPulse },
    { title: "Reporting", path: "/brandaro/reporting", icon: Eye },
    { title: "Campaigns", path: "/brandaro/campaigns", icon: Zap },
    { title: "Reviews", path: "/brandaro/reviews", icon: Star },
  ]},
  { section: "Admin / Ops", items: [
    { title: "Phone Numbers", path: "/brandaro/admin-numbers", icon: Phone },
    { title: "Leaderboard", path: "/brandaro/admin-leaderboard", icon: BarChart3 },
    { title: "Call Review", path: "/brandaro/admin-call-review", icon: Eye },
    { title: "VA Monitor", path: "/brandaro/admin-monitor", icon: Activity },
    { title: "DNC Manager", path: "/brandaro/admin-dnc", icon: Shield },
  ]},
];

export default function BrandaroHubLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-collapse the sub-nav on small screens so content keeps usable width
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-full overflow-hidden -m-4 md:-m-6">

      {/* Internal sub-navigation panel — NOT a competing sidebar */}
      <div
        className={cn(
          "shrink-0 border-r border-border/40 bg-muted/30 flex flex-col transition-all duration-200",
          collapsed ? "w-12" : "w-56"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-2 border-b border-border/30">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <img src={brandaroLogo} alt="Brandaro Digital" className="h-7 w-7 rounded-md object-contain shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Brandaro</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">War Room</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Nav items */}
        <ScrollArea className="flex-1">
          <div className="py-1">
            {hubNav.map((group) => (
              <div key={group.section} className="mb-1">
                {!collapsed && (
                  <p className="px-3 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                    {group.section}
                  </p>
                )}
                {group.items.map((item) => {
                  const isActive = item.end
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path) && location.pathname !== "/brandaro";
                  const finalActive = item.end
                    ? location.pathname === item.path
                    : isActive;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "flex items-center gap-2 mx-1 px-2 py-1 rounded text-xs transition-colors",
                        finalActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("h-3.5 w-3.5 shrink-0", finalActive && "text-primary")} />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Back button */}
        <div className="border-t border-border/30 p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs gap-2 h-7"
            onClick={() => navigate("/")}
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Back to OS</span>}
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-9 flex items-center justify-between border-b border-border/30 px-3 gap-2 shrink-0">
          <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600">
            <Swords className="h-3 w-3 mr-1" /> BRANDARO HUB
          </Badge>
          <AIApprovalDrawer />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
