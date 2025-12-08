import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  Percent,
  Store,
  Clock,
  Edit
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ApprovalsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pendingDeals, isLoading: dealsLoading } = useQuery({
    queryKey: ['pending-approval-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          store:store_master(store_name, address),
          business:businesses(name)
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingRefunds, isLoading: refundsLoading } = useQuery({
    queryKey: ['pending-approval-refunds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refund_tickets')
        .select(`
          *,
          store:store_master(store_name),
          business:businesses(name),
          deal:deals(expected_value)
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const approveDealMutation = useMutation({
    mutationFn: async ({ dealId, approved }: { dealId: string; approved: boolean }) => {
      const { error } = await supabase
        .from('deals')
        .update({ 
          status: approved ? 'won' : 'lost',
          closed_at: new Date().toISOString()
        })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ['pending-approval-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-stats'] });
      toast({
        title: approved ? 'Deal Approved' : 'Deal Declined',
        description: approved ? 'The deal has been approved and sent to dispatch.' : 'The deal has been declined.',
      });
    },
  });

  const isLoading = dealsLoading || refundsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalPending = (pendingDeals?.length || 0) + (pendingRefunds?.length || 0);

  return (
    <div className="space-y-6">
      {totalPending === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm">No pending approvals at this time</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Deal Approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Deal Approvals
                {pendingDeals && pendingDeals.length > 0 && (
                  <Badge variant="destructive">{pendingDeals.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Deals requiring human approval (discounts, high value, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {pendingDeals?.map((deal) => (
                    <div key={deal.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{deal.store?.store_name}</p>
                          <p className="text-sm text-muted-foreground">{deal.business?.name}</p>
                        </div>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                          Pending
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Value: ${Number(deal.expected_value || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                          <span>Discount: {deal.discount_percent || 0}%</span>
                        </div>
                      </div>

                      {deal.notes && (
                        <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                          AI Note: {deal.notes}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => approveDealMutation.mutate({ dealId: deal.id, approved: true })}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4 mr-2" />
                          Modify
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => approveDealMutation.mutate({ dealId: deal.id, approved: false })}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {(!pendingDeals || pendingDeals.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No pending deal approvals</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Refund Approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Refund Approvals
                {pendingRefunds && pendingRefunds.length > 0 && (
                  <Badge variant="destructive">{pendingRefunds.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Refund requests requiring approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {pendingRefunds?.map((refund) => (
                    <div key={refund.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{refund.store?.store_name}</p>
                          <p className="text-sm text-muted-foreground">{refund.business?.name}</p>
                        </div>
                        <Badge variant="outline" className="bg-red-500/10 text-red-500">
                          ${Number(refund.amount).toLocaleString()}
                        </Badge>
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-1">Reason:</p>
                        <p className="text-sm text-muted-foreground">{refund.reason}</p>
                      </div>

                      {refund.ai_suggestion && (
                        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                          <p className="text-sm font-medium mb-1 text-blue-500">AI Suggestion:</p>
                          <p className="text-sm">{refund.ai_suggestion}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          Counter Offer
                        </Button>
                        <Button size="sm" variant="destructive">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {(!pendingRefunds || pendingRefunds.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No pending refund approvals</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
