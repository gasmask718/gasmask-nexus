import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Inbox, Send, CheckCircle2, XCircle, Edit, 
  Phone, Mail, MessageSquare, Clock, User, Loader2,
  AlertTriangle, Eye
} from "lucide-react";
import { useCommunicationDrafts, CommunicationDraft, DraftStatus } from "@/hooks/useCommunicationDrafts";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { DraftReviewModal } from "./DraftReviewModal";

const STATUS_CONFIG: Record<DraftStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: <Edit className="h-3 w-3" /> },
  pending_approval: { label: "Pending", color: "bg-amber-500/20 text-amber-700", icon: <Clock className="h-3 w-3" /> },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-700", icon: <Send className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-destructive/20 text-destructive", icon: <XCircle className="h-3 w-3" /> },
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  sms: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  whatsapp: <Phone className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
};

export function DraftInbox() {
  const [activeTab, setActiveTab] = useState<"pending" | "sent" | "cancelled">("pending");
  const [selectedDraft, setSelectedDraft] = useState<CommunicationDraft | null>(null);

  const statusFilter: DraftStatus[] = 
    activeTab === "pending" ? ["draft", "pending_approval", "approved"] :
    activeTab === "sent" ? ["sent"] : ["cancelled"];

  const { 
    drafts, 
    isLoading, 
    canSend,
    approveAndSend,
    isSending,
    cancelDraft,
    isCancelling,
    refetch,
  } = useCommunicationDrafts({ status: statusFilter, limit: 100 });

  const pendingCount = drafts.filter(d => 
    ["draft", "pending_approval", "approved"].includes(d.status)
  ).length;

  const handleApproveAndSend = async (draft: CommunicationDraft) => {
    await approveAndSend(draft.id);
    setSelectedDraft(null);
    refetch();
  };

  const handleCancel = async (draft: CommunicationDraft) => {
    await cancelDraft(draft.id);
    setSelectedDraft(null);
    refetch();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Draft Inbox
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount}</Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Pending
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex items-center gap-1">
                <Send className="h-4 w-4" />
                Sent
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                Cancelled
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : drafts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No {activeTab} messages</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {drafts.map((draft) => (
                      <DraftItem
                        key={draft.id}
                        draft={draft}
                        onClick={() => setSelectedDraft(draft)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Modal */}
      {selectedDraft && (
        <DraftReviewModal
          isOpen={!!selectedDraft}
          onClose={() => setSelectedDraft(null)}
          draft={selectedDraft}
          canSend={canSend}
          onApproveAndSend={() => handleApproveAndSend(selectedDraft)}
          onCancel={() => handleCancel(selectedDraft)}
          isSending={isSending}
          isCancelling={isCancelling}
        />
      )}
    </>
  );
}

function DraftItem({ draft, onClick }: { draft: CommunicationDraft; onClick: () => void }) {
  const statusConfig = STATUS_CONFIG[draft.status];
  const hasWarnings = draft.warnings && draft.warnings.length > 0;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors",
        hasWarnings && "border-amber-500/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          {CHANNEL_ICONS[draft.channel]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">
              {draft.recipient_name || draft.recipient_phone || draft.recipient_email || "Unknown"}
            </span>
            <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
              {statusConfig.icon}
              <span className="ml-1">{statusConfig.label}</span>
            </Badge>
            {hasWarnings && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {draft.body}
          </p>

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}</span>
            {draft.entity_type && (
              <>
                <span>•</span>
                <span className="capitalize">{draft.entity_type}</span>
              </>
            )}
            {draft.edited_before_send && (
              <>
                <span>•</span>
                <span className="text-amber-600">Edited</span>
              </>
            )}
          </div>
        </div>

        <Button variant="ghost" size="icon" className="shrink-0">
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
