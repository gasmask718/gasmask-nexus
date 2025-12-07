import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Store, Users, ClipboardList, BarChart3, 
  Lightbulb, Settings 
} from "lucide-react";

interface BrandCRMNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: {
    stores: number;
    contacts: number;
    tasks: number;
  };
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "stores", label: "Stores", icon: Store, countKey: "stores" },
  { id: "contacts", label: "Contacts", icon: Users, countKey: "contacts" },
  { id: "tasks", label: "Tasks", icon: ClipboardList, countKey: "tasks" },
  { id: "insights", label: "Insights", icon: BarChart3 },
];

export function BrandCRMNav({ activeTab, onTabChange, counts }: BrandCRMNavProps) {
  return (
    <nav className="w-56 shrink-0 border-r bg-card">
      <div className="p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const count = item.countKey ? counts[item.countKey as keyof typeof counts] : null;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === item.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {count !== null && count > 0 && (
                <span 
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-semibold",
                    activeTab === item.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted-foreground/10 text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
