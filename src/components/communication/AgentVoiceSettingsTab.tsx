import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VoiceProviderSelector } from "@/components/communication/VoiceProviderSelector";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Bot } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface AgentRow {
  id: string;
  name: string;
  role: string;
  voice_provider: string | null;
  voice_mode: string | null;
}

export function AgentVoiceSettingsTab() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["ai-agents-voice", currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, role, voice_provider, voice_mode")
        .eq("business_id", currentBusiness!.id)
        .order("name");
      if (error) throw error;
      return (data || []) as AgentRow[];
    },
    enabled: !!currentBusiness?.id,
  });

  if (isLoading) {
    return <p className="text-muted-foreground p-4">Loading agents...</p>;
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No AI agents found. Create agents first, then configure their voice engines here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {agents.map((agent) => (
        <AgentVoiceCard key={agent.id} agent={agent} queryClient={queryClient} />
      ))}
    </div>
  );
}

function AgentVoiceCard({ agent, queryClient }: { agent: AgentRow; queryClient: ReturnType<typeof useQueryClient> }) {
  const [provider, setProvider] = useState(agent.voice_provider || "auto");
  const [mode, setMode] = useState(agent.voice_mode || "balanced");

  useEffect(() => {
    setProvider(agent.voice_provider || "auto");
    setMode(agent.voice_mode || "balanced");
  }, [agent.voice_provider, agent.voice_mode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ voice_provider: provider, voice_mode: mode } as any)
        .eq("id", agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Voice settings saved for ${agent.name}`);
      queryClient.invalidateQueries({ queryKey: ["ai-agents-voice"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> {agent.name}
        </CardTitle>
        <CardDescription className="capitalize">{agent.role}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <VoiceProviderSelector
          provider={provider}
          onProviderChange={setProvider}
          mode={mode}
          onModeChange={setMode}
          label="Voice Engine"
        />
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="h-3.5 w-3.5" />
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
