import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, MessageSquare, Mail, Users, ArrowUpRight, ArrowDownLeft, 
  Calendar, Plus, Clock, Store
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

const CHANNEL_CONFIG: Record<string, { icon: typeof Phone; color: string }> = {
  CALL: { icon: Phone, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  SMS: { icon: MessageSquare, color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  WHATSAPP: { icon: MessageSquare, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  IN_PERSON: { icon: Users, color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  EMAIL: { icon: Mail, color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  OTHER: { icon: MessageSquare, color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
};

const OUTCOME_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-500/10 text-green-600',
  PENDING: 'bg-yellow-500/10 text-yellow-600',
  NO_ANSWER: 'bg-gray-500/10 text-gray-600',
  FOLLOW_UP_NEEDED: 'bg-orange-500/10 text-orange-600',
  ESCALATED: 'bg-red-500/10 text-red-600',
};

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: 'bg-green-500/10 text-green-600',
  NEUTRAL: 'bg-gray-500/10 text-gray-600',
  NEGATIVE: 'bg-red-500/10 text-red-600',
};

interface InteractionTimelineProps {
  contactId?: string;
  storeId?: string;
  onLogInteraction: () => void;
  limit?: number;
  showFilters?: boolean;
}

export function InteractionTimeline({ 
  contactId, 
  storeId, 
  onLogInteraction,
  limit,
  showFilters = true
}: InteractionTimelineProps) {
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');

  const { data: interactions, isLoading } = useQuery({
    queryKey: ['contact-interactions', contactId, storeId],
    queryFn: async () => {
      let query = supabase
        .from('contact_interactions')
        .select(`
          *,
          contact:store_contacts(id, name, store_id),
          store:store_master(id, store_name)
        `)
        .order('created_at', { ascending: false });

      if (contactId) {
        query = query.eq('contact_id', contactId);
      }
      if (storeId) {
        query = query.eq('store_id', storeId);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!(contactId || storeId),
  });

  const filteredInteractions = interactions?.filter((i) => {
    if (channelFilter !== 'ALL' && i.channel !== channelFilter) return false;
    if (outcomeFilter !== 'ALL' && i.outcome !== outcomeFilter) return false;
    return true;
  });

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Interaction Timeline
        </CardTitle>
        <Button size="sm" onClick={onLogInteraction}>
          <Plus className="h-4 w-4 mr-1" /> Log Interaction
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        {showFilters && (
          <div className="flex gap-3 flex-wrap">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Channels</SelectItem>
                <SelectItem value="CALL">Calls</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="IN_PERSON">In Person</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Outcomes</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="NO_ANSWER">No Answer</SelectItem>
                <SelectItem value="FOLLOW_UP_NEEDED">Follow-up</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Timeline */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredInteractions && filteredInteractions.length > 0 ? (
          <div className="space-y-3">
            {filteredInteractions.map((interaction) => {
              const channelConf = CHANNEL_CONFIG[interaction.channel] || CHANNEL_CONFIG.OTHER;
              const ChannelIcon = channelConf.icon;
              
              return (
                <div
                  key={interaction.id}
                  className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Channel Icon */}
                      <div className={`p-2 rounded-lg ${channelConf.color}`}>
                        <ChannelIcon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Subject & Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{interaction.subject}</span>
                          <Badge variant="outline" className={channelConf.color}>
                            {interaction.channel}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {interaction.direction === 'OUTBOUND' ? (
                              <><ArrowUpRight className="h-3 w-3 mr-1" /> Out</>
                            ) : (
                              <><ArrowDownLeft className="h-3 w-3 mr-1" /> In</>
                            )}
                          </Badge>
                          {interaction.outcome && (
                            <Badge className={OUTCOME_COLORS[interaction.outcome]}>
                              {interaction.outcome.replace('_', ' ')}
                            </Badge>
                          )}
                          {interaction.sentiment && (
                            <Badge className={SENTIMENT_COLORS[interaction.sentiment]}>
                              {interaction.sentiment}
                            </Badge>
                          )}
                        </div>

                        {/* Summary */}
                        {interaction.summary && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {interaction.summary}
                          </p>
                        )}

                        {/* Store info (if viewing contact timeline) */}
                        {contactId && interaction.store && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Store className="h-3 w-3" />
                            {(interaction.store as any).store_name}
                          </div>
                        )}

                        {/* Contact info (if viewing store timeline) */}
                        {storeId && interaction.contact && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {(interaction.contact as any).name}
                          </div>
                        )}

                        {/* Follow-up */}
                        {interaction.follow_up_at && (
                          <div className="flex items-center gap-1 text-xs text-orange-500 mt-1">
                            <Calendar className="h-3 w-3" />
                            Follow-up: {format(new Date(interaction.follow_up_at), 'MMM d, yyyy h:mm a')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(interaction.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No interactions logged yet</p>
            <p className="text-sm mt-1">Start by logging your last call or visit</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
