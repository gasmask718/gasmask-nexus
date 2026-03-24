import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Play, Pause, Archive, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function DCCampaigns() {
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['dc-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('ai_call_campaigns')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-campaigns'] });
      toast.success('Campaign updated');
    },
  });

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-500/10 text-green-500 border-green-500';
    if (s === 'paused') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500';
    if (s === 'completed') return 'bg-blue-500/10 text-blue-500 border-blue-500';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" /> Campaign Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {campaigns.length} campaigns · {campaigns.filter((c: any) => c.status === 'active').length} active
          </p>
        </div>
        <Link to="/dynasty-connect/campaigns/builder">
          <Button><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading campaigns…</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold truncate">{c.name}</p>
                      <Badge variant="outline" className={statusColor(c.status || 'draft')}>
                        {c.status || 'draft'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Targets: {c.total_targets || 0}</span>
                      <span>Completed: {c.completed_calls || 0}</span>
                      <span>Conversions: {c.conversion_count || 0}</span>
                      {c.target_segment && <span>Segment: {c.target_segment}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === 'active' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'paused' })}>
                        <Pause className="h-3 w-3 mr-1" /> Pause
                      </Button>
                    )}
                    {(c.status === 'paused' || c.status === 'draft') && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: 'active' })}>
                        <Play className="h-3 w-3 mr-1" /> Activate
                      </Button>
                    )}
                    {c.status !== 'archived' && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: c.id, status: 'archived' })}>
                        <Archive className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
