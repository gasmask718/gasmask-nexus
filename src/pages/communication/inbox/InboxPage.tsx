import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCommunicationCenter } from "@/hooks/useCommunicationCenter";
import { UnifiedInbox } from "@/components/communication/UnifiedInbox";
import { ContactsPanel } from "@/components/communication/inbox/ContactsPanel";
import { NewMessageModal } from "@/components/communication/inbox/NewMessageModal";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: string;
  source: string;
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedReply, setSuggestedReply] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);

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

  const businessIdFilter = selectedBusinessId === "all" ? undefined : selectedBusinessId;

  const {
    messages,
    sendMessage,
    isSending,
    suggestReply,
    isSuggestingReply,
    rewriteBrandTone,
    isRewriting,
  } = useCommunicationCenter(businessIdFilter);

  const handleSuggestReply = async () => {
    if (!selectedMessage) return;
    const brand = businesses.find(b => b.id === selectedMessage.business_id);
    try {
      const result = await suggestReply({
        brandName: brand?.name || "Your Brand",
        storeName: selectedMessage.store?.store_name || "Store",
        previousMessage: selectedMessage.content || "",
        context: "General follow-up",
      });
      setSuggestedReply(result);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRewriteTone = async (content: string) => {
    const brand = businesses.find(b => b.id === selectedMessage?.business_id);
    try {
      const result = await rewriteBrandTone({
        brandName: brand?.name || "Your Brand",
        message: content,
      });
      setSuggestedReply(result);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSendReply = async (content: string) => {
    if (!selectedMessage) return;
    
    try {
      // Use edge function to send real SMS
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: selectedMessage.phone_number,
          message: content,
          business_id: selectedMessage.business_id,
          store_id: selectedMessage.store_id,
          contact_id: selectedMessage.contact_id,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success("Message sent successfully");
        queryClient.invalidateQueries({ queryKey: ["communication-messages"] });
      } else {
        throw new Error(data?.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error("Error sending SMS:", error);
      toast.error(error.message || "Failed to send message");
    }
    
    setSuggestedReply("");
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setShowNewMessageModal(true);
  };

  const handleMessageSent = () => {
    queryClient.invalidateQueries({ queryKey: ["communication-messages"] });
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Unified Inbox</h2>
        <div className="flex items-center gap-3">
          <Button
            variant={showContacts ? "default" : "outline"}
            onClick={() => setShowContacts(!showContacts)}
          >
            <Users className="h-4 w-4 mr-2" />
            Contacts
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

      <div className={`grid gap-4 ${showContacts ? "grid-cols-1 lg:grid-cols-4" : "grid-cols-1"}`}>
        {showContacts && (
          <div className="lg:col-span-1">
            <ContactsPanel onSelectContact={handleSelectContact} />
          </div>
        )}
        <div className={showContacts ? "lg:col-span-3" : ""}>
          <UnifiedInbox
            messages={messages}
            selectedMessage={selectedMessage}
            onSelectMessage={(msg) => {
              setSelectedMessage(msg);
              setSuggestedReply("");
            }}
            onSendReply={handleSendReply}
            onSuggestReply={handleSuggestReply}
            onRewriteTone={handleRewriteTone}
            isSending={isSending}
            isSuggesting={isSuggestingReply || isRewriting}
            suggestedReply={suggestedReply}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
      </div>

      <NewMessageModal
        open={showNewMessageModal}
        onOpenChange={setShowNewMessageModal}
        contact={selectedContact}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
}
