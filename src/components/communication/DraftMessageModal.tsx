import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, Send, Loader2, Phone, MessageSquare, Building2, 
  AlertCircle, Edit, Eye, FileText, DollarSign, Calendar,
  CheckCircle2, XCircle, Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useBusinessStore } from "@/stores/businessStore";
import { useCommunicationDrafts, DraftChannel } from "@/hooks/useCommunicationDrafts";
import { cn } from "@/lib/utils";

interface DraftMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: () => void;
  destinationPhone: string;
  entityName?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  storeId?: string;
  businessId?: string;
  channel?: DraftChannel;
  // Context for review panel
  contextData?: {
    invoiceIds?: string[];
    totalAmount?: number;
    daysOverdue?: number;
    isVip?: boolean;
    isDisputed?: boolean;
  };
}

export function DraftMessageModal({
  isOpen,
  onClose,
  onMessageSent,
  destinationPhone,
  entityName,
  entityType = "other",
  entityId,
  storeId,
  businessId,
  channel = "sms",
  contextData,
}: DraftMessageModalProps) {
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId || "");
  const [selectedSenderNumber, setSelectedSenderNumber] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const { selectedBusiness, businesses } = useBusinessStore();
  const { createDraft, isCreating, approveAndSend, isSending, canSend } = useCommunicationDrafts();

  // Fetch business phone numbers
  const { data: businessPhoneNumbers } = useQuery({
    queryKey: ["business-phone-numbers-sms", selectedBusinessId],
    queryFn: async () => {
      const query = supabase
        .from("business_phone_numbers")
        .select("id, phone_number, label, is_default, business_id, businesses(id, name)")
        .eq("is_active", true)
        .in("type", ["sms", "both"])
        .order("is_default", { ascending: false });

      if (selectedBusinessId) {
        query.eq("business_id", selectedBusinessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select business and sender number
  useEffect(() => {
    if (!selectedBusinessId && businessId) {
      setSelectedBusinessId(businessId);
    } else if (!selectedBusinessId && selectedBusiness?.id) {
      setSelectedBusinessId(selectedBusiness.id);
    }
  }, [businessId, selectedBusiness, selectedBusinessId]);

  useEffect(() => {
    if (businessPhoneNumbers && businessPhoneNumbers.length > 0) {
      const defaultNumber = businessPhoneNumbers.find(n => n.is_default);
      setSelectedSenderNumber(defaultNumber?.phone_number || businessPhoneNumbers[0].phone_number);
    }
  }, [businessPhoneNumbers]);

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  // Generate warnings based on context
  const warnings: string[] = [];
  if (contextData?.isVip) warnings.push("⭐ VIP Customer - handle with care");
  if (contextData?.isDisputed) warnings.push("⚠️ Account has active dispute");
  if (contextData?.daysOverdue && contextData.daysOverdue > 60) {
    warnings.push(`🔴 ${contextData.daysOverdue} days overdue - consider escalation`);
  }

  const handleSaveDraft = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    try {
      await createDraft({
        channel,
        body: message.trim(),
        subject: channel === "email" ? subject : undefined,
        recipient_phone: destinationPhone,
        recipient_name: entityName,
        entity_type: entityType,
        entity_id: entityId,
        business_id: selectedBusinessId || undefined,
        store_id: storeId,
        from_number: selectedSenderNumber,
        context_data: contextData as any || {},
        warnings,
        invoice_ids: contextData?.invoiceIds,
      });

      toast.success("Draft saved! You can review and send it later.");
      setMessage("");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to save draft");
    }
  };

  const handleApproveAndSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!selectedSenderNumber) {
      toast.error("No sender number configured");
      return;
    }

    try {
      // Create draft first
      const draft = await createDraft({
        channel,
        body: message.trim(),
        subject: channel === "email" ? subject : undefined,
        recipient_phone: destinationPhone,
        recipient_name: entityName,
        entity_type: entityType,
        entity_id: entityId,
        business_id: selectedBusinessId || undefined,
        store_id: storeId,
        from_number: selectedSenderNumber,
        context_data: contextData as any || {},
        warnings,
        invoice_ids: contextData?.invoiceIds,
      });

      // Then approve and send
      await approveAndSend(draft.id);

      setMessage("");
      onMessageSent?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    }
  };

  const hasNoSenderNumbers = businessPhoneNumbers && businessPhoneNumbers.length === 0;
  const isPending = isCreating || isSending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Compose Message
            <Badge variant="outline" className="ml-2">Draft Mode</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "edit" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("edit")}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant={mode === "preview" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("preview")}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-none space-y-1">
                  {warnings.map((w, i) => (
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
              <p className="font-medium">{entityName || "Unknown"}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatPhoneDisplay(destinationPhone)}
              </p>
            </div>
            <Badge variant="secondary" className="capitalize">{entityType}</Badge>
          </div>

          {/* Context Panel */}
          {contextData && (contextData.totalAmount || contextData.invoiceIds?.length) && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-xs font-medium text-muted-foreground mb-2">CONTEXT</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {contextData.totalAmount && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${contextData.totalAmount.toLocaleString()}</span>
                  </div>
                )}
                {contextData.invoiceIds && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{contextData.invoiceIds.length} invoice(s)</span>
                  </div>
                )}
                {contextData.daysOverdue && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(
                      contextData.daysOverdue > 30 ? "text-destructive" : "text-amber-600"
                    )}>
                      {contextData.daysOverdue} days overdue
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "edit" ? (
            <>
              {/* Business Selector */}
              {businesses.length > 1 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    Sending From Business
                  </Label>
                  <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business..." />
                    </SelectTrigger>
                    <SelectContent>
                      {businesses.map((biz) => (
                        <SelectItem key={biz.id} value={biz.id}>
                          {biz.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sender Number */}
              {hasNoSenderNumbers ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No messaging number configured for this business</AlertDescription>
                </Alert>
              ) : businessPhoneNumbers && businessPhoneNumbers.length > 1 ? (
                <div className="space-y-2">
                  <Label>From Number</Label>
                  <Select value={selectedSenderNumber} onValueChange={setSelectedSenderNumber}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {businessPhoneNumbers.map((num) => (
                        <SelectItem key={num.id} value={num.phone_number}>
                          {formatPhoneDisplay(num.phone_number)}
                          {num.label && ` (${num.label})`}
                          {num.is_default && " ★"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : selectedSenderNumber && (
                <div className="text-sm text-muted-foreground">
                  Sending from: <span className="font-medium">{formatPhoneDisplay(selectedSenderNumber)}</span>
                </div>
              )}

              {/* Subject (for email) */}
              {channel === "email" && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Email subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              )}

              {/* Message Input */}
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message... You can edit everything before sending."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="resize-none font-mono text-sm"
                  maxLength={1600}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{message.length} / 160 per segment</span>
                  <span>{Math.ceil(message.length / 160) || 1} segment(s)</span>
                </div>
              </div>
            </>
          ) : (
            /* Preview Mode */
            <div className="space-y-4">
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">MESSAGE PREVIEW</p>
                <p className="whitespace-pre-wrap">{message || "(No message entered)"}</p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium mb-2">Before sending, verify:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✓ Recipient name and phone are correct</li>
                  <li>✓ Message content is accurate</li>
                  <li>✓ Amounts and dates match invoices</li>
                  <li>✓ Tone is appropriate for the situation</li>
                </ul>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isPending || !message.trim()}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>

              {canSend ? (
                <Button
                  onClick={handleApproveAndSend}
                  disabled={isPending || !message.trim() || hasNoSenderNumbers}
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
                  Approval Required
                </Button>
              )}
            </div>
          </div>

          {!canSend && (
            <p className="text-xs text-center text-muted-foreground">
              You don't have permission to send messages. Save as draft for an admin to approve.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
