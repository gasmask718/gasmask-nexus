import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Phone, MessageSquare, Mail, Bot, User, Settings, 
  ChevronDown, ChevronUp, Flag, Lock, Unlock, AlertTriangle,
  Plus, CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  useConversationMemory, 
  useMemoryEvents, 
  useAddMemoryEvent,
  useUpdateConversationMemory,
  useCreateConversationMemory,
  MemoryEvent 
} from "@/hooks/useConversationMemory";

interface ConversationMemoryTimelineProps {
  contactId: string;
  contactName?: string;
}

const channelIcons: Record<string, any> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  ai_action: Bot,
  human_note: User,
  system: Settings,
};

const channelColors: Record<string, string> = {
  call: "bg-green-500/10 text-green-600 border-green-500/20",
  text: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  email: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  ai_action: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  human_note: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  system: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export function ConversationMemoryTimeline({ contactId, contactName }: ConversationMemoryTimelineProps) {
  const { data: memory, isLoading: memoryLoading } = useConversationMemory(contactId);
  const { data: events = [], isLoading: eventsLoading } = useMemoryEvents(memory?.id || null);
  const createMemory = useCreateConversationMemory();
  const addEvent = useAddMemoryEvent();
  const updateMemory = useUpdateConversationMemory();
  
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  const toggleExpand = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    
    let conversationId = memory?.id;
    
    if (!conversationId) {
      const newMemory = await createMemory.mutateAsync(contactId);
      conversationId = newMemory.id;
    }
    
    await addEvent.mutateAsync({
      conversation_id: conversationId,
      business_id: null,
      channel: 'human_note',
      actor: 'human',
      actor_name: 'User',
      direction: 'internal',
      raw_content: noteContent,
      ai_extracted_summary: null,
      sentiment_score: null,
      tags: [],
      linked_tasks: [],
      escalation_flag: false,
      metadata: {},
    });
    
    setNoteContent("");
    setShowAddNote(false);
  };

  const handleToggleFreeze = () => {
    if (memory) {
      updateMemory.mutate({ 
        id: memory.id, 
        updates: { is_frozen: !memory.is_frozen } 
      });
    }
  };

  const handleEscalate = () => {
    if (memory) {
      updateMemory.mutate({ 
        id: memory.id, 
        updates: { status: 'escalated' as const } 
      });
    }
  };

  const handleMarkResolved = () => {
    if (memory) {
      updateMemory.mutate({ 
        id: memory.id, 
        updates: { status: 'closed' as const } 
      });
    }
  };

  if (memoryLoading) {
    return <div className="p-4 text-muted-foreground">Loading memory...</div>;
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            🧠 Conversation Memory
            {contactName && <span className="text-muted-foreground font-normal">— {contactName}</span>}
          </CardTitle>
          <div className="flex gap-1">
            {memory && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleToggleFreeze}
                  title={memory.is_frozen ? "Unfreeze" : "Freeze"}
                >
                  {memory.is_frozen ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleEscalate}
                  title="Escalate"
                >
                  <AlertTriangle className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleMarkResolved}
                  title="Mark Resolved"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddNote(!showAddNote)}
            >
              <Plus className="h-4 w-4 mr-1" /> Note
            </Button>
          </div>
        </div>
        
        {/* Memory Summary */}
        {memory && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{memory.status}</Badge>
              <Badge variant="outline" className={cn(
                memory.sentiment_trend === 'positive' && "bg-green-500/10 text-green-600",
                memory.sentiment_trend === 'negative' && "bg-red-500/10 text-red-600",
                memory.sentiment_trend === 'neutral' && "bg-gray-500/10 text-gray-600"
              )}>
                {memory.sentiment_trend}
              </Badge>
              {memory.is_frozen && <Badge variant="secondary">🔒 Frozen</Badge>}
              {memory.risk_flags?.map((flag, i) => (
                <Badge key={i} variant="destructive">{flag}</Badge>
              ))}
            </div>
            {memory.memory_summary_current && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                {memory.memory_summary_current}
              </p>
            )}
          </div>
        )}
        
        {/* Add Note Form */}
        {showAddNote && (
          <div className="mt-3 space-y-2">
            <Textarea 
              placeholder="Add a note to this conversation..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNote} disabled={addEvent.isPending}>
                Save Note
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {events.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No conversation history yet
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <MemoryEventCard 
                  key={event.id} 
                  event={event}
                  expanded={expandedEvents.has(event.id)}
                  onToggle={() => toggleExpand(event.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MemoryEventCard({ 
  event, 
  expanded, 
  onToggle 
}: { 
  event: MemoryEvent; 
  expanded: boolean; 
  onToggle: () => void;
}) {
  const Icon = channelIcons[event.channel] || Settings;
  const colorClass = channelColors[event.channel] || channelColors.system;
  
  return (
    <div className={cn("border rounded-lg p-3", colorClass)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-medium capitalize">{event.channel.replace('_', ' ')}</span>
          <Badge variant="outline" className="text-xs">
            {event.actor}
          </Badge>
          {event.direction && (
            <span className="text-xs text-muted-foreground">
              {event.direction === 'inbound' ? '← In' : event.direction === 'outbound' ? '→ Out' : '↔ Internal'}
            </span>
          )}
          {event.escalation_flag && <Flag className="h-3 w-3 text-red-500" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {format(new Date(event.created_at), 'MMM d, h:mm a')}
          </span>
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      
      {/* AI Summary */}
      {event.ai_extracted_summary && (
        <p className="text-sm mt-2">{event.ai_extracted_summary}</p>
      )}
      
      {/* Expanded Raw Content */}
      {expanded && event.raw_content && (
        <div className="mt-2 p-2 bg-background/50 rounded text-sm whitespace-pre-wrap">
          {event.raw_content}
        </div>
      )}
      
      {/* Tags */}
      {event.tags?.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {event.tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
