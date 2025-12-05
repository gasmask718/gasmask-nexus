import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Mail, Users, ArrowUpRight, ArrowDownLeft, Plus, Clock } from 'lucide-react';
import { format } from 'date-fns';

const CHANNEL_ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  SMS: MessageSquare,
  WHATSAPP: MessageSquare,
  IN_PERSON: Users,
  EMAIL: Mail,
  OTHER: MessageSquare,
};

interface RecentStoreInteractionsProps {
  storeId: string;
  onLogInteraction: () => void;
  onViewAll?: () => void;
}

export function RecentStoreInteractions({ storeId, onLogInteraction, onViewAll }: RecentStoreInteractionsProps) {
  const { data: interactions, isLoading } = useQuery({
    queryKey: ['store-interactions', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_interactions')
        .select(`
          *,
          contact:store_contacts(id, name)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Recent Interactions
        </CardTitle>
        <Button size="sm" onClick={onLogInteraction}>
          <Plus className="h-4 w-4 mr-1" /> Log Interaction
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : interactions && interactions.length > 0 ? (
          <div className="space-y-3">
            {interactions.map((interaction) => {
              const ChannelIcon = CHANNEL_ICONS[interaction.channel] || MessageSquare;
              return (
                <div
                  key={interaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ChannelIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{interaction.subject}</span>
                        <Badge variant="outline" className="text-xs">
                          {interaction.direction === 'OUTBOUND' ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3" />
                          )}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(interaction.contact as any)?.name} • {format(new Date(interaction.created_at), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </div>
                  {interaction.outcome && (
                    <Badge variant="secondary" className="text-xs">
                      {interaction.outcome.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              );
            })}
            {onViewAll && (
              <Button variant="ghost" size="sm" className="w-full" onClick={onViewAll}>
                View all interactions
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No interactions yet</p>
            <p className="text-xs mt-1">Log your first call or visit</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
