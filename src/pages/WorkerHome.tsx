import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Zap, Trophy, Languages, FileText, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WorkerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: score } = useQuery({
    queryKey: ['my-score', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_scores')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: missions } = useQuery({
    queryKey: ['my-missions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_assignments')
        .select('*, mission_templates(*)')
        .eq('user_id', user?.id)
        .in('status', ['assigned', 'in_progress'])
        .order('due_at', { ascending: true })
        .limit(3);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: notifications } = useQuery({
    queryKey: ['mission-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('mission_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: nextStop } = useQuery({
    queryKey: ['next-stop', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id, 
          route_stops(
            id, 
            planned_order, 
            status,
            stores(id, name, address_street, address_city, lat, lng, phone)
          )
        `)
        .eq('assigned_to', user?.id)
        .eq('date', today)
        .eq('status', 'in_progress')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      const pending = data?.route_stops?.find((rs: any) => rs.status === 'pending');
      return pending?.stores;
    },
    enabled: !!user?.id,
  });

  const todayXP = notifications
    ?.filter(n => {
      const today = new Date().toDateString();
      return new Date(n.created_at).toDateString() === today;
    })
    .reduce((sum, n) => sum + n.xp_awarded, 0) || 0;

  const todayMissionsCompleted = notifications
    ?.filter(n => {
      const today = new Date().toDateString();
      return new Date(n.created_at).toDateString() === today;
    }).length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        {/* My Score */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Your Score</div>
              <div className="text-4xl font-bold">{score?.xp_total || 0} XP</div>
            </div>
            <Trophy className="w-12 h-12 text-primary" />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="text-primary border-primary/50">
              Level {score?.level || 1}
            </Badge>
            <span className="text-muted-foreground">{score?.missions_completed || 0} missions</span>
            <span className="text-muted-foreground">{score?.streak_days || 0} day streak 🔥</span>
          </div>
        </Card>

        {/* Next Stop */}
        {nextStop && (
          <Card className="p-6 border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Next Stop</h2>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold mb-2">{nextStop.name}</h3>
              <p className="text-muted-foreground">
                {nextStop.address_street}, {nextStop.address_city}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nextStop.lat},${nextStop.lng}`;
                  window.open(mapsUrl, '_blank');
                }}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Navigate
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/stores/${nextStop.id}`)}
              >
                Details
              </Button>
            </div>
          </Card>
        )}

        {/* Today's Wins */}
        {notifications && notifications.length > 0 && (
          <Card className="p-6 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Today's Wins</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-background">
                <p className="text-3xl font-bold text-primary">{todayMissionsCompleted}</p>
                <p className="text-sm text-muted-foreground">Missions</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background">
                <p className="text-3xl font-bold text-primary">{todayXP}</p>
                <p className="text-sm text-muted-foreground">XP Earned</p>
              </div>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((notif) => (
                <div key={notif.id} className="p-3 rounded-lg bg-background border text-sm">
                  <div className="font-semibold">{notif.title}</div>
                  <div className="text-muted-foreground">{notif.message}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Today's Missions */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Today's Missions</h2>
          </div>
          <div className="space-y-3">
            {missions?.map((mission) => {
              const progress = (mission.progress_current / mission.progress_target) * 100;
              return (
                <Card key={mission.id} className="p-4 border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-bold mb-1">{mission.mission_templates.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {mission.progress_current} / {mission.progress_target} completed
                      </div>
                    </div>
                    <Badge variant="outline" className="text-primary border-primary/50">
                      {mission.mission_templates.xp_reward} XP
                    </Badge>
                  </div>
                  <Progress value={progress} className="mb-2" />
                  {mission.due_at && (
                    <div className="text-xs text-muted-foreground">
                      Due: {new Date(mission.due_at).toLocaleDateString()}
                    </div>
                  )}
                </Card>
              );
            })}

            {!missions || missions.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No active missions. Check back tomorrow!
              </div>
            )}
          </div>
        </Card>

        {/* Quick Tools */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Quick Tools</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => navigate('/map')}>
              <MapPin className="w-5 h-5 mr-2" />
              Map
            </Button>
            <Button variant="outline" onClick={() => navigate('/stores')}>
              <FileText className="w-5 h-5 mr-2" />
              Stores
            </Button>
            <Button variant="outline" onClick={() => navigate('/driver')}>
              <AlertTriangle className="w-5 h-5 mr-2" />
              My Route
            </Button>
            <Button variant="outline">
              <Languages className="w-5 h-5 mr-2" />
              Translator
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}