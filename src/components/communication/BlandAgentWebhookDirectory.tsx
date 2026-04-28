import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Copy, Webhook, Bot, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface BlandAgent {
  id: string;
  agent_name: string;
  agent_type: string;
  webhook_url: string;
  is_active: boolean;
  description: string | null;
  default_voice: string | null;
  created_at: string;
}

export function BlandAgentWebhookDirectory() {
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["bland-agent-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bland_agent_webhooks" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BlandAgent[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("bland_agent_webhooks" as any)
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bland-agent-webhooks"] });
      toast.success("Agent status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Webhook URL copied");
  };

  return (
    <Card className="mt-8 border-dashed">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Agent Webhook Directory
          </CardTitle>
          <CardDescription>
            Bland AI agents wired to outbound campaigns. Each agent posts call results back to its webhook endpoint.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading agents…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Bland AI agents configured.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border bg-card p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{a.agent_name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{a.agent_type}</p>
                    </div>
                  </div>
                  <Badge
                    variant={a.is_active ? "default" : "secondary"}
                    className={a.is_active ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" : ""}
                  >
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {a.description && (
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                )}

                <div className="rounded-md bg-muted/50 px-2.5 py-2 flex items-center gap-2">
                  <code className="text-[11px] flex-1 truncate text-muted-foreground">
                    {a.webhook_url}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copy(a.webhook_url)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-xs text-muted-foreground">Voice: {a.default_voice || "maya"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enabled</span>
                    <Switch
                      checked={a.is_active}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: a.id, is_active: v })}
                      disabled={toggleMutation.isPending}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BlandAgentWebhookDirectory;
