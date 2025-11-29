import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { ChatWindow } from "@/components/messaging/ChatWindow";

export default function StoreMessages() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const [selectedThread, setSelectedThread] = useState<string | undefined>(threadId);

  const handleSelectThread = (id: string) => {
    setSelectedThread(id);
    navigate(`/portal/store/messages/${id}`);
  };

  const handleBack = () => {
    setSelectedThread(undefined);
    navigate('/portal/store/messages');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-screen flex">
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-1">
          <div className="w-96 border-r h-full">
            <MessagingInbox
              onSelectThread={handleSelectThread}
              selectedThreadId={selectedThread}
              threadTypeFilter="store_wholesaler"
            />
          </div>
          <div className="flex-1 h-full">
            {selectedThread ? (
              <ChatWindow threadId={selectedThread} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="text-6xl mb-4">🏪</div>
                  <h2 className="text-xl font-semibold mb-2">Store Messages</h2>
                  <p>Contact wholesalers and support</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden flex-1 h-full">
          {selectedThread ? (
            <ChatWindow threadId={selectedThread} onBack={handleBack} />
          ) : (
            <MessagingInbox
              onSelectThread={handleSelectThread}
              threadTypeFilter="store_wholesaler"
            />
          )}
        </div>
      </div>
    </div>
  );
}
