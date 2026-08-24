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
  Search, Plus, PhoneCall, MessageCircle, PhoneOutgoing, MessageSquarePlus, Megaphone,
  Volume2, DollarSign, PhoneForwarded, Wrench, UserCog, Route, Voicemail,
  Clock, Moon, Rocket, Target, Bot, Hash, FileText, Eye, Gauge,
  ShoppingCart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SendMessageModal } from "@/components/communication/SendMessageModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { CommunicationRuntimeProvider } from "@/contexts/CommunicationRuntimeContext";
import { SystemHealthBar } from "@/components/communication/SystemHealthBar";
import { isDispatchWired, sectionHasDispatch, DISPATCH_TOOLTIP } from "@/config/dispatchRegistry";

// ═══ 5-FLOOR SIDEBAR STRUCTURE ═══

interface NavItem {
  path: string;
  label: string;
  icon: any;
  badge?: number;
  highlight?: boolean;
  adminOnly?: boolean;
}

interface FloorSection {
  label: string;
  icon: any;
  items: NavItem[];
  adminOnly?: boolean;
}

const FLOOR_1_OPS: FloorSection = {
  label: "Operations Hub",
  icon: Headphones,
  items: [
    { path: "unified-inbox", label: "Unified Inbox", icon: MessageSquare, badge: 12, highlight: true },
    { path: "auto-dialer", label: "Auto Dialer", icon: Rocket, highlight: true },
    { path: "power-dialer", label: "Power Dialer", icon: Zap, highlight: true },
    { path: "campaign-dial", label: "Campaign Dial", icon: Target, highlight: true },
    { path: "manual-calls", label: "Manual Calls", icon: PhoneOutgoing },
    { path: "manual-text", label: "Manual Text", icon: MessageSquarePlus },
    { path: "escalations", label: "Escalations", icon: AlertTriangle, badge: 2 },
    { path: "deals", label: "Deals & Sales", icon: DollarSign },
    { path: "follow-ups", label: "Follow-Up Manager", icon: Activity },
    { path: "voicemail-inbox", label: "Voicemail Inbox", icon: Voicemail },
    { path: "missed-calls", label: "Missed Calls", icon: Phone },
    { path: "unresolved-queue", label: "Unresolved Queue", icon: AlertTriangle },
    { path: "field-submissions", label: "Field Submissions", icon: FileText },
  ],
};

const FLOOR_2_AUTOMATION: FloorSection = {
  label: "Automation Engine",
  icon: Zap,
  items: [
    { path: "outbound-growth", label: "Outbound Growth", icon: Rocket, highlight: true },
    { path: "campaigns", label: "Campaigns", icon: Megaphone },
    { path: "messaging-hub", label: "Messaging Hub", icon: MessageCircle, highlight: true },
    
    { path: "personas", label: "Personas", icon: User },
    { path: "call-flows", label: "Call Flows", icon: GitBranch },
    { path: "playbooks", label: "Playbooks", icon: FileText },
  ],
};

const FLOOR_3_INTELLIGENCE: FloorSection = {
  label: "Intelligence",
  icon: Brain,
  items: [
    { path: "call-intelligence", label: "Call Intelligence", icon: Brain, highlight: true },
    { path: "heatmap", label: "Heatmap", icon: BarChart3 },
    { path: "predictions", label: "Predictions", icon: Brain },
    { path: "rep-performance", label: "Rep Performance", icon: Users },
    { path: "revenue-intelligence", label: "Revenue Intelligence", icon: DollarSign },
    { path: "optimization", label: "Optimization AI", icon: Sparkles },
    { path: "predictive-targeting", label: "Predictive Targeting", icon: Target },
    { path: "engagement", label: "Engagement", icon: Activity },
    { path: "cost-dashboard", label: "Cost & Compliance", icon: Shield },
    { path: "call-reasons", label: "Call Reasons", icon: Tag },
    { path: "dialer-integrity", label: "Dialer Integrity", icon: Gauge },
    { path: "campaign-intelligence", label: "Campaign Intelligence", icon: BarChart3 },
  ],
};

const FLOOR_4_VOICE: FloorSection = {
  label: "Voice System",
  icon: Radio,
  items: [
    { path: "agents", label: "AI Agents", icon: Bot },
    { path: "bland-dial", label: "Bland AI Dial", icon: Bot, highlight: true },
    { path: "voice-matrix", label: "Voice Matrix", icon: Radio },
    { path: "language", label: "Language", icon: Languages },
  ],
};

