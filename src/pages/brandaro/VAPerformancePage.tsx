import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, TrendingUp, Target, Award, Flame, BarChart3 } from "lucide-react";

export default function VAPerformancePage() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const { data: myStats } = useQuery({
    queryKey: ["brandaro-my-performance"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [todayRes, weekRes] = await Promise.all([
        supabase.from("brandaro_call_logs").select("call_outcome").eq("called_by_user_id", user.id).gte("call_timestamp", today),
        supabase.from("brandaro_call_logs").select("call_outcome").eq("called_by_user_id", user.id).gte("call_timestamp", weekAgo),
      ]);

      const todayLogs = todayRes.data || [];
      const weekLogs = weekRes.data || [];
      const count = (logs: any[], outcomes: string[]) => logs.filter(l => outcomes.includes(l.call_outcome)).length;

      return {
        callsToday: todayLogs.length,
        callsWeek: weekLogs.length,
        conversationsToday: count(todayLogs, ["interested", "hot_lead", "sold", "callback_requested", "send_information", "not_interested"]),
        interestedToday: count(todayLogs, ["interested", "hot_lead"]),
        interestedWeek: count(weekLogs, ["interested", "hot_lead"]),
        soldToday: count(todayLogs, ["sold"]),
        soldWeek: count(weekLogs, ["sold"]),
      };
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["brandaro-my-recent-logs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("brandaro_call_logs")
        .select("*, brandaro_qualified_leads(business_name, industry, city)")
        .eq("called_by_user_id", user.id)
        .order("call_timestamp", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data || [];
    },
  });

  const outcomeColor = (o: string) => {
    if (["interested", "hot_lead", "sold"].includes(o)) return "default";
    if (["wrong_number", "do_not_call", "not_interested"].includes(o)) return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">VA Performance</h1>
        <p className="text-muted-foreground">Your personal calling metrics and activity log</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{myStats?.callsToday || 0}</p>
                <p className="text-xs text-muted-foreground">Calls Today</p>
                <p className="text-xs text-muted-foreground">{myStats?.callsWeek || 0} this week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{myStats?.conversationsToday || 0}</p>
                <p className="text-xs text-muted-foreground">Conversations Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-2xl font-bold">{myStats?.interestedToday || 0}</p>
                <p className="text-xs text-muted-foreground">Interested Today</p>
                <p className="text-xs text-muted-foreground">{myStats?.interestedWeek || 0} this week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{myStats?.soldToday || 0}</p>
                <p className="text-xs text-muted-foreground">Deals Today</p>
                <p className="text-xs text-muted-foreground">{myStats?.soldWeek || 0} this week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Recent Call Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{new Date(log.call_timestamp).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{log.brandaro_qualified_leads?.business_name || "—"}</TableCell>
                  <TableCell>{log.brandaro_qualified_leads?.industry || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={outcomeColor(log.call_outcome) as any}>{log.call_outcome}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {log.call_notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
