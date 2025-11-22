import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Mail, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { subDays } from "date-fns";

export function CommunicationWidget() {
  const { data: stats } = useQuery({
    queryKey: ["communication-widget-stats"],
    queryFn: async () => {
      const yesterday = subDays(new Date(), 1);

      // Get communications in last 24hrs
      const { data: recentComms } = await supabase
        .from("communication_events")
        .select("channel, direction")
        .gte("created_at", yesterday.toISOString());

      // Get pending follow-ups
      const { data: pendingFollowUps } = await supabase
        .from("ai_communication_queue")
        .select("id")
        .eq("status", "pending");

      // Count by channel and direction
      const smsCount = recentComms?.filter((c) => c.channel === "sms").length || 0;
      const callCount = recentComms?.filter((c) => c.channel === "call").length || 0;
      const emailCount = recentComms?.filter((c) => c.channel === "email").length || 0;
      const missedCalls =
        recentComms?.filter((c) => c.channel === "call" && c.direction === "inbound").length || 0;

      return {
        total: recentComms?.length || 0,
        sms: smsCount,
        calls: callCount,
        emails: emailCount,
        missedCalls,
        pendingReplies: pendingFollowUps?.length || 0,
      };
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Communications</CardTitle>
          <Link to="/communications">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-destructive">{stats?.pendingReplies || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>SMS</span>
            </div>
            <Badge variant="secondary">{stats?.sms || 0}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span>Calls</span>
            </div>
            <Badge variant="secondary">{stats?.calls || 0}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span>Emails</span>
            </div>
            <Badge variant="secondary">{stats?.emails || 0}</Badge>
          </div>
        </div>

        {stats && stats.missedCalls > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{stats.missedCalls} missed calls</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/communications">
              <MessageSquare className="h-4 w-4 mr-1" />
              New SMS
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/communications">
              <Phone className="h-4 w-4 mr-1" />
              Log Call
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}