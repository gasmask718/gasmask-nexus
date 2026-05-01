import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, Play, Square, Loader2, Zap, Mic } from "lucide-react";
import { toast } from "sonner";
import { generateVoiceResponse, type VoiceProvider } from "@/services/voiceProviderRouter";
import { useBusiness } from "@/contexts/BusinessContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function VoiceTestConsole() {
  const { currentBusiness } = useBusiness();
  const [text, setText] = useState("Hi, this is a voice test from Dynasty OS. How can I help you today?");
  const [provider, setProvider] = useState<VoiceProvider>("aws_polly");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    provider: VoiceProvider;
    latencyMs: number;
    wasFallback: boolean;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: personas = [] } = useQuery({
    queryKey: ["voice-matrix-test", currentBusiness?.id],
    queryFn: async () => {
      const query = supabase
        .from("voice_matrix")
        .select("id, brand_key, persona_name, aws_voice_id, active")
        .eq("active", true)
        .order("brand_key");
      if (currentBusiness?.id) {
        query.or(`business_id.eq.${currentBusiness.id},business_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  const handleTest = async () => {
    if (!text.trim()) {
      toast.error("Enter text to synthesize");
      return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const voiceId = selectedPersona?.aws_voice_id || undefined;

      const result = await generateVoiceResponse({
        text: text.trim(),
        provider,
        voiceId: voiceId ?? undefined,
        personaId: selectedPersonaId || undefined,
        businessId: currentBusiness?.id,
      });

      setLastResult({
        provider: result.provider,
        latencyMs: result.latencyMs,
        wasFallback: result.wasFallback,
      });

      // Play audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const url = URL.createObjectURL(result.audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error("Audio playback failed");
      };

      await audio.play();
    } catch (error: any) {
      toast.error(error.message || "Voice test failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Volume2 className="h-6 w-6 text-primary" />
          Voice Test Console
        </h2>
        <p className="text-muted-foreground">
          Test TTS providers side-by-side — type text, select a provider, hear the result
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Voice Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as VoiceProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aws_polly">
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" /> AWS Polly
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Persona (optional)</Label>
              <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Default voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default Voice</SelectItem>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{p.brand_key}</Badge>
                        {p.persona_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Text to Synthesize</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to convert to speech…"
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">{text.length} characters</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleTest}
              disabled={isLoading || isPlaying}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isLoading ? "Generating…" : "Test Voice"}
            </Button>
            {isPlaying && (
              <Button variant="outline" onClick={handleStop} className="gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Card */}
      {lastResult && (
        <Card className={lastResult.wasFallback ? "border-amber-500/50" : "border-primary/30"}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <span className="font-medium capitalize">
                  {lastResult.provider.replace("_", " ")}
                </span>
              </div>
              <Badge variant="outline" className="font-mono">
                {lastResult.latencyMs}ms
              </Badge>
              {lastResult.wasFallback && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  ⚠️ Fallback Triggered
                </Badge>
              )}
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/30">
                ✓ Success
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
