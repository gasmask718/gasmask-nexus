import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Mail, Users, ArrowUpRight, ArrowDownLeft, Plus, Clock, AlertCircle, Link2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';
import { toast } from 'sonner';
import { InteractionDetailModal } from '@/components/store/InteractionDetailModal';

const CHANNEL_ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  SMS: MessageSquare,
  WHATSAPP: MessageSquare,
  IN_PERSON: Users,
  EMAIL: Mail,
  OTHER: MessageSquare,
};

interface Interaction {
  id: string;
  channel: string;
  direction: string;
  subject: string;
  summary: string | null;
  outcome: string | null;
  sentiment: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  created_at: string;
  contact?: {
    id: string;
    name: string;
  } | null;
}

interface RecentStoreInteractionsProps {
  storeId: string;
  onLogInteraction: (storeMasterId: string) => void;
  onViewAll?: () => void;
}

export function RecentStoreInteractions({ storeId, onLogInteraction, onViewAll }: RecentStoreInteractionsProps) {
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { 
    storeMasterId, 
    isLoading: resolving, 
    needsCreation, 
    legacyStore,
    createStoreMaster,
    isCreating 
  } = useStoreMasterResolver(storeId);

  const { data: interactions, isLoading } = useQuery({
    queryKey: ['store-interactions', storeMasterId],
    queryFn: async () => {
      if (!storeMasterId) return [];
      const { data, error } = await supabase
        .from('contact_interactions')
        .select(`
          id,
          channel,
          direction,
          subject,
          summary,
          outcome,
          sentiment,
          next_action,
          follow_up_at,
          created_at,
          contact:store_contacts(id, name)
        `)
        .eq('store_id', storeMasterId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Interaction[];
    },
    enabled: !!storeMasterId,
  });

  const handleCreateStoreMaster = async () => {
    try {
      const created = await createStoreMaster();
      toast.success('Store Master record created');
      onLogInteraction(created.id);
    } catch (error: any) {
      toast.error('Failed to create store master: ' + error.message);
    }
  };

  const handleLogInteraction = () => {
    if (storeMasterId) {
      onLogInteraction(storeMasterId);
    }
  };

  const handleInteractionClick = (interaction: Interaction) => {
    setSelectedInteraction(interaction);
    setDetailOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Recent Interactions
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button 
                    size="sm" 
                    onClick={handleLogInteraction}
                    disabled={!storeMasterId || resolving}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Log Interaction
                  </Button>
                </span>
              </TooltipTrigger>
              {!storeMasterId && !resolving && (
                <TooltipContent>
                  <p>Link this store to Store Master first</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent>
          {resolving || isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : needsCreation ? (
            <div className="text-center py-6 space-y-4">
              <AlertCircle className="h-10 w-10 mx-auto text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Link to Store Master</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a Store Master record to log interactions
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={handleCreateStoreMaster}
                disabled={isCreating}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {isCreating ? 'Creating...' : `Create Store Master for "${legacyStore?.name}"`}
              </Button>
            </div>
          ) : !storeMasterId ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50 text-yellow-500" />
              <p className="text-sm">Store not linked to store_master</p>
              <p className="text-xs mt-1">Interactions require a valid store_master record</p>
            </div>
          ) : interactions && interactions.length > 0 ? (
            <div className="space-y-3">
              {interactions.map((interaction) => {
                const ChannelIcon = CHANNEL_ICONS[interaction.channel] || MessageSquare;
                return (
                  <div
                    key={interaction.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => handleInteractionClick(interaction)}
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
                    <div className="flex items-center gap-2">
                      {interaction.outcome && (
                        <Badge variant="secondary" className="text-xs">
                          {interaction.outcome.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
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

      <InteractionDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        interaction={selectedInteraction}
      />
    </>
  );
}
