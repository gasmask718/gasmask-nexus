import { useState } from "react";
import CommSystemsLayout from "../CommSystemsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  MessageSquare,
  Search,
  Send,
  Bot,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Building,
  Clock,
  Filter,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  Tag,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCommBusinessContext } from "@/components/comm-systems/GlobalBusinessFilter";
import {
  InboxFilters,
  InboxView,
} from "@/components/comm-systems/InboxFilters";
import {
  ThreadDetailPanel,
} from "@/components/comm-systems/ThreadDetailPanel";
import {
  WorkOwnershipActions,
  PriorityBadge,
  StatusBadge,
  SLATimer,
} from "@/components/comm-systems/WorkOwnershipActions";
import { WorkItem } from "@/hooks/useWorkOwnership";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { context } = useCommBusinessContext();
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<InboxView>("all");
  const [filters, setFilters] = useState({
    status: [] as string[],
    priority: [] as string[],
    channel: [] as string[],
  });
  const [selectedMessage, setSelectedMessage] = useState<WorkItem | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["comm-messages", context.businessId, activeView, filters],
    queryFn: async () => {
      let query = supabase
        .from("communication_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (context.businessId) {
        query = query.eq("business_id", context.businessId);
      }

      // Apply view filters
      if (activeView === "unread") {
        query = query.eq("status", "open");
      } else if (activeView === "needs_reply") {
        query = query.eq("direction", "inbound").eq("status", "open");
      } else if (activeView === "escalated") {
        query = query.eq("status", "escalated");
      } else if (activeView === "high_value") {
        query = query.in("priority", ["urgent", "high"]);
      }

      // Apply custom filters
      if (filters.status.length > 0) {
        query = query.in("status", filters.status);
      }
      if (filters.priority.length > 0) {
        query = query.in("priority", filters.priority);
      }
      if (filters.channel.length > 0) {
        query = query.in("channel", filters.channel);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as WorkItem[];
    },
  });

  const filtered = messages?.filter(
    (m) =>
      m.phone_number?.includes(search) ||
      m.content?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    all: messages?.length || 0,
    unread: messages?.filter((m) => m.status === "open").length || 0,
    needs_reply: messages?.filter((m) => m.direction === "inbound" && m.status === "open").length || 0,
    escalated: messages?.filter((m) => m.status === "escalated").length || 0,
    high_value: messages?.filter((m) => m.priority === "urgent" || m.priority === "high").length || 0,
    at_risk: messages?.filter((m) => m.sla_deadline && new Date(m.sla_deadline) < new Date()).length || 0,
  };

  return (
    <CommSystemsLayout
      title="Messages"
      subtitle="Execute and log SMS conversations"
    >
      {/* Inbox Filters */}
      <InboxFilters
        activeView={activeView}
        onViewChange={setActiveView}
        filters={filters}
        onFiltersChange={setFilters}
        counts={counts}
      />

      {/* Search and Actions */}
      <div className="flex gap-4 my-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button>
          <Send className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center">Loading...</CardContent>
          </Card>
        ) : filtered?.length ? (
          filtered.map((msg) => (
            <Card
              key={msg.id}
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                selectedMessage?.id === msg.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedMessage(msg)}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Direction Icon */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      msg.direction === "inbound"
                        ? "bg-green-100 text-green-600"
                        : "bg-blue-100 text-blue-600"
                    )}
                  >
                    {msg.direction === "inbound" ? (
                      <ArrowDownLeft className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">
                        {msg.phone_number || "Unknown"}
                      </span>
                      {msg.actor_type === "ai" && (
                        <Badge variant="secondary" className="text-xs">
                          <Bot className="h-3 w-3 mr-1" />
                          AI
                        </Badge>
                      )}
                      <StatusBadge status={msg.status} />
                      <PriorityBadge priority={msg.priority} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {msg.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {msg.business_id && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {msg.business_id.slice(0, 8)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(msg.created_at), "MMM d, h:mm a")}
                      </span>
                      {msg.owner_user_id && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Assigned
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SLA & Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <SLATimer deadline={msg.sla_deadline} />
                    {msg.escalation_level && msg.escalation_level > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Escalated
                      </Badge>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <WorkOwnershipActions item={msg} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Thread Detail Sheet */}
      <Sheet
        open={!!selectedMessage}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
      >
        <SheetContent className="w-full sm:max-w-xl p-0">
          {selectedMessage && (
            <ThreadDetailPanel
              item={selectedMessage}
              onSendMessage={(content) => {
                console.log("Send:", content);
              }}
              onClose={() => setSelectedMessage(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </CommSystemsLayout>
  );
}
