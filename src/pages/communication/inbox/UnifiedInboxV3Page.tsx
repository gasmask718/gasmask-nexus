import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, MessageSquare, Mail, Plus, RefreshCw, 
  PanelRightClose, PanelRight, Clock, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  useUnifiedInbox, 
  useInboxBusinesses, 
  useInboxVerticals,
  InboxFilters,
  UnifiedInboxItem 
} from "@/hooks/useUnifiedInbox";
import { 
  InboxItemCard, 
  InboxDetailsPanel, 
  InboxFiltersBar, 
  InboxStatsBanner 
} from "@/components/communication/inbox";

export default function UnifiedInboxV3Page() {
  const [selectedItem, setSelectedItem] = useState<UnifiedInboxItem | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [filters, setFilters] = useState<InboxFilters>({
    businessId: "all",
    channel: "all",
    direction: "all",
    sentiment: "all",
    priority: "all",
    requiresAction: "all",
    dateRange: "7days",
    searchTerm: "",
    type: "all",
  });

  // Apply tab as a type filter
  const effectiveFilters = useMemo(() => {
    const tabFilters: Partial<InboxFilters> = {};
    
    switch (activeTab) {
      case "calls":
        tabFilters.type = "call";
        break;
      case "sms":
        tabFilters.type = "sms";
        break;
      case "follow-ups":
        tabFilters.type = "follow-up";
        break;
      case "alerts":
        tabFilters.type = "alert";
        break;
      case "negotiations":
        tabFilters.type = "negotiation";
        break;
      case "action-needed":
        tabFilters.requiresAction = true;
        break;
      case "high-priority":
        tabFilters.priority = "high";
        break;
    }
    
    return { ...filters, ...tabFilters };
  }, [filters, activeTab]);

  const { items, isLoading, stats, markReviewed, refetch } = useUnifiedInbox(effectiveFilters);
  const { data: businesses = [] } = useInboxBusinesses();
  const { data: verticals = [] } = useInboxVerticals();

  const handleSelectItem = (item: UnifiedInboxItem) => {
    setSelectedItem(item);
    if (!showDetailsPanel) {
      setShowDetailsPanel(true);
    }
  };

  const handleMarkReviewed = (id: string, type: string) => {
    markReviewed({ id, type: type as any });
    setSelectedItem(null);
  };

  return (
    <div className="w-full h-[calc(100vh-120px)] flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unified Inbox</h1>
          <p className="text-sm text-muted-foreground">
            All communications across all businesses in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Phone className="h-4 w-4" />
            New Call
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            New Text
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="h-4 w-4" />
            New Email
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Clock className="h-4 w-4" />
            Create Follow-Up
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowDetailsPanel(!showDetailsPanel)}
          >
            {showDetailsPanel ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Stats Tabs */}
      <InboxStatsBanner 
        stats={stats} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* Filters */}
      <InboxFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        businesses={businesses}
        verticals={verticals.map(v => ({ ...v, business_id: "" }))}
        onRefresh={refetch}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <div className={cn(
        "flex-1 grid gap-4 overflow-hidden",
        showDetailsPanel ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1"
      )}>
        {/* Messages List */}
        <Card className={cn(
          "overflow-hidden flex flex-col",
          showDetailsPanel ? "lg:col-span-2" : "lg:col-span-5"
        )}>
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {items.length} items
              </span>
              {isLoading && (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Live
            </Badge>
          </div>
          <ScrollArea className="flex-1">
            {items.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No items found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div>
                {items.map((item) => (
                  <InboxItemCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    isSelected={selectedItem?.id === item.id && selectedItem?.type === item.type}
                    onClick={() => handleSelectItem(item)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Details Panel */}
        {showDetailsPanel && (
          <Card className="lg:col-span-3 overflow-hidden">
            <InboxDetailsPanel
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onMarkReviewed={handleMarkReviewed}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
