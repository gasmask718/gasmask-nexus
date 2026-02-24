import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Phone, Radio } from "lucide-react";
import { VoiceCallDialog } from "@/components/communication/VoiceCallDialog";

interface VoiceMatrixRow {
  id: string;
  brand_key: string;
  persona_name: string;
  elevenlabs_agent_id: string | null;
  active: boolean | null;
}

export function VoiceBrowserTest() {
  const { currentBusiness } = useBusiness();
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [callDialogOpen, setCallDialogOpen] = useState(false);

  const { data: personas = [] } = useQuery({
    queryKey: ["voice-matrix-agents", currentBusiness?.id],
    queryFn: async () => {
      const query = supabase
        .from("voice_matrix")
        .select("id, brand_key, persona_name, elevenlabs_agent_id, active")
        .eq("active", true)
        .order("brand_key");
      if (currentBusiness?.id) {
        query.or(`business_id.eq.${currentBusiness.id},business_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as VoiceMatrixRow[];
    },
  });

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Mic className="h-6 w-6 text-primary" />
          Browser Voice Test
        </h2>
        <p className="text-muted-foreground">
          Test ElevenLabs conversational agents live from your browser using WebRTC
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Select Persona</label>
              <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a persona with an Agent ID…" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{p.brand_key}</Badge>
                        {p.persona_name}
                        {!p.elevenlabs_agent_id && (
                          <span className="text-xs text-muted-foreground">(no agent ID)</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setCallDialogOpen(true)}
              disabled={!selectedPersona?.elevenlabs_agent_id}
              className="gap-2"
            >
              <Phone className="h-4 w-4" />
              Start Conversation
            </Button>
          </div>

          {personas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active personas found in the Voice Matrix.</p>
              <p className="text-sm">Create personas in the Personas & Providers tab first.</p>
            </div>
          )}

          {selectedPersona && !selectedPersona.elevenlabs_agent_id && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
              <p className="font-medium text-destructive">Agent ID Missing</p>
              <p className="text-muted-foreground mt-1">
                This persona doesn't have an ElevenLabs Agent ID configured. 
                Go to <strong>Personas & Providers → Edit</strong> and add your Agent ID from the 
                <a href="https://elevenlabs.io" target="_blank" rel="noopener" className="underline ml-1">ElevenLabs dashboard</a>.
              </p>
            </div>
          )}

          {selectedPersona && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p><strong>Agent ID:</strong> <code className="text-xs">{selectedPersona.elevenlabs_agent_id}</code></p>
              <p className="text-muted-foreground mt-1">
                This will open a live WebRTC conversation with the ElevenLabs agent. 
                You'll need to allow microphone access.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPersona?.elevenlabs_agent_id && (
        <VoiceCallDialog
          open={callDialogOpen}
          onOpenChange={setCallDialogOpen}
          agentName={selectedPersona.persona_name}
          elevenlabsAgentId={selectedPersona.elevenlabs_agent_id}
        />
      )}
    </div>
  );
}