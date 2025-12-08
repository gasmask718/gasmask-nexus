import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, Phone, Headphones, AlertTriangle, Activity, Users, 
  Sparkles, Zap, User, GitBranch, BarChart3, Tag, Brain, Shield, 
  Languages, Radio, Settings, ArrowLeft, ChevronLeft, ChevronRight,
  Search, Plus, PhoneCall, MessageCircle, PhoneOutgoing, MessageSquarePlus,
  Volume2
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "inbox", label: "Inbox", icon: MessageSquare, badge: 12 },
  { path: "outbound-engine", label: "Outbound Engine", icon: Zap, badge: undefined },
  { path: "autonomous-director", label: "Autonomous Director", icon: Brain },
  { path: "voice-library", label: "Voice Library", icon: Volume2 },
  { path: "dialer", label: "Dialer (AI)", icon: Phone },
  { path: "manual-calls", label: "Manual Calls", icon: PhoneOutgoing },
  { path: "manual-text", label: "Manual Text", icon: MessageSquarePlus },
  { path: "ai-auto-dialer", label: "AI Auto Dialer", icon: PhoneCall },
  { path: "ai-auto-text", label: "AI Auto Text", icon: MessageCircle },
  { path: "live", label: "Live Calls", icon: Headphones, badge: 3 },
  { path: "escalations", label: "Escalations", icon: AlertTriangle, badge: 2 },
  { path: "engagement", label: "Engagement", icon: Activity },
  { path: "routing", label: "Routing", icon: Users },
  { path: "outreach", label: "AI Outreach", icon: Sparkles },
  { path: "campaigns", label: "Campaigns", icon: Zap },
  { path: "personas", label: "Personas", icon: User },
  { path: "call-flows", label: "Call Flows", icon: GitBranch },
  { path: "heatmap", label: "Heatmap", icon: BarChart3 },
  { path: "call-reasons", label: "Call Reasons", icon: Tag },
  { path: "predictions", label: "Predictions", icon: Brain },
  { path: "agents", label: "AI Agents", icon: Shield },
  { path: "language", label: "Language", icon: Languages },
  { path: "voice-matrix", label: "Voice Matrix", icon: Radio },
  { path: "phone-numbers", label: "Phone Numbers", icon: Phone },
  { path: "settings", label: "Settings", icon: Settings },
];

export default function CommunicationHubLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside 
        className={cn(
          "h-full border-r bg-card flex flex-col transition-all duration-300 ease-in-out",
          collapsed ? "w-16 min-w-16" : "w-64 min-w-64"
        )}
      >
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
            <Button variant="ghost" size="icon" onClick={() => navigate("/crm")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-sm truncate">Communication</h1>
                <p className="text-xs text-muted-foreground truncate">Command Center</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-2 border-b hover:bg-muted/50 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        
        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={`/communication/${item.path}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <Badge 
                        variant="destructive" 
                        className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Top Action Bar */}
        <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 gap-4">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search calls, messages, contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">New SMS</span>
            </Button>
            <Button size="sm" className="gap-2">
              <PhoneCall className="h-4 w-4" />
              <span className="hidden sm:inline">New Call</span>
            </Button>
            <Button size="sm" variant="secondary" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Action</span>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full min-h-full p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
