import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpsInboxThreads, OpsThread } from '@/hooks/useOpsInbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Inbox, AlertTriangle, ClipboardList, Megaphone, Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const priorityColors: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500/10 text-orange-600',
  normal: 'bg-muted text-muted-foreground',
  low: 'bg-muted text-muted-foreground',
};

const typeIcons: Record<string, React.ReactNode> = {
  task: <ClipboardList className="h-4 w-4" />,
  alert: <AlertTriangle className="h-4 w-4" />,
  message: <Inbox className="h-4 w-4" />,
  campaign: <Megaphone className="h-4 w-4" />,
  system: <Inbox className="h-4 w-4" />,
};

export default function OpsInboxPage() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filter = tab === 'all' ? undefined
    : tab === 'unread' ? undefined
    : { type: tab };

  const { data: threads = [], isLoading } = useOpsInboxThreads(filter);

  const filtered = threads.filter(t => {
    if (tab === 'unread' && !t.unread) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 space-y-3">
        <h1 className="text-xl font-bold text-foreground">Inbox</h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search threads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="unread" className="flex-1">Unread</TabsTrigger>
            <TabsTrigger value="task" className="flex-1">Tasks</TabsTrigger>
            <TabsTrigger value="alert" className="flex-1">Alerts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">No messages</p>
            <p className="text-sm">Your inbox is clear</p>
          </div>
        ) : (
          filtered.map(thread => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onClick={() => navigate(`/portal/inbox/${thread.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ThreadCard({ thread, onClick }: { thread: OpsThread; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors flex items-start gap-3',
        thread.unread && 'bg-primary/5'
      )}
    >
      <div className="pt-0.5">
        {thread.unread && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {typeIcons[thread.type] || typeIcons.message}
          <span className={cn('text-sm truncate', thread.unread ? 'font-semibold text-foreground' : 'text-foreground')}>
            {thread.title}
          </span>
        </div>

        {thread.latest_message && (
          <p className="text-xs text-muted-foreground line-clamp-1">{thread.latest_message}</p>
        )}

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn('text-[10px]', priorityColors[thread.priority])}>
            {thread.priority}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
    </button>
  );
}
