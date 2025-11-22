import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, TrendingDown, Users, AlertTriangle, MessageCircle, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Missions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: mission, isLoading } = useQuery({
    queryKey: ['daily-mission', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_missions')
        .select(`
          *,
          mission_items(
            *,
            stores(*),
            influencers(*),
            wholesale_hubs:hub_id(*)
          )
        `)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const generateMission = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-missions');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-mission'] });
      toast({ title: "New mission generated!" });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string, completed: boolean }) => {
      const { error } = await supabase
        .from('mission_items')
        .update({ completed })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-mission'] });
    },
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'low_inventory': return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'predicted_stockout': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'prospect': return <Target className="w-5 h-5 text-blue-500" />;
      case 'failing_store': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'influencer_outreach': return <MessageCircle className="w-5 h-5 text-purple-500" />;
      case 'wholesale_hub': return <Package className="w-5 h-5 text-green-500" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    return category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading today's mission...</div>;
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No Mission for Today</h2>
          <p className="text-muted-foreground mb-4">Generate today's tactical brief to get started</p>
          <Button onClick={() => generateMission.mutate()} disabled={generateMission.isPending}>
            {generateMission.isPending ? 'Generating...' : 'Generate Mission'}
          </Button>
        </Card>
      </div>
    );
  }

  const groupedItems = mission.mission_items?.reduce((acc: any, item: any) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const completedCount = mission.mission_items?.filter((i: any) => i.completed).length || 0;
  const totalCount = mission.mission_items?.length || 0;
  const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Today's Mission</h1>
          <p className="text-muted-foreground">
            {new Date(mission.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <div className="mt-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-lg px-4 py-1">
                {completedCount} / {totalCount} Complete
              </Badge>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {Object.entries(groupedItems || {}).map(([category, items]: [string, any]) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-4">
                {getCategoryIcon(category)}
                <h2 className="text-2xl font-bold">{getCategoryLabel(category)}</h2>
                <Badge variant="secondary" className="ml-auto">
                  {items.filter((i: any) => !i.completed).length} remaining
                </Badge>
              </div>

              <div className="grid gap-4">
                {items
                  .sort((a: any, b: any) => b.priority - a.priority)
                  .map((item: any) => (
                    <Card
                      key={item.id}
                      className={`p-4 transition-all ${
                        item.completed ? 'opacity-50 bg-muted/50' : 'hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={(checked) => 
                            toggleComplete.mutate({ id: item.id, completed: checked as boolean })
                          }
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">Priority {item.priority}</Badge>
                            {item.stores && (
                              <span className="font-semibold">{item.stores.name}</span>
                            )}
                            {item.influencers && (
                              <span className="font-semibold">@{item.influencers.username}</span>
                            )}
                            {item.wholesale_hubs && (
                              <span className="font-semibold">{item.wholesale_hubs.name}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.reason}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}