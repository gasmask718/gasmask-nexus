import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Save, ExternalLink, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ElevenLabsAgent {
  id: string;
  agent_name: string;
  elevenlabs_agent_id: string | null;
  script_template_key: string;
  script_label: string;
  agent_description: string | null;
  system_prompt: string | null;
  first_message: string | null;
  voice_id: string | null;
  voice_name: string | null;
  language: string | null;
  is_active: boolean;
  sort_order: number;
}

export function ElevenLabsAgentSetup() {
  const queryClient = useQueryClient();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Partial<ElevenLabsAgent>>>({});

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["elevenlabs-agents-setup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elevenlabs_agents")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as ElevenLabsAgent[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ElevenLabsAgent> }) => {
      const { error } = await supabase
        .from("elevenlabs_agents")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent updated");
      queryClient.invalidateQueries({ queryKey: ["elevenlabs-agents-setup"] });
    },
    onError: (e) => toast.error(`Update failed: ${e.message}`),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("elevenlabs_agents")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elevenlabs-agents-setup"] });
    },
  });

  const getEditValue = (agentId: string, field: keyof ElevenLabsAgent, fallback: string) => {
    return editValues[agentId]?.[field as string] ?? fallback;
  };

  const setEditValue = (agentId: string, field: string, value: string) => {
    setEditValues((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [field]: value },
    }));
  };

  const saveAgent = (agent: ElevenLabsAgent) => {
    const edits = editValues[agent.id];
    if (!edits) return;
    updateMutation.mutate({ id: agent.id, updates: edits });
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[agent.id];
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Setup Instructions */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5" />
            ElevenLabs Agent Setup Guide
          </CardTitle>
          <CardDescription>
            Create one ElevenLabs Conversational AI agent per script template. Each agent handles a specific call type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full p-0">1</Badge>
              <div>
                <p className="font-medium">Go to <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">ElevenLabs Dashboard <ExternalLink className="h-3 w-3" /></a></p>
                <p className="text-muted-foreground">Navigate to Conversational AI → Agents</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full p-0">2</Badge>
              <div>
                <p className="font-medium">Create a new agent for each script type below</p>
                <p className="text-muted-foreground">Copy the System Prompt and First Message from each card into the ElevenLabs agent config</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full p-0">3</Badge>
              <div>
                <p className="font-medium">Enable Twilio integration on each agent</p>
                <p className="text-muted-foreground">In ElevenLabs: Agent Settings → Phone → Enable Twilio → Copy the Agent ID</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full p-0">4</Badge>
              <div>
                <p className="font-medium">Paste the Agent ID into each card below</p>
                <p className="text-muted-foreground">The agent ID looks like: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">agent_xxxxxxxxxxxxxxxxxxxx</code></p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full p-0">5</Badge>
              <div>
                <p className="font-medium">Set dynamic variables in ElevenLabs</p>
                <p className="text-muted-foreground">
                  Add these dynamic variables: <code className="bg-muted px-1 rounded text-xs">call_sid</code>, <code className="bg-muted px-1 rounded text-xs">handoff_url</code>, <code className="bg-muted px-1 rounded text-xs">handoff_number</code>, <code className="bg-muted px-1 rounded text-xs">business_name</code>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Cards */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const isExpanded = expandedAgent === agent.id;
          const hasEdits = !!editValues[agent.id];
          const isConfigured = !!agent.elevenlabs_agent_id;

          return (
            <Card key={agent.id} className={`transition-all ${!agent.is_active ? "opacity-60" : ""} ${isConfigured ? "border-green-500/30" : "border-amber-500/30"}`}>
              <CardContent className="p-4">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}>
                    <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isConfigured ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                      <Bot className={`h-4 w-4 ${isConfigured ? "text-green-600" : "text-amber-600"}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{agent.agent_name}</h3>
                        <Badge variant="outline" className="text-[10px]">{agent.script_label}</Badge>
                        {isConfigured ? (
                          <Badge className="bg-green-500/10 text-green-700 border-green-500/30 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Connected
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-0.5" /> Needs Agent ID
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{agent.agent_description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={agent.is_active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: agent.id, is_active: checked })}
                  />
                </div>

                {/* Expanded Config */}
                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t pt-3">
                    {/* Agent ID */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">ElevenLabs Agent ID</label>
                      <Input
                        placeholder="agent_xxxxxxxxxxxxxxxxxxxx"
                        value={getEditValue(agent.id, "elevenlabs_agent_id", agent.elevenlabs_agent_id || "") as string}
                        onChange={(e) => setEditValue(agent.id, "elevenlabs_agent_id", e.target.value)}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>

                    {/* System Prompt */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted-foreground">System Prompt (copy to ElevenLabs)</label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => copyToClipboard(agent.system_prompt || "")}>
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </div>
                      <Textarea
                        value={getEditValue(agent.id, "system_prompt", agent.system_prompt || "") as string}
                        onChange={(e) => setEditValue(agent.id, "system_prompt", e.target.value)}
                        rows={4}
                        className="text-xs"
                      />
                    </div>

                    {/* First Message */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted-foreground">First Message (copy to ElevenLabs)</label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => copyToClipboard(agent.first_message || "")}>
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </div>
                      <Textarea
                        value={getEditValue(agent.id, "first_message", agent.first_message || "") as string}
                        onChange={(e) => setEditValue(agent.id, "first_message", e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                    </div>

                    {/* Voice */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Voice Name</label>
                        <Input
                          placeholder="e.g. Roger, Sarah"
                          value={getEditValue(agent.id, "voice_name", agent.voice_name || "") as string}
                          onChange={(e) => setEditValue(agent.id, "voice_name", e.target.value)}
                          className="mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Voice ID</label>
                        <Input
                          placeholder="ElevenLabs Voice ID"
                          value={getEditValue(agent.id, "voice_id", agent.voice_id || "") as string}
                          onChange={(e) => setEditValue(agent.id, "voice_id", e.target.value)}
                          className="mt-1 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    {hasEdits && (
                      <Button size="sm" className="gap-1.5" onClick={() => saveAgent(agent)} disabled={updateMutation.isPending}>
                        <Save className="h-3.5 w-3.5" />
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
