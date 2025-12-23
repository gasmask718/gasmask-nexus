import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Inbox,
  Mail,
  MailWarning,
  AlertTriangle,
  Star,
  Clock,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type InboxView = "all" | "unread" | "needs_reply" | "escalated" | "high_value" | "at_risk";

interface InboxFiltersProps {
  activeView: InboxView;
  onViewChange: (view: InboxView) => void;
  filters: {
    status: string[];
    priority: string[];
    channel: string[];
  };
  onFiltersChange: (filters: { status: string[]; priority: string[]; channel: string[] }) => void;
  counts?: {
    all?: number;
    unread?: number;
    needs_reply?: number;
    escalated?: number;
    high_value?: number;
    at_risk?: number;
  };
}

const INBOX_VIEWS = [
  { id: "all" as InboxView, label: "All", icon: Inbox },
  { id: "unread" as InboxView, label: "Unread", icon: Mail },
  { id: "needs_reply" as InboxView, label: "Needs Reply", icon: MailWarning },
  { id: "escalated" as InboxView, label: "Escalated", icon: AlertTriangle },
  { id: "high_value" as InboxView, label: "High Value", icon: Star },
  { id: "at_risk" as InboxView, label: "At Risk", icon: Clock },
];

const STATUS_OPTIONS = ["open", "in_progress", "waiting", "resolved", "escalated", "snoozed"];
const PRIORITY_OPTIONS = ["urgent", "high", "normal", "low"];
const CHANNEL_OPTIONS = ["sms", "email", "call", "chat"];

export function InboxFilters({
  activeView,
  onViewChange,
  filters,
  onFiltersChange,
  counts = {},
}: InboxFiltersProps) {
  const hasActiveFilters =
    filters.status.length > 0 || filters.priority.length > 0 || filters.channel.length > 0;

  const toggleFilter = (
    type: "status" | "priority" | "channel",
    value: string
  ) => {
    const current = filters[type];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [type]: updated });
  };

  const clearFilters = () => {
    onFiltersChange({ status: [], priority: [], channel: [] });
  };

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {INBOX_VIEWS.map((view) => {
          const Icon = view.icon;
          const count = counts[view.id];
          return (
            <Button
              key={view.id}
              variant={activeView === view.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange(view.id)}
              className={cn(
                "flex-shrink-0",
                activeView === view.id && "shadow-sm"
              )}
            >
              <Icon className="h-4 w-4 mr-1.5" />
              {view.label}
              {count !== undefined && count > 0 && (
                <Badge
                  variant={activeView === view.id ? "secondary" : "outline"}
                  className="ml-1.5 h-5 px-1.5 text-xs"
                >
                  {count > 99 ? "99+" : count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Filter Dropdowns */}
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1.5" />
              Status
              {filters.status.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {filters.status.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={filters.status.includes(status)}
                onCheckedChange={() => toggleFilter("status", status)}
              >
                <span className="capitalize">{status.replace("_", " ")}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1.5" />
              Priority
              {filters.priority.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {filters.priority.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PRIORITY_OPTIONS.map((priority) => (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={filters.priority.includes(priority)}
                onCheckedChange={() => toggleFilter("priority", priority)}
              >
                <span className="capitalize">{priority}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1.5" />
              Channel
              {filters.channel.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {filters.channel.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Channel</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CHANNEL_OPTIONS.map((channel) => (
              <DropdownMenuCheckboxItem
                key={channel}
                checked={filters.channel.includes(channel)}
                onCheckedChange={() => toggleFilter("channel", channel)}
              >
                <span className="uppercase">{channel}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1.5" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
