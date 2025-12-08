import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Phone, 
  MessageSquare, 
  Play,
  Pause,
  UserPlus,
  CheckCircle,
  XCircle,
  Volume2,
  Bot
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

export default function LiveNegotiationsPanel() {
  const { data: activeSessions, isLoading } = useQuery({
    queryKey: ['active-negotiations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negotiation_sessions')
        .select(`
          *,
          deal:deals(
            id, 
            expected_value, 
            discount_percent,
            store:store_master(store_name),
            business:businesses(name)
          ),
          ai_agent:ai_agents(name)
        `)
        .is('ended_at', null)
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Active Sessions */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            Live Negotiations
          </CardTitle>
          <CardDescription>
            Active AI-led negotiations with real-time updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!activeSessions || activeSessions.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active negotiations</p>
              <p className="text-sm">AI negotiations will appear here in real-time</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <NegotiationCard key={session.id} session={session} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NegotiationCard({ session }: { session: any }) {
  const isCall = session.channel === 'call';
  
  return (
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isCall ? 'bg-blue-500/10' : 'bg-purple-500/10'
            }`}>
              {isCall ? (
                <Phone className="h-5 w-5 text-blue-500" />
              ) : (
                <MessageSquare className="h-5 w-5 text-purple-500" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {session.deal?.store?.store_name || 'Unknown Store'}
              </p>
              <p className="text-sm text-muted-foreground">
                {session.deal?.business?.name} • {session.session_type}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-500/10 text-green-500">
              Live
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Current State */}
        <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Expected Value</p>
            <p className="font-semibold">
              ${Number(session.deal?.expected_value || 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Discount Offered</p>
            <p className="font-semibold">
              {session.deal?.discount_percent || 0}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">AI Agent</p>
            <p className="font-semibold flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {session.ai_agent?.name || 'Auto'}
            </p>
          </div>
        </div>

        {/* Live Transcript Preview (for calls) */}
        {isCall && (
          <div className="p-3 bg-muted/30 rounded-lg mb-4 border">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-4 w-4 text-muted-foreground animate-pulse" />
              <span className="text-xs text-muted-foreground">Live Transcript</span>
            </div>
            <p className="text-sm italic text-muted-foreground">
              "...so if I order 20 boxes instead of 15, can you do a better price?"
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            <UserPlus className="h-4 w-4 mr-2" />
            Join
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            <Pause className="h-4 w-4 mr-2" />
            Pause AI
          </Button>
          <Button size="sm" variant="default" className="flex-1">
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve Deal
          </Button>
          <Button size="sm" variant="ghost">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
