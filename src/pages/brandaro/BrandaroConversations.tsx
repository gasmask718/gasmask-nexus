import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, Send, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BrandaroConversations() {
  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: ["brandaro-conversations-sms"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_message_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: aiCalls = [], isLoading: callLoading } = useQuery({
    queryKey: ["brandaro-conversations-calls"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_ai_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conversations</h1>
          <p className="text-sm text-muted-foreground">SMS messages and AI call transcripts</p>
        </div>
      </div>

      <Tabs defaultValue="sms" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="sms">💬 SMS ({messages.length})</TabsTrigger>
          <TabsTrigger value="calls">📞 AI Calls ({aiCalls.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sms">
          {msgLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : messages.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Send className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No SMS messages yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {messages.map((msg: any) => (
                <Card key={msg.id} className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{msg.to_phone || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{msg.message_body}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={
                          msg.send_status === "sent" ? "bg-emerald-500/20 text-emerald-400" :
                          msg.send_status === "failed" ? "bg-red-500/20 text-red-400" :
                          "bg-muted text-muted-foreground"
                        }>{msg.send_status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calls">
          {callLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : aiCalls.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No AI calls yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {aiCalls.map((call: any) => (
                <Card key={call.id} className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{call.lead_phone || "Unknown"}</p>
                        {call.transcript && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{call.transcript}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className="text-xs" variant="secondary">{call.language === "spanish" ? "🇪🇸" : "🇺🇸"} {call.language}</Badge>
                        <Badge className={
                          call.interest_level === "high" ? "bg-emerald-500/20 text-emerald-400" :
                          call.interest_level === "medium" ? "bg-amber-500/20 text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }>{call.interest_level || call.status}</Badge>
                        {call.duration_seconds && <span className="text-xs text-muted-foreground">{call.duration_seconds}s</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
