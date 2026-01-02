import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Target, Plus, Clock, CheckCircle2, Circle, Sparkles, User } from 'lucide-react';
import { format } from 'date-fns';
import { AddOpportunityModal } from './AddOpportunityModal';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface StoreOpportunity {
  id: string;
  store_id: string;
  opportunity_text: string;
  is_completed: boolean;
  source: 'manual' | 'ai_extracted';
  detected_from_note_id: string | null;
  detected_from_interaction_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

interface OpportunitiesSectionProps {
  storeId: string;
  storeName: string;
}

export function OpportunitiesSection({ storeId, storeName }: OpportunitiesSectionProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Resolve storeId to store_master.id
  const { storeMasterId, isLoading: resolving } = useStoreMasterResolver(storeId);

  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['store-opportunities', storeMasterId],
    queryFn: async () => {
      if (!storeMasterId) return [];
      const { data, error } = await supabase
        .from('store_opportunities')
        .select('*')
        .eq('store_id', storeMasterId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StoreOpportunity[];
    },
    enabled: !!storeMasterId,
  });

  // Mutation to toggle completion status
  const toggleCompletion = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const updateData: any = {
        is_completed: !isCompleted,
      };

      if (!isCompleted) {
        // Marking as completed
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id;
      } else {
        // Marking as incomplete
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      const { error } = await supabase
        .from('store_opportunities')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-opportunities', storeMasterId] });
      toast.success('Opportunity updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update opportunity: ' + error.message);
    },
  });

  const handleOpportunityAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['store-opportunities', storeMasterId] });
  };

  const handleToggleCompletion = (opportunity: StoreOpportunity) => {
    toggleCompletion.mutate({
      id: opportunity.id,
      isCompleted: opportunity.is_completed,
    });
  };

  // Separate completed and pending opportunities
  const pendingOpportunities = opportunities?.filter((opp) => !opp.is_completed) || [];
  const completedOpportunities = opportunities?.filter((opp) => opp.is_completed) || [];

  if (resolving || isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Opportunities
            {opportunities && opportunities.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingOpportunities.length} pending
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {!opportunities || opportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No opportunities yet</p>
              <p className="text-sm mt-1">Add opportunities to track potential revenue</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Opportunities */}
              {pendingOpportunities.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Circle className="h-4 w-4 text-primary" />
                    Pending ({pendingOpportunities.length})
                  </h4>
                  {pendingOpportunities.map((opportunity) => (
                    <OpportunityItem
                      key={opportunity.id}
                      opportunity={opportunity}
                      onToggle={() => handleToggleCompletion(opportunity)}
                      isToggling={toggleCompletion.isPending}
                    />
                  ))}
                </div>
              )}

              {/* Completed Opportunities */}
              {completedOpportunities.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border/30">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    Completed ({completedOpportunities.length})
                  </h4>
                  {completedOpportunities.map((opportunity) => (
                    <OpportunityItem
                      key={opportunity.id}
                      opportunity={opportunity}
                      onToggle={() => handleToggleCompletion(opportunity)}
                      isToggling={toggleCompletion.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddOpportunityModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={handleOpportunityAdded}
      />
    </>
  );
}

interface OpportunityItemProps {
  opportunity: StoreOpportunity;
  onToggle: () => void;
  isToggling: boolean;
}

function OpportunityItem({ opportunity, onToggle, isToggling }: OpportunityItemProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
      <Checkbox
        checked={opportunity.is_completed}
        onCheckedChange={onToggle}
        disabled={isToggling}
        className="mt-1 h-6 w-6 border-2"
      />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-base font-medium ${opportunity.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {opportunity.opportunity_text}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            variant={opportunity.source === 'ai_extracted' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {opportunity.source === 'ai_extracted' ? (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                AI Detected
              </>
            ) : (
              <>
                <User className="h-3 w-3 mr-1" />
                Manual
              </>
            )}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{format(new Date(opportunity.created_at), 'MMM d, yyyy')}</span>
          </div>
          {opportunity.is_completed && opportunity.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span>Completed {format(new Date(opportunity.completed_at), 'MMM d')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

