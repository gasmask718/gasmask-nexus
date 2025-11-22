import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Trophy, Zap, Target } from "lucide-react";
import { useState } from "react";

export default function MissionsHQ() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("drivers");

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', selectedTab],
    queryFn: async () => {
      const role = selectedTab === 'drivers' ? 'driver' : selectedTab === 'bikers' ? 'biker' : 'ambassador';
      const { data, error } = await supabase
        .from('worker_scores')
        .select('*, profiles(name, email)')
        .eq('role', role)
        .order('xp_total', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['mission-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const assignMissions = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('missions-engine', {
        body: { action: 'assignDailyMissions' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission-assignments'] });
    },
  });

  const getLevelColor = (level: number) => {
    if (level >= 10) return "text-purple-500";
    if (level >= 5) return "text-primary";
    return "text-yellow-500";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-foreground">Missions HQ</h1>
            <p className="text-muted-foreground">Gamified performance tracking & mission control</p>
          </div>
          <Button onClick={() => assignMissions.mutate()}>
            <Zap className="w-4 h-4 mr-2" />
            Assign Daily Missions
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Leaderboard */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Leaderboard</h2>
            </div>

            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="drivers">Drivers</TabsTrigger>
                <TabsTrigger value="bikers">Bikers</TabsTrigger>
                <TabsTrigger value="ambassadors">Ambassadors</TabsTrigger>
              </TabsList>

              <TabsContent value={selectedTab}>
                <div className="space-y-3">
                  {leaderboard?.map((worker, idx) => (
                    <Card key={worker.id} className="p-4 border-border/50 hover:border-primary/50 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-muted-foreground">#{idx + 1}</div>
                          <div>
                            <div className="font-bold">{worker.profiles?.name || 'Unknown'}</div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>Level {worker.level}</span>
                              <span>•</span>
                              <span>{worker.missions_completed} missions</span>
                              <span>•</span>
                              <span>{worker.streak_days} day streak</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getLevelColor(worker.level)}`}>
                            {worker.xp_total.toLocaleString()} XP
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {worker.stores_activated} stores activated
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Mission Templates */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Active Templates</h2>
            </div>

            <div className="space-y-3">
              {templates?.filter(t => t.is_active).slice(0, 10).map((template) => (
                <Card key={template.id} className="p-3 border-border/50">
                  <div className="font-medium mb-1">{template.name}</div>
                  <div className="flex items-center justify-between text-sm">
                    <Badge variant="outline" className="text-xs">{template.role}</Badge>
                    <span className="text-primary font-bold">{template.xp_reward} XP</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Target: {template.target_count} {template.mission_type}
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}