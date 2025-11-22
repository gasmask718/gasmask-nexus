import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, MessageSquare, User } from 'lucide-react';

interface CommunicationTimelineCRMProps {
  storeId?: string;
  contactId?: string;
  driverId?: string;
  influencerId?: string;
  wholesalerId?: string;
}

export const CommunicationTimelineCRM = ({
  storeId,
  contactId,
  driverId,
  influencerId,
  wholesalerId,
}: CommunicationTimelineCRMProps) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['communication-logs-crm', storeId, contactId, driverId, influencerId, wholesalerId],
    queryFn: async () => {
      let query = supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(name),
          store:stores(name),
          created_by_profile:profiles!communication_logs_created_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (storeId) query = query.eq('store_id', storeId);
      if (contactId) query = query.eq('contact_id', contactId);
      if (driverId) query = query.eq('driver_id', driverId);
      if (influencerId) query = query.eq('influencer_id', influencerId);
      if (wholesalerId) query = query.eq('wholesaler_id', wholesalerId);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call':
        return <Phone className="h-4 w-4 text-blue-500" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'email':
        return <Mail className="h-4 w-4 text-purple-500" />;
      case 'in-person':
        return <User className="h-4 w-4 text-orange-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
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
      <p className="text-sm text-muted-foreground text-center py-8">
        No communication history
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-4 p-4 rounded-lg border hover:bg-secondary/30 transition-colors">
          <div className="p-2 rounded-lg bg-secondary h-fit">
            {getChannelIcon(log.channel)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{log.summary}</p>
                {log.full_message && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {log.full_message}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="capitalize shrink-0">
                {log.direction}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                {new Date(log.created_at).toLocaleString()}
              </span>
              {log.created_by_profile?.name && (
                <span>by {log.created_by_profile.name}</span>
              )}
              {log.outcome && (
                <Badge variant="secondary" className="text-xs">
                  {log.outcome}
                </Badge>
              )}
              {log.follow_up_required && (
                <Badge variant="destructive" className="text-xs">
                  Follow-up Required
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};