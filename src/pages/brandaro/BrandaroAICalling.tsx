import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Phone, Globe, Loader2, BarChart3, Play, Volume2 } from "lucide-react";

export default function BrandaroAICalling() {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState("spanish");
  const [batchSize, setBatchSize] = useState("5");

  const { data: aiCalls = [], isLoading } = useQuery({
    queryKey: ["brandaro-ai-calls-page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_ai_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const stats = {
    total: aiCalls.length,
    completed: aiCalls.filter((c: any) => c.status === "completed").length,
    interested: aiCalls.filter((c: any) => ["medium", "high"].includes(c.interest_level)).length,
    spanish: aiCalls.filter((c: any) => c.language === "spanish").length,
    english: aiCalls.filter((c: any) => c.language === "english").length,
  };

  const launchCalls = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("brandaro-ai-caller", {
        body: { language, batch_size: parseInt(batchSize) },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-ai-calls-page"] });
      toast.success(`Launched ${batchSize} AI calls (${language})`);
    },
    onError: () => toast.error("Failed to launch AI calls"),
  });

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <Bot className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Calling Engine</h1>
          <p className="text-sm text-muted-foreground">Launch and monitor AI-powered outbound calls</p>
        </div>
      </div>

      {/* Controls */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Launch AI Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Language</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spanish">🇪🇸 Spanish</SelectItem>
                  <SelectItem value="english">🇺🇸 English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Batch Size</label>
              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["5", "10", "20", "50"].map((s) => (
                    <SelectItem key={s} value={s}>{s} calls</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => launchCalls.mutate()} disabled={launchCalls.isPending}>
              {launchCalls.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Launch Calls
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Calls", value: stats.total, icon: Phone, accent: "text-primary" },
          { label: "Completed", value: stats.completed, icon: BarChart3, accent: "text-emerald-400" },
          { label: "Interested", value: stats.interested, icon: Volume2, accent: "text-amber-400" },
          { label: "Spanish", value: stats.spanish, icon: Globe, accent: "text-cyan-400" },
          { label: "English", value: stats.english, icon: Globe, accent: "text-blue-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <s.icon className={`h-5 w-5 ${s.accent} mx-auto mb-1`} />
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Calls Log */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent AI Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : aiCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No AI calls yet. Launch your first batch above.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {aiCalls.map((call: any) => (
                <div key={call.id} className="flex items-center justify-between text-sm bg-muted/30 rounded p-2.5 border border-border">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">{call.language === "spanish" ? "🇪🇸" : "🇺🇸"}</Badge>
                    <span className="text-muted-foreground">{call.lead_phone || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      call.interest_level === "high" ? "bg-emerald-500/20 text-emerald-400" :
                      call.interest_level === "medium" ? "bg-amber-500/20 text-amber-400" :
                      "bg-muted text-muted-foreground"
                    }>
                      {call.interest_level || call.status}
                    </Badge>
                    {call.duration_seconds && <span className="text-xs text-muted-foreground">{call.duration_seconds}s</span>}
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
