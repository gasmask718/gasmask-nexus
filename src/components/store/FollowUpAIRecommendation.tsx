import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, MessageCircle, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface FollowUpAIRecommendationProps {
  storeId: string;
  onSendMessage?: (message: string) => void;
}

export const FollowUpAIRecommendation = ({ storeId, onSendMessage }: FollowUpAIRecommendationProps) => {
  const queryClient = useQueryClient();

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
        <CardContent>
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
            {format(new Date(recommendation.suggested_date), 'MMM d, yyyy')}
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