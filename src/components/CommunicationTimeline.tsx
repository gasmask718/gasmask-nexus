import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  MapPin, 
  StickyNote, 
  Zap,
  User
} from "lucide-react";

interface CommunicationTimelineProps {
  entityType: 'store' | 'wholesaler' | 'influencer';
  entityId: string;
}

export function CommunicationTimeline({ entityType, entityId }: CommunicationTimelineProps) {
  const { data: communications } = useQuery({
    queryKey: ['communications', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('*, profiles(name)')
        .eq('linked_entity_type', entityType)
        .eq('linked_entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, any> = {
      call: Phone,
      sms: MessageSquare,
      email: Mail,
      visit: MapPin,
      note: StickyNote,
      mission: Zap,
    };
    const Icon = icons[channel] || User;
    return <Icon className="h-4 w-4" />;
  };

  const getChannelColor = (channel: string) => {
    const colors: Record<string, string> = {
      call: 'bg-primary/20 text-primary',
      sms: 'bg-accent/20 text-accent-foreground',
      email: 'bg-secondary/20 text-secondary-foreground',
      visit: 'bg-primary text-primary-foreground',
      note: 'bg-muted text-muted-foreground',
      mission: 'bg-destructive/20 text-destructive',
    };
    return colors[channel] || 'bg-muted';
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === 'inbound') return 'Incoming';
    if (direction === 'outbound') return 'Outgoing';
    return 'System';
  };

  if (!communications || communications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No communication history yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {communications.map((comm) => (
        <Card key={comm.id} className="hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg ${getChannelColor(comm.channel || 'note')}`}>
                {getChannelIcon(comm.channel || 'note')}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{comm.event_type}</h4>
                    <Badge variant="outline" className="text-xs">
                      {getDirectionBadge(comm.direction)}
                    </Badge>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(comm.created_at).toLocaleString()}
                  </time>
                </div>

                <p className="text-sm">{comm.summary}</p>

                {comm.external_contact && (
                  <p className="text-xs text-muted-foreground">
                    Contact: {comm.external_contact}
                  </p>
                )}

                {comm.profiles?.name && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{comm.profiles.name}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
