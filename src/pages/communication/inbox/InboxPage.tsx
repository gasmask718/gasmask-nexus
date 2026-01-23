import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ContactsPanel } from "@/components/communication/inbox/ContactsPanel";
import { ConversationPanel } from "@/components/communication/inbox/ConversationPanel";
import { Users, PanelRightClose, PanelRight } from "lucide-react";

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
    </div>
  );
}
