import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, Phone, Headphones, AlertTriangle, Activity, Users, 
  Sparkles, Zap, User, GitBranch, BarChart3, Tag, Brain, Shield, 
  Languages, Radio, Settings, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "inbox", label: "Inbox", icon: MessageSquare },
  { path: "dialer", label: "Dialer", icon: Phone },
  { path: "live", label: "Live Calls", icon: Headphones },
  { path: "escalations", label: "Escalations", icon: AlertTriangle },
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
  { path: "settings", label: "Settings", icon: Settings },
];

export default function CommunicationHubLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/crm")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold">Communication Center</h1>
              <p className="text-xs text-muted-foreground">V2-V8 Unified Hub</p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={`/communication/${item.path}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
