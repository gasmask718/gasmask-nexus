import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SmsProviderSelect } from "@/components/communication/SmsProviderSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: string;
  source: string;
}

interface NewMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onMessageSent: () => void;
}

export function NewMessageModal({ open, onOpenChange, contact, onMessageSent }: NewMessageModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("default");

  const handleSend = async () => {
    if (!contact || !message.trim()) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: contact.phone,
          message_body: message.trim(),
          // Human-composed 1:1 message from the inbox → conversational.
          send_class: "conversational",
          idempotency_key: crypto.randomUUID(),
          explicit_provider: selectedProvider === "default" ? undefined : selectedProvider,
          skip_cooldown: true,
          metadata: { contact_id: contact.id, contact_name: contact.name },
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Message sent to ${contact.name}`);
        setMessage("");
        onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
        </DialogHeader>
        
        {contact && (
          <div className="space-y-4">
            {/* Contact Info */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{contact.name}</p>
                <p className="text-sm text-muted-foreground">{contact.phone}</p>
              </div>
              <Badge variant="secondary">{contact.type}</Badge>
            </div>

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
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length} / 160 characters
              </p>
            </div>

            {/* Provider Selector */}
            <SmsProviderSelect value={selectedProvider} onChange={setSelectedProvider} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSend} 
                disabled={isSending || !message.trim()}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
