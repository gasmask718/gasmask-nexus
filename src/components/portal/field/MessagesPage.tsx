import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { ChatWindow } from "@/components/messaging/ChatWindow";

interface MessagesPageProps {
  portalType: "driver" | "biker";
}

/**
 * Real, persisted messaging for the Driver / Biker portals.
 *
 * Wraps the same MessagingInbox + ChatWindow used by the main /messages page
 * so every conversation is stored in the messaging tables (no more mock
 * React-state stub). Threads are filtered to the worker's dispatch scope.
 */
export function MessagesPage({ portalType }: MessagesPageProps) {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const [selectedThread, setSelectedThread] = useState<string | undefined>(threadId);

  const base = portalType === "driver" ? "/portal/driver/messages" : "/portal/biker/messages";
  const threadTypeFilter = portalType === "driver" ? "driver_dispatch" : "biker_dispatch";

  const handleSelectThread = (id: string) => {
    setSelectedThread(id);
    navigate(`${base}/${id}`);
  };

  const handleBack = () => {
    setSelectedThread(undefined);
    navigate(base);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {/* Mobile: single-pane */}
        <div className="md:hidden flex-1 h-full">
          {selectedThread ? (
            <ChatWindow threadId={selectedThread} onBack={handleBack} />
          ) : (
            <MessagingInbox
              onSelectThread={handleSelectThread}
              threadTypeFilter={threadTypeFilter}
            />
          )}
        </div>

        {/* Desktop: inbox + chat */}
        <div className="hidden md:flex flex-1 border rounded-lg overflow-hidden">
          <div className="w-80 border-r h-full">
            <MessagingInbox
              onSelectThread={handleSelectThread}
              selectedThreadId={selectedThread}
              threadTypeFilter={threadTypeFilter}
            />
          </div>
          <div className="flex-1 h-full">
            {selectedThread ? (
              <ChatWindow threadId={selectedThread} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="text-5xl mb-2">💬</div>
                  <p className="font-medium">Select a conversation</p>
                  <p className="text-sm">Messages with dispatch and stores appear here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
