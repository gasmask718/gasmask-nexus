import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, PhoneOff, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { ActiveCallSession } from '@/hooks/useCallCenterSession';

interface MultiCallGridProps {
  activeSessions: ActiveCallSession[];
  completedSessions: ActiveCallSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  queueLength: number;
  isRunning: boolean;
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  return <span className="font-mono text-xs">{mins}:{secs}</span>;
}

const statusColors: Record<string, string> = {
  dialing: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  connected: 'bg-green-500/10 text-green-600 border-green-500/30',
  completed: 'bg-muted text-muted-foreground',
  failed: 'bg-red-500/10 text-red-600 border-red-500/30',
  no_answer: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

const agentColors: Record<string, string> = {
  green: 'text-green-600',
  blue: 'text-blue-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
};

export function MultiCallGrid({
  activeSessions, completedSessions, selectedSessionId, onSelectSession, queueLength, isRunning,
}: MultiCallGridProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {activeSessions.length} active · {completedSessions.length} completed · {queueLength} queued
        </p>
      </div>

      {/* Active call cards */}
      {activeSessions.length > 0 ? (
        <div className="grid grid-cols-1 gap-2">
          {activeSessions.map(session => (
            <Card
              key={session.session_id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedSessionId === session.session_id
                  ? 'ring-2 ring-primary'
                  : ''
              } ${session.status === 'connected' ? 'border-green-500/40 bg-green-500/5' : 'border-yellow-500/40 bg-yellow-500/5'}`}
              onClick={() => onSelectSession(
                selectedSessionId === session.session_id ? null : session.session_id
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold truncate">{session.store_name}</span>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[session.status] || ''}`}>
                    {session.status === 'connected' && <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1" />}
                    {session.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{session.phone}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[10px] ${agentColors[session.agent.color] || ''}`}>
                    {session.agent.name}
                  </span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <LiveTimer startedAt={session.started_at} />
                  </div>
                </div>
                {session.transcript_preview && (
                  <p className="text-[10px] text-muted-foreground italic mt-1.5 truncate">
                    "{session.transcript_preview}"
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <PhoneOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">No Active Calls</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isRunning ? 'Processing queue...' : 'Load leads and start a session'}
          </p>
        </div>
      )}

      {/* Completed calls log */}
      {completedSessions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Completed</p>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {completedSessions.slice(0, 20).map(session => (
                <div key={session.session_id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
                  {session.status === 'completed' ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                  )}
                  <span className="truncate flex-1">{session.store_name}</span>
                  <span className="text-muted-foreground font-mono shrink-0">{session.phone}</span>
                  <span className={`shrink-0 ${agentColors[session.agent.color] || ''}`}>{session.agent.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {session.outcome || session.status}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
