import { Card } from "@/components/ui/card";
import { 
  Inbox, Phone, MessageSquare, Clock, AlertTriangle, 
  Handshake, Zap, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InboxStats {
  total: number;
  requiresAction: number;
  calls: number;
  sms: number;
  followUps: number;
  alerts: number;
  negotiations: number;
  highPriority: number;
}

interface InboxStatsBannerProps {
  stats: InboxStats;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function InboxStatsBanner({ stats, activeTab, onTabChange }: InboxStatsBannerProps) {
  const tabs = [
    { id: "all", label: "All", icon: Inbox, count: stats.total, color: "text-foreground" },
    { id: "calls", label: "Calls", icon: Phone, count: stats.calls, color: "text-green-500" },
    { id: "sms", label: "SMS", icon: MessageSquare, count: stats.sms, color: "text-blue-500" },
    { id: "follow-ups", label: "Follow-ups", icon: Clock, count: stats.followUps, color: "text-amber-500" },
    { id: "alerts", label: "Alerts", icon: AlertTriangle, count: stats.alerts, color: "text-red-500" },
    { id: "negotiations", label: "Deals", icon: Handshake, count: stats.negotiations, color: "text-indigo-500" },
    { id: "action-needed", label: "Action Needed", icon: Zap, count: stats.requiresAction, color: "text-orange-500" },
    { id: "high-priority", label: "High Priority", icon: TrendingUp, count: stats.highPriority, color: "text-red-600" },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap",
            activeTab === tab.id
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card hover:bg-muted border-border"
          )}
        >
          <tab.icon className={cn("h-4 w-4", activeTab !== tab.id && tab.color)} />
          <span className="text-sm font-medium">{tab.label}</span>
          <span className={cn(
            "text-xs font-bold rounded-full px-2 py-0.5",
            activeTab === tab.id
              ? "bg-primary-foreground/20"
              : "bg-muted"
          )}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