const FLOOR_5_CONTROL: FloorSection = {
  label: "System Control",
  icon: Settings,
  adminOnly: true,
  items: [
    { path: "settings", label: "Settings", icon: Settings, highlight: true },
    { path: "phone-numbers", label: "Phone Numbers", icon: Hash },
    { path: "business-numbers", label: "Caller IDs & Routing", icon: PhoneForwarded },
    { path: "provision-numbers", label: "Buy Numbers", icon: ShoppingCart },
    { path: "routing", label: "Routing", icon: Route },
    { path: "call-diagnostics", label: "Diagnostics", icon: Wrench },
    { path: "dialer-health", label: "Dialer Health", icon: BarChart3 },
    { path: "shadow-mode", label: "Shadow Mode", icon: Eye },
  ],
};

const ALL_FLOORS: FloorSection[] = [
  FLOOR_1_OPS,
  FLOOR_2_AUTOMATION,
  FLOOR_3_INTELLIGENCE,
  FLOOR_4_VOICE,
  FLOOR_5_CONTROL,
];

export default function CommunicationHubLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState<number[]>([0, 1]); // Ops + Automation open by default

  const { data: profileData } = useCurrentUserProfile();
  const userRole = profileData?.profile?.primary_role || '';
  const isAdmin = ['admin', 'ceo', 'owner', 'va'].includes(userRole);

  const toggleFloor = (index: number) => {
    setExpandedFloors(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleNewCall = () => {
    navigate("/communication/manual-calls");
    toast.info("Opening call dialer...");
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "log-call": navigate("/communication/manual-calls"); break;
      case "send-email": navigate("/grabba/email-center"); break;
      case "create-campaign": navigate("/communication/campaigns"); break;
      case "view-escalations": navigate("/communication/escalations"); break;
      default: toast.info(`Action: ${action}`);
    }
  };

  return (
    <CommunicationRuntimeProvider>
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
        
        {/* Navigation - 5 Floors */}
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {ALL_FLOORS.map((floor, floorIdx) => {
              // Hide admin-only floors for non-admins
              if (floor.adminOnly && !isAdmin) return null;

              const isExpanded = expandedFloors.includes(floorIdx);
              const FloorIcon = floor.icon;
              const floorWired = sectionHasDispatch(floor.items.map(i => `/communication/${i.path}`));

              return (
                <div key={floor.label}>
                  {/* Floor Header */}
                  {!collapsed ? (
                    <button
                      onClick={() => toggleFloor(floorIdx)}
                      className="w-full flex items-center justify-between px-3 py-2 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FloorIcon className="h-3 w-3" />
                        {floor.label}
                        {floorWired && (
                          <span
                            title={DISPATCH_TOOLTIP}
                            aria-label={DISPATCH_TOOLTIP}
                            className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                          />
                        )}
                      </span>
                      {isExpanded ? (
                        <ChevronLeft className="h-3 w-3 rotate-[-90deg]" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  ) : (
                    <div className="border-t my-2" />
                  )}

                  {/* Floor Items */}
                  {(collapsed || isExpanded) && floor.items.map((item) => {
                    if (item.adminOnly && !isAdmin) return null;
                    const fullPath = `/communication/${item.path}`;
                    const wired = isDispatchWired(fullPath);
                    return (
                      <NavLink
                        key={item.path}
                        to={fullPath}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : item.highlight
                                ? "text-foreground bg-muted/50 hover:bg-muted font-medium border border-primary/20"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            collapsed && "justify-center px-2"
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {wired && (
                              <span
                                title={DISPATCH_TOOLTIP}
                                aria-label={DISPATCH_TOOLTIP}
                                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] shrink-0"
                              />
                            )}
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
                        {collapsed && wired && (
                          <span className="absolute -top-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)]" />
                        )}
                        {collapsed && item.badge && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
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
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2"
              onClick={() => setSmsModalOpen(true)}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">New SMS</span>
            </Button>
            <Button 
              size="sm" 
              className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleNewCall}
            >
              <PhoneCall className="h-4 w-4" />
              <span className="hidden sm:inline">New Call</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Quick Action</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleQuickAction("log-call")}>
                  <Phone className="h-4 w-4 mr-2" />
                  Log a Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQuickAction("send-email")}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQuickAction("create-campaign")}>
                  <Zap className="h-4 w-4 mr-2" />
                  Create Campaign
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQuickAction("view-escalations")}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  View Escalations
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* System Health Bar */}
        <SystemHealthBar />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full min-h-full p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* SMS Modal */}
      <SendMessageModal 
        open={smsModalOpen} 
        onOpenChange={setSmsModalOpen}
      />
    </div>
    </CommunicationRuntimeProvider>
  );
}
