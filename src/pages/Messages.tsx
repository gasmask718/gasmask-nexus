import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { ChatWindow } from "@/components/messaging/ChatWindow";
import { useAuth } from "@/contexts/AuthContext";

export default function Messages() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [selectedThread, setSelectedThread] = useState<string | undefined>(threadId);

  const handleSelectThread = (id: string) => {
    setSelectedThread(id);
    navigate(`/messages/${id}`);
  };

  const handleBack = () => {
    setSelectedThread(undefined);
    navigate('/messages');
  };

  // Determine thread type filter based on user role
  const getThreadTypeFilter = () => {
    switch (userRole) {
      case 'store':
      case 'store_owner':
        return 'store_wholesaler';
      case 'wholesaler':
        return 'store_wholesaler';
      case 'driver':
        return 'driver_dispatch';
      case 'biker':
        return 'biker_dispatch';
      case 'ambassador':
        return 'ambassador_support';
      case 'production':
        return 'production_hq';
      default:
        return undefined;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-screen flex">
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-1">
          {/* Inbox Sidebar */}
          <div className="w-96 border-r h-full">
            <MessagingInbox
              onSelectThread={handleSelectThread}
              selectedThreadId={selectedThread}
              threadTypeFilter={getThreadTypeFilter()}
            />
          </div>
          
          {/* Chat Area */}
          <div className="flex-1 h-full">
            {selectedThread ? (
              <ChatWindow threadId={selectedThread} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <h2 className="text-xl font-semibold mb-2">Select a conversation</h2>
                  <p>Choose from your existing conversations or start a new one</p>
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
              threadTypeFilter={getThreadTypeFilter()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
