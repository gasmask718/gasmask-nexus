import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, MessageCircle, Calendar, RefreshCw, DollarSign, Target, Package, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { dynastyDate } from '@/lib/dates';
import { Link } from 'react-router-dom';

interface FollowUpAIRecommendationProps {
  storeId: string;
  onSendMessage?: (message: string) => void;
}

interface FollowUpReason {
  type: 'unpaid_order' | 'opportunity' | 'low_tubes' | 'no_contact';
  title: string;
  description: string;
  count?: number;
  amount?: number;
  icon: any;
  color: string;
}

export const FollowUpAIRecommendation = ({ storeId, onSendMessage }: FollowUpAIRecommendationProps) => {
  const queryClient = useQueryClient();

  // Fetch follow-up reasons
  const { data: followUpReasons } = useQuery({
    queryKey: ['followup-reasons', storeId],
    queryFn: async () => {
      const reasons: FollowUpReason[] = [];

      // 1. Check for unpaid orders
      const { data: unpaidOrders } = await supabase
        .from('visit_logs')
        .select('id, cash_collected, created_at')
        .eq('store_id', storeId)
        .eq('visit_type', 'order')
        .or('cash_collected.is.null,cash_collected.eq.0');

      if (unpaidOrders && unpaidOrders.length > 0) {
        const totalUnpaid = unpaidOrders.reduce((sum, order) => {
          return sum + (Number(order.cash_collected) || 0);
        }, 0);
        
        reasons.push({
          type: 'unpaid_order',
          title: 'Unpaid Orders',
          description: `${unpaidOrders.length} unpaid order${unpaidOrders.length !== 1 ? 's' : ''}`,
          count: unpaidOrders.length,
          amount: totalUnpaid,
          icon: DollarSign,
          color: 'text-yellow-600',
        });
      }

      // 2. Check for opportunities
      const { data: opportunities } = await supabase
        .from('store_opportunities')
        .select('id, opportunity_text, is_completed')
        .eq('store_id', storeId)
        .eq('is_completed', false);

      if (opportunities && opportunities.length > 0) {
        reasons.push({
          type: 'opportunity',
          title: 'Open Opportunities',
          description: `${opportunities.length} opportunity${opportunities.length !== 1 ? 'ies' : ''} need attention`,
          count: opportunities.length,
          icon: Target,
          color: 'text-blue-600',
        });
      }

      // 3. Check for low tube counts
      const { data: tubeInventory } = await supabase
        .from('store_tube_inventory')
        .select('brand, current_tubes_left')
        .eq('store_id', storeId);

      if (tubeInventory) {
        const lowTubes = tubeInventory.filter(inv => (inv.current_tubes_left || 0) < 20);
        if (lowTubes.length > 0) {
          reasons.push({
            type: 'low_tubes',
            title: 'Low Tube Counts',
            description: `${lowTubes.length} brand${lowTubes.length !== 1 ? 's' : ''} below 20 tubes`,
            count: lowTubes.length,
            icon: Package,
            color: 'text-orange-600',
          });
        }
      }

      // 4. Check for no contact
      const { data: lastContact } = await supabase
        .from('contact_interactions')
        .select('created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: lastVisit } = await supabase
        .from('visit_logs')
        .select('visit_datetime, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lastContactDate = lastContact?.created_at || lastVisit?.visit_datetime || lastVisit?.created_at;
      if (lastContactDate) {
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceContact > 14) {
          reasons.push({
            type: 'no_contact',
            title: 'No Recent Contact',
            description: `No contact in ${daysSinceContact} days`,
            count: daysSinceContact,
            icon: PhoneOff,
            color: 'text-red-600',
          });
        }
      } else {
        // No contact records at all
        reasons.push({
          type: 'no_contact',
          title: 'No Contact History',
          description: 'No communication records found',
          icon: PhoneOff,
          color: 'text-red-600',
        });
      }

      return reasons;
    },
    enabled: !!storeId,
  });

  const { data: recommendation, isLoading, refetch } = useQuery({
    queryKey: ['followup-recommendation', storeId],
    queryFn: async () => {
      // Check for existing recommendation
      const { data: existing } = await supabase
        .from('followup_recommendations')
        .select('*')
        .eq('store_id', storeId)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (existing) return existing;

      // Generate new recommendation
      const { data, error } = await supabase.functions.invoke('followup-ai', {
        body: { storeId },
      });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const addReminder = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !recommendation) throw new Error('Missing data');

      const { error } = await supabase
        .from('reminders')
        .insert({
          store_id: storeId,
          assigned_to: user.id,
          follow_up_date: recommendation.suggested_date,
          notes: recommendation.reasoning,
          status: 'pending',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reminder added successfully');
      queryClient.invalidateQueries({ queryKey: ['user-reminders'] });
    },
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'red': return 'bg-destructive';
      case 'yellow': return 'bg-yellow-500';
      case 'green': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getRiskVariant = (level: string): 'destructive' | 'default' | 'secondary' => {
    switch (level) {
      case 'red': return 'destructive';
      case 'yellow': return 'default';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Follow-Up Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Follow-Up Recommendation
          </CardTitle>
          <CardDescription>No recommendation available</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show follow-up reasons even if no recommendation */}
          {followUpReasons && followUpReasons.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Follow-Up Reasons:</div>
              {followUpReasons.map((reason, idx) => {
                const Icon = reason.icon;
                return (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border">
                    <Icon className={`h-4 w-4 ${reason.color}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{reason.title}</div>
                      <div className="text-xs text-muted-foreground">{reason.description}</div>
                    </div>
                    {reason.amount && (
                      <Badge variant="outline" className={reason.color}>
                        ${reason.amount.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Button onClick={() => refetch()} variant="outline" className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate Recommendation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Follow-Up Recommendation
          </span>
          <Button onClick={() => refetch()} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>AI-powered communication insights</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Follow-Up Reasons */}
        {followUpReasons && followUpReasons.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Follow-Up Reasons:</div>
            {followUpReasons.map((reason, idx) => {
              const Icon = reason.icon;
              return (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border">
                  <Icon className={`h-4 w-4 ${reason.color}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{reason.title}</div>
                    <div className="text-xs text-muted-foreground">{reason.description}</div>
                  </div>
                  {reason.amount && (
                    <Badge variant="outline" className={reason.color}>
                      ${reason.amount.toFixed(2)}
                    </Badge>
                  )}
                  {reason.count && !reason.amount && (
                    <Badge variant="outline">{reason.count}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Priority Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Priority Score</span>
            <Badge variant={getRiskVariant(recommendation.risk_level)}>
              {recommendation.priority_score}/100
            </Badge>
          </div>
          <Progress value={recommendation.priority_score} className="h-2" />
          <div className={`w-2 h-2 rounded-full mt-1 ${getRiskColor(recommendation.risk_level)}`} />
        </div>

        {/* Recommended Action */}
        <div>
          <span className="text-sm font-medium">Recommended Action</span>
          <Badge variant="outline" className="ml-2">
            {recommendation.recommended_action}
          </Badge>
        </div>

        {/* Suggested Date */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Suggested:</span>
          <span className="font-medium">
            {dynastyDate(recommendation.suggested_date)}
          </span>
        </div>

        {/* Reasoning */}
        {recommendation.reasoning && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
          </div>
        )}

        {/* Suggested Message */}
        {recommendation.suggested_message && (
          <div>
            <span className="text-sm font-medium mb-2 block">Suggested Message</span>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{recommendation.suggested_message}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => addReminder.mutate()}
            disabled={addReminder.isPending}
            className="flex-1"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Add Reminder
          </Button>
          {onSendMessage && recommendation.suggested_message && (
            <Button
              onClick={() => onSendMessage(recommendation.suggested_message)}
              variant="outline"
              className="flex-1"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Use Message
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
