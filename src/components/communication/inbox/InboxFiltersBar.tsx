import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Filter, X, Download, RefreshCw, Phone, MessageSquare,
  Mail, Clock, AlertTriangle, Handshake
} from "lucide-react";
import { InboxFilters, InboxItemType, InboxChannel, InboxSentiment, InboxPriority } from "@/hooks/useUnifiedInbox";

interface InboxFiltersBarProps {
  filters: InboxFilters;
  onFiltersChange: (filters: InboxFilters) => void;
  businesses: { id: string; name: string; primary_color: string }[];
  verticals: { id: string; name: string; business_id: string }[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function InboxFiltersBar({
  filters,
  onFiltersChange,
  businesses,
  verticals,
  onRefresh,
  isLoading,
}: InboxFiltersBarProps) {
  const updateFilter = <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      businessId: "all",
      verticalId: undefined,
      channel: "all",
      direction: "all",
      sentiment: "all",
      priority: "all",
      requiresAction: "all",
      dateRange: "7days",
      searchTerm: "",
      type: "all",
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "searchTerm") return value && value.length > 0;
    return value && value !== "all" && value !== "7days" && value !== undefined;
  }).length;

  return (
    <div className="space-y-3">
      {/* Top Row: Search + Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages, stores, phone numbers..."
            value={filters.searchTerm || ""}
            onChange={(e) => updateFilter("searchTerm", e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Button 
          variant="outline" 
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Clear ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Business Filter */}
        <Select
          value={filters.businessId || "all"}
          onValueChange={(value) => updateFilter("businessId", value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Businesses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Businesses</SelectItem>
            {businesses.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: b.primary_color }}
                  />
                  {b.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select
          value={filters.type || "all"}
          onValueChange={(value) => updateFilter("type", value as InboxItemType | "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="call">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Calls
              </div>
            </SelectItem>
            <SelectItem value="sms">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> SMS
              </div>
            </SelectItem>
            <SelectItem value="email">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email
              </div>
            </SelectItem>
            <SelectItem value="follow-up">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Follow-ups
              </div>
            </SelectItem>
            <SelectItem value="alert">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alerts
              </div>
            </SelectItem>
            <SelectItem value="negotiation">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4" /> Negotiations
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Channel Filter */}
        <Select
          value={filters.channel || "all"}
          onValueChange={(value) => updateFilter("channel", value as InboxChannel | "all")}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="voice">Voice</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="ai">AI Only</SelectItem>
            <SelectItem value="manual">Manual Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Direction Filter */}
        <Select
          value={filters.direction || "all"}
          onValueChange={(value) => updateFilter("direction", value as "inbound" | "outbound" | "all")}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>

        {/* Sentiment Filter */}
        <Select
          value={filters.sentiment || "all"}
          onValueChange={(value) => updateFilter("sentiment", value as InboxSentiment | "all")}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiment</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select
          value={filters.priority || "all"}
          onValueChange={(value) => updateFilter("priority", value as InboxPriority | "all")}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Needed Filter */}
        <Select
          value={filters.requiresAction === true ? "yes" : filters.requiresAction === false ? "no" : "all"}
          onValueChange={(value) => updateFilter("requiresAction", value === "yes" ? true : value === "no" ? false : "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Action Needed" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="yes">Needs Action</SelectItem>
            <SelectItem value="no">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Select
          value={filters.dateRange || "7days"}
          onValueChange={(value) => updateFilter("dateRange", value as "today" | "7days" | "30days" | "custom")}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
