import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Send, Loader2, Phone, MessageSquare, Building2, AlertCircle } from "lucide-react";
import { SmsProviderSelect } from "@/components/communication/SmsProviderSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useBusinessStore } from "@/stores/businessStore";

interface InternalMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageSent: () => void;
  destinationPhone: string;
  entityName?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  storeId?: string;
  businessId?: string;
  channel?: "sms" | "whatsapp";
}

export function InternalMessageModal({
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
}: InternalMessageModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId || "");
  const [selectedProvider, setSelectedProvider] = useState("default");
  const [selectedSenderNumber, setSelectedSenderNumber] = useState("");

  const { selectedBusiness, businesses } = useBusinessStore();

  // Fetch business phone numbers for sender selection
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
      // Auto-select default or first number
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

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!selectedSenderNumber) {
      toast.error("No sender number configured for this business");
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: destinationPhone,
          message_body: message.trim(),
          // Operator-to-operator/staff message → workforce class.
          send_class: "workforce",
          idempotency_key: crypto.randomUUID(),
          explicit_provider: selectedProvider === "default" ? undefined : selectedProvider,
          skip_cooldown: true,
          store_id: storeId || null,
          metadata: {
            business_id: selectedBusinessId || null,
            contact_id: entityId || null,
            contact_name: entityName || null,
            from_number: selectedSenderNumber,
            initiated_by: user?.id,
            source_ui: "internal_message_modal",
          },
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Message sent to ${entityName || formatPhoneDisplay(destinationPhone)}`);
        setMessage("");
        onMessageSent();
      } else {
        throw new Error(data?.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error("Error sending SMS:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const hasNoSenderNumbers = businessPhoneNumbers && businessPhoneNumbers.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">No messaging number configured for this business</span>
            </div>
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

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
              maxLength={1600}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{message.length} / 160 per segment</span>
              <span>{Math.ceil(message.length / 160) || 1} segment(s)</span>
            </div>
          </div>

          {/* Provider Selector */}
          <SmsProviderSelect value={selectedProvider} onChange={setSelectedProvider} />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={isSending || !message.trim() || hasNoSenderNumbers}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
