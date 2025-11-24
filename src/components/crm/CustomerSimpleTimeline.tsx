import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, MessageSquare, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface CustomerSimpleTimelineProps {
  contactId?: string;
}

export const CustomerSimpleTimeline = ({ contactId }: CustomerSimpleTimelineProps) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['contact-timeline', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        No communication history yet
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={log.id} className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {getChannelIcon(log.channel)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="capitalize text-xs">
                  {log.channel}
                </Badge>
                <Badge variant="secondary" className="capitalize text-xs">
                  {log.direction}
                </Badge>
                {log.follow_up_required && (
                  <Badge variant="destructive" className="text-xs">
                    Follow-up Required
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium">{log.summary}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
