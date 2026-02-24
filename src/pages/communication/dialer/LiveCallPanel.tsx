import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Headphones, Phone, PhoneOff, Clock, MapPin, User, Save, 
  ThumbsUp, ThumbsDown, CalendarClock, AlertCircle, HelpCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

type Outcome = 'sale' | 'follow_up' | 'not_interested' | 'wrong_number' | 'callback' | 'owner_not_available' | 'no_disposition';

const outcomeButtons: { value: Outcome; label: string; icon: typeof ThumbsUp; color: string }[] = [
  { value: 'sale', label: 'Interested / Sale', icon: ThumbsUp, color: 'bg-green-600 hover:bg-green-700 text-white' },
  { value: 'follow_up', label: 'Call Back', icon: CalendarClock, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown, color: 'bg-muted hover:bg-muted/80' },
  { value: 'owner_not_available', label: 'Owner N/A', icon: HelpCircle, color: 'bg-amber-600 hover:bg-amber-700 text-white' },
  { value: 'wrong_number', label: 'Wrong Number', icon: AlertCircle, color: 'bg-destructive hover:bg-destructive/90 text-white' },
];

export default function LiveCallPanel() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data: sessions = [] } = useQuery({
    queryKey: ['live-call-sessions', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_call_sessions')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .is('ended_at', null)
        .order('connected_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 5000,
  });

  const { data: recentSessions = [] } = useQuery({
    queryKey: ['recent-call-sessions', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_call_sessions')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const dispositionMutation = useMutation({
    mutationFn: async ({ sessionId, outcome }: { sessionId: string; outcome: Outcome }) => {
      const { error } = await supabase
        .from('live_call_sessions')
        .update({ 
          outcome, 
          notes,
          ended_at: new Date().toISOString(),
          duration_seconds: 0, // Would be calculated from connected_at
        })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Call disposed');
      setNotes('');
      setSelectedSession(null);
      queryClient.invalidateQueries({ queryKey: ['live-call-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-call-sessions'] });
    },
  });

  const formatDuration = (connectedAt: string) => {
    const diff = Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Headphones className="h-6 w-6" /> Live Call Panel
        </h2>
        <p className="text-muted-foreground">Active bridged calls — disposition in real-time</p>
      </div>

      {/* Active Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sessions.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent className="py-12 text-center">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Active Calls</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Start the bulk dialer to begin connecting to humans
              </p>
            </CardContent>
          </Card>
        ) : (
          sessions.map(session => (
            <Card key={session.id} className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                    {session.contact_name || 'Unknown Contact'}
                  </CardTitle>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDuration(session.connected_at)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Notes */}
                <Textarea
                  placeholder="Call notes..."
                  value={selectedSession === session.id ? notes : ''}
                  onChange={(e) => {
                    setSelectedSession(session.id);
                    setNotes(e.target.value);
                  }}
                  onFocus={() => setSelectedSession(session.id)}
                  rows={2}
                />

                {/* Disposition Buttons */}
                <div className="flex flex-wrap gap-2">
                  {outcomeButtons.map(btn => (
                    <Button
                      key={btn.value}
                      size="sm"
                      className={`gap-1 ${btn.color}`}
                      onClick={() => dispositionMutation.mutate({ sessionId: session.id, outcome: btn.value })}
                      disabled={dispositionMutation.isPending}
                    >
                      <btn.icon className="h-3.5 w-3.5" />
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent calls</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recentSessions.map(session => (
                  <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{session.contact_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.duration_seconds ? `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {session.outcome?.replace('_', ' ') || 'No disposition'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
