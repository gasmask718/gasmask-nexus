import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommunicationCenter } from "@/hooks/useCommunicationCenter";
import { UnifiedInbox } from "@/components/communication/UnifiedInbox";

export default function InboxPage() {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedReply, setSuggestedReply] = useState("");

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
    await sendMessage({
      business_id: selectedMessage.business_id,
      store_id: selectedMessage.store_id,
      contact_id: selectedMessage.contact_id,
      channel: "sms",
      content,
      phone_number: selectedMessage.phone_number,
    });
    setSuggestedReply("");
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Unified Inbox</h2>
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
  );
}
