import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Phone, Users, CheckCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay } from "date-fns";

export default function SalesReport() {
  const navigate = useNavigate();
  const today = new Date();

  const { data: prospects } = useQuery({
    queryKey: ['sales-prospects-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_prospects')
        .select('*')
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: todayCommunications } = useQuery({
    queryKey: ['sales-communications-today'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('*')
        .eq('linked_entity_type', 'prospect')
        .gte('created_at', startOfDay(today).toISOString())
        .lte('created_at', endOfDay(today).toISOString());
      
      if (error) throw error;
      return data;
    }
  });

  const newProspectsToday = prospects?.filter(p => {
    const createdDate = new Date(p.created_at);
    return createdDate >= startOfDay(today) && createdDate <= endOfDay(today);
  }).length || 0;

  const conversionsToday = prospects?.filter(p => {
    const updatedDate = new Date(p.updated_at);
    return p.pipeline_stage === 'activated' &&
           updatedDate >= startOfDay(today) &&
           updatedDate <= endOfDay(today);
  }).length || 0;

  const followUpsDue = prospects?.filter(p => {
    if (!p.next_follow_up) return false;
    const followUpDate = new Date(p.next_follow_up);
    return followUpDate >= startOfDay(today) && followUpDate <= endOfDay(today);
  }) || [];

  const topProspects = prospects
    ?.filter(p => p.pipeline_stage !== 'closed-lost' && p.pipeline_stage !== 'activated')
    ?.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    ?.slice(0, 5) || [];

  const getPriorityColor = (priority: number) => {
    if (priority >= 70) return 'text-red-500';
    if (priority >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Daily Sales Report</h1>
          <p className="text-muted-foreground mt-2">
            {format(today, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Today's Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Contacts Made</CardDescription>
              <CardTitle className="text-3xl">{todayCommunications?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Communications today
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Follow-ups Due</CardDescription>
              <CardTitle className="text-3xl">{followUpsDue.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Scheduled for today
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New Prospects</CardDescription>
              <CardTitle className="text-3xl">{newProspectsToday}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Added today
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversions</CardDescription>
              <CardTitle className="text-3xl">{conversionsToday}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Activated today
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Follow-ups Due Today */}
        {followUpsDue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups Due Today</CardTitle>
              <CardDescription>Prospects requiring attention today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {followUpsDue.map((prospect: any) => (
                  <div
                    key={prospect.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/sales/prospects/${prospect.id}`)}
                  >
                    <div>
                      <h4 className="font-semibold">{prospect.store_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {prospect.city}, {prospect.state}
                      </p>
                    </div>
                    <Badge>{prospect.pipeline_stage}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Top 5 Prospects to Push */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Top 5 Prospects to Push
            </CardTitle>
            <CardDescription>Highest priority prospects right now</CardDescription>
          </CardHeader>
          <CardContent>
            {topProspects.length > 0 ? (
              <div className="space-y-3">
                {topProspects.map((prospect: any) => (
                  <div
                    key={prospect.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/sales/prospects/${prospect.id}`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{prospect.store_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {prospect.contact_name} • {prospect.city}, {prospect.state}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getPriorityColor(prospect.priority || 0)}`}>
                          {prospect.priority || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Priority</div>
                      </div>
                      <Badge>{prospect.pipeline_stage}</Badge>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{prospect.likelihood_to_activate || 0}%</div>
                        <div className="text-xs text-muted-foreground">Likely</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No active prospects
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}