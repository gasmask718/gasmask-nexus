import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContactsPanel } from "@/components/communication/inbox/ContactsPanel";
import { ConversationPanel } from "@/components/communication/inbox/ConversationPanel";
import { Users, PanelRightClose, PanelRight, Plus, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: string;
  source: string;
}

export default function InboxPage() {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContacts, setShowContacts] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendManual = async () => {
    const digits = manualPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (!manualMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: manualPhone,
          message_body: manualMessage.trim(),
          idempotency_key: crypto.randomUUID(),
          metadata: { contact_name: "Manual" },
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Message sent!");
        setManualPhone("");
        setManualMessage("");
        setShowNewMessage(false);
      } else {
        throw new Error(data?.error || "Failed to send");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const { data: businesses = [] } = useQuery({
    queryKey: ["businesses-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, primary_color")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleBack = () => {
    setSelectedContact(null);
  };

  return (
    <div className="w-full h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold">Unified Inbox</h2>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowNewMessage(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Message
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowContacts(!showContacts)}
            className="hidden md:flex"
          >
            {showContacts ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>
          <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Businesses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Businesses</SelectItem>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 gap-4 overflow-hidden">
        {showContacts && (
          <div className="w-80 flex-shrink-0">
            <ContactsPanel 
              onSelectContact={handleSelectContact}
              selectedContactId={selectedContact?.id}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <ConversationPanel contact={selectedContact} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex-1 overflow-hidden">
        {selectedContact ? (
          <ConversationPanel contact={selectedContact} onBack={handleBack} />
        ) : (
          <ContactsPanel 
            onSelectContact={handleSelectContact}
          />
        )}
      </div>

      {/* New Manual Message Dialog */}
      <Dialog open={showNewMessage} onOpenChange={setShowNewMessage}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-phone">Phone Number</Label>
              <Input
                id="manual-phone"
                placeholder="(555) 555-1234"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                type="tel"
              />
              <p className="text-xs text-muted-foreground">Enter a 10-digit US phone number</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-msg">Message</Label>
              <Textarea
                id="manual-msg"
                placeholder="Type your message..."
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{manualMessage.length} / 160</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewMessage(false)}>Cancel</Button>
              <Button onClick={handleSendManual} disabled={isSending || !manualMessage.trim()}>
                {isSending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-1" />Send SMS</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
