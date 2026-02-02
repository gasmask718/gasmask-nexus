import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Send, Loader2, Phone, MessageSquare, 
  AlertCircle, Edit, Eye, CheckCircle2, XCircle,
  User, Calendar, FileText, History
} from "lucide-react";
import { CommunicationDraft } from "@/hooks/useCommunicationDrafts";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface DraftReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: CommunicationDraft;
  canSend: boolean;
  onApproveAndSend: () => void;
  onCancel: () => void;
  isSending: boolean;
  isCancelling: boolean;
}

export function DraftReviewModal({
  isOpen,
  onClose,
  draft,
  canSend,
  onApproveAndSend,
  onCancel,
  isSending,
  isCancelling,
}: DraftReviewModalProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [editedBody, setEditedBody] = useState(draft.body);

  const isEdited = editedBody !== draft.body;
  const isPending = isSending || isCancelling;
  const isSent = draft.status === "sent";
  const isCancelled = draft.status === "cancelled";
  const isActionable = !isSent && !isCancelled;

  const formatPhoneDisplay = (phone: string | null) => {
    if (!phone) return "N/A";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Review Message
            </DialogTitle>
            <Badge 
              variant={
                draft.status === "sent" ? "default" :
                draft.status === "cancelled" ? "destructive" :
                "secondary"
              }
              className="capitalize"
            >
              {draft.status.replace("_", " ")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warnings */}
          {draft.warnings && draft.warnings.length > 0 && (
            <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-none space-y-1">
                  {draft.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Recipient Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{draft.recipient_name || "Unknown"}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatPhoneDisplay(draft.recipient_phone)}
              </p>
            </div>
            <Badge variant="secondary" className="capitalize">{draft.entity_type || "other"}</Badge>
          </div>

          {/* Context Data */}
          {draft.context_data && Object.keys(draft.context_data).length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-xs font-medium text-muted-foreground mb-2">CONTEXT</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(draft.context_data as any).totalAmount && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-medium">${(draft.context_data as any).totalAmount.toLocaleString()}</span>
                  </div>
                )}
                {(draft.context_data as any).daysOverdue && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Days Overdue:</span>
                    <span className={cn(
                      "font-medium",
                      (draft.context_data as any).daysOverdue > 30 && "text-destructive"
                    )}>
                      {(draft.context_data as any).daysOverdue}
                    </span>
                  </div>
                )}
                {draft.invoice_ids && draft.invoice_ids.length > 0 && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{draft.invoice_ids.length} invoice(s)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode Toggle */}
          {isActionable && (
            <div className="flex gap-2">
              <Button
                variant={mode === "preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("preview")}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                variant={mode === "edit" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("edit")}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          )}

          {/* Message Content */}
          {mode === "preview" || !isActionable ? (
            <div className="p-4 bg-card border rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">MESSAGE</p>
              <p className="whitespace-pre-wrap">{editedBody}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Edit Message</Label>
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{editedBody.length} characters</span>
                {isEdited && <span className="text-amber-600">Edited</span>}
              </div>
            </div>
          )}

          {/* Audit Trail */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <div className="flex items-center gap-1 mb-2">
              <History className="h-3 w-3" />
              <span className="font-medium">Audit Trail</span>
            </div>
            <div className="space-y-1">
              <p>Created: {format(new Date(draft.created_at), "MMM d, yyyy h:mm a")}</p>
              {draft.edited_before_send && (
                <p className="text-amber-600">Edited before send</p>
              )}
              {draft.approved_at && (
                <p>Approved: {format(new Date(draft.approved_at), "MMM d, yyyy h:mm a")}</p>
              )}
              {draft.sent_at && (
                <p>Sent: {format(new Date(draft.sent_at), "MMM d, yyyy h:mm a")}</p>
              )}
              {draft.cancelled_at && (
                <p>Cancelled: {format(new Date(draft.cancelled_at), "MMM d, yyyy h:mm a")}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              Close
            </Button>

            {isActionable && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Discard
                </Button>

                {canSend ? (
                  <Button
                    onClick={onApproveAndSend}
                    disabled={isPending || !editedBody.trim()}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve & Send
                      </>
                    )}
                  </Button>
                ) : (
                  <Button disabled variant="secondary">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Needs Admin Approval
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
