import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  Swords, Phone, Users, TrendingUp, ListTodo, Brain,
  Theater, UserCog, GraduationCap, Crown, Settings,
  BarChart3, Globe, Megaphone, Wrench, Eye, FileText,
  Flame, Target, DollarSign, Rocket, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const hubNav = [
  { section: "Command", items: [
    { title: "War Room", path: "/brandaro", icon: Swords, end: true },
    { title: "CEO Dashboard", path: "/brandaro/ceo", icon: Crown },
  ]},
  { section: "Sales Floor", items: [
    { title: "Live Calls", path: "/brandaro/calling", icon: Phone },
    { title: "VA Dashboard", path: "/brandaro/va-dashboard", icon: Users },
    { title: "VA Command", path: "/brandaro/va-command", icon: UserCog },
    { title: "VA Manager", path: "/brandaro/va-manager", icon: GraduationCap },
    { title: "Closer AI", path: "/brandaro/closer-ai", icon: Flame },
  ]},
  { section: "Pipeline", items: [
    { title: "Leads", path: "/brandaro/leads", icon: Target },
    { title: "Follow-Ups", path: "/brandaro/follow-ups", icon: ListTodo },
    { title: "Proposals", path: "/brandaro/proposals", icon: FileText },
    { title: "Build Pipeline", path: "/brandaro/build-pipeline", icon: Wrench },
  ]},
  { section: "Intelligence", items: [
    { title: "AI Brain", path: "/brandaro/ai-brain", icon: Brain },
    { title: "Personalities", path: "/brandaro/personalities", icon: Theater },
    { title: "Learning", path: "/brandaro/learning", icon: GraduationCap },
    { title: "Domination", path: "/brandaro/domination", icon: Crown },
  ]},
  { section: "Growth", items: [
    { title: "Revenue", path: "/brandaro/revenue", icon: DollarSign },
    { title: "Ads Engine", path: "/brandaro/ads-engine", icon: Megaphone },
    { title: "Google SEO", path: "/brandaro/google-domination", icon: Globe },
    { title: "Optimization", path: "/brandaro/optimization", icon: Rocket },
    { title: "Result Engine", path: "/brandaro/result-engine", icon: BarChart3 },
  ]},
  { section: "Clients", items: [
    { title: "Retention", path: "/brandaro/retention", icon: Users },
    { title: "Reporting", path: "/brandaro/reporting", icon: Eye },
    { title: "Campaigns", path: "/brandaro/campaigns", icon: Zap },
    { title: "Reviews", path: "/brandaro/reviews", icon: FileText },
  ]},
];

function BrandaroSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent>
        {/* Brand header */}
        {!collapsed && (
          <div className="px-4 py-4 border-b border-border/30">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Swords className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">Brandaro Digital</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Sales War Room</p>
              </div>
            </div>
          </div>
        )}

        {hubNav.map((group) => (
          <SidebarGroup key={group.section} defaultOpen>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {group.section}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = item.end
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.path}
                          end={item.end}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export default function BrandaroHubLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-[calc(100vh-4rem)] flex w-full">
        <BrandaroSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-10 flex items-center border-b border-border/30 px-2 gap-2 shrink-0">
            <SidebarTrigger className="h-7 w-7" />
            <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600">
              <Swords className="h-3 w-3 mr-1" /> BRANDARO HUB
            </Badge>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
