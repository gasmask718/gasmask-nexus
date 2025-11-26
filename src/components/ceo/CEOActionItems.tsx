import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, UserPlus, Calendar, Send, BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ActionStatus = "open" | "in_progress" | "completed" | "delegated";

export function CEOActionItems() {
  const [filter, setFilter] = useState<ActionStatus>("open");
  const queryClient = useQueryClient();

  const { data: recommendations } = useQuery({
    queryKey: ['ceo-recommendations', filter],
    queryFn: async () => {
      let query = supabase
        .from('ai_recommendations')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'completed') {
        query = query.not('actioned_at', 'is', null);
      } else if (filter === 'open') {
        query = query.is('actioned_at', null);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    }
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_recommendations')
        .update({ 
          status: 'actioned',
          actioned_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceo-recommendations'] });
      toast.success("Action marked as complete");
    }
  });

  const delegateToVAMutation = useMutation({
    mutationFn: async ({ id, vaId }: { id: string; vaId: string }) => {
      const { error } = await supabase
        .from('ai_recommendations')
        .update({ 
          status: 'delegated',
          actioned_by: vaId,
          actioned_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceo-recommendations'] });
      toast.success("Delegated to VA");
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Action Items</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{recommendations?.length || 0} items</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ActionStatus)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="delegated">Delegated</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-4 mt-4">
            {recommendations?.map((rec) => (
              <div key={rec.id} className="flex items-start gap-4 p-4 border rounded-lg">
                <Checkbox 
                  checked={rec.status === 'actioned'}
                  onCheckedChange={() => markCompleteMutation.mutate(rec.id)}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{rec.title}</p>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                    </div>
                    <Badge variant={
                      rec.severity === 'high' ? 'destructive' : 
                      rec.severity === 'medium' ? 'default' : 
                      'outline'
                    }>
                      {rec.severity}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => markCompleteMutation.mutate(rec.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => delegateToVAMutation.mutate({ id: rec.id, vaId: 'va-1' })}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Delegate
                    </Button>
                    
                    <Button size="sm" variant="outline">
                      <Calendar className="h-3 w-3 mr-1" />
                      Follow-Up
                    </Button>
                    
                    <Button size="sm" variant="outline">
                      <Send className="h-3 w-3 mr-1" />
                      Send to Brand
                    </Button>
                    
                    <Button size="sm" variant="outline">
                      <BookmarkPlus className="h-3 w-3 mr-1" />
                      Save Note
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {!recommendations || recommendations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No {filter} actions
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
