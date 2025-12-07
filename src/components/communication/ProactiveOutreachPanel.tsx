import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, Clock, CheckCircle, XCircle, Zap } from "lucide-react";

interface ProactiveOutreachPanelProps {
  businessId?: string;
}

export default function ProactiveOutreachPanel({ businessId }: ProactiveOutreachPanelProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  const { data: outreachLog = [] } = useQuery({
    queryKey: ["proactive-outreach", businessId],
    queryFn: async () => {
      let query = supabase
        .from("proactive_outreach_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle className="text-green-500" size={14} />;
      case "failed": return <XCircle className="text-red-500" size={14} />;
      case "pending": return <Clock className="text-yellow-500" size={14} />;
      default: return <Clock className="text-muted-foreground" size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Bot className="text-primary" size={24} />
              </div>
              <div>
                <h3 className="font-semibold">Proactive AI Outreach</h3>
                <p className="text-sm text-muted-foreground">
                  AI will automatically reach out to stores that need attention
                </p>
              </div>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Trigger Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap size={18} />
            Outreach Triggers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm">Store going cold (7+ days no contact)</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm">Negative sentiment trend detected</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm">Low engagement score (&lt;40)</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm">Missed follow-up opportunity</span>
              <Switch />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm">New product announcements</span>
              <Switch />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm">Re-engagement after complaint resolved</span>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outreach Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send size={18} />
            Recent AI Outreach
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outreachLog.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No proactive outreach sent yet
            </p>
          ) : (
            <div className="space-y-3">
              {outreachLog.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  {statusIcon(log.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {log.trigger_reason}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {log.channel}
                      </Badge>
                    </div>
                    {log.message_sent && (
                      <p className="text-sm text-muted-foreground truncate">
                        {log.message_sent}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
