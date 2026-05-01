import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Radio, Plus, Settings, Volume2, Activity, Mic, Zap, Shield,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";


interface VoiceMatrixRow {
  id: string;
  brand_key: string;
  persona_name: string;
  elevenlabs_voice_id: string | null;
  elevenlabs_agent_id: string | null;
  aws_voice_id: string | null;
  language_code: string | null;
  speaking_style: Json | null;
  active: boolean | null;
  business_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProviderSettings {
  id: string;
  business_id: string;
  default_tts_provider: string;
  fallback_tts_provider: string;
  max_tts_latency_ms: number | null;
  force_provider: string | null;
  enable_streaming_tts: boolean | null;
  tts_cache_enabled: boolean | null;
}

interface TtsStats {
  provider: string;
  avg_latency: number;
  total_calls: number;
  success_rate: number;
}

export function VoiceMatrixManager() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<VoiceMatrixRow | null>(null);

  // Fetch personas
  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["voice-matrix", currentBusiness?.id],
    queryFn: async () => {
      const query = supabase.from("voice_matrix").select("*").order("brand_key");
      if (currentBusiness?.id) {
        query.or(`business_id.eq.${currentBusiness.id},business_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as VoiceMatrixRow[];
    },
  });

  // Fetch provider settings
  const { data: providerSettings } = useQuery({
    queryKey: ["voice-provider-settings", currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return null;
      const { data, error } = await supabase
        .from("voice_provider_settings")
        .select("*")
        .eq("business_id", currentBusiness.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProviderSettings | null;
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch TTS stats (last 24h)
  const { data: ttsStats = [] } = useQuery({
    queryKey: ["tts-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("tts_events")
        .select("provider, latency_ms, success")
        .gte("created_at", since);
      if (error) throw error;

      // Aggregate manually
      const byProvider: Record<string, { totalLatency: number; count: number; successCount: number }> = {};
      for (const row of data || []) {
        const p = row.provider;
        if (!byProvider[p]) byProvider[p] = { totalLatency: 0, count: 0, successCount: 0 };
        byProvider[p].count++;
        byProvider[p].totalLatency += row.latency_ms || 0;
        if (row.success) byProvider[p].successCount++;
      }

      return Object.entries(byProvider).map(([provider, stats]) => ({
        provider,
        avg_latency: Math.round(stats.totalLatency / stats.count),
        total_calls: stats.count,
        success_rate: Math.round((stats.successCount / stats.count) * 100),
      })) as TtsStats[];
    },
  });

  // Toggle persona active state
  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("voice_matrix")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-matrix"] });
      toast.success("Persona updated");
    },
  });

  // Update provider settings
  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<ProviderSettings>) => {
      if (!currentBusiness?.id) throw new Error("No business");
      const { error } = await supabase
        .from("voice_provider_settings")
        .upsert([{ business_id: currentBusiness.id, ...settings } as any], { onConflict: "business_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-provider-settings"] });
      toast.success("Provider settings saved");
    },
  });

  const brandColors: Record<string, string> = {
    gasmask: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    hotmama: "bg-pink-500/10 text-pink-400 border-pink-500/30",
    toptier: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" />
          Voice Matrix — Persona & Provider Control
        </h2>
        <p className="text-muted-foreground">
          Map brand voices to AI personas, configure ElevenLabs primary + AWS Polly fallback
        </p>
      </div>

      {/* TTS Provider Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ttsStats.length > 0 ? ttsStats.map((stat) => (
          <Card key={stat.provider}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {stat.provider === "elevenlabs" ? (
                    <Mic className="h-5 w-5 text-primary" />
                  ) : (
                    <Zap className="h-5 w-5 text-amber-500" />
                  )}
                  <span className="font-medium capitalize">{stat.provider.replace("_", " ")}</span>
                </div>
                <Badge variant={stat.success_rate >= 95 ? "default" : "destructive"}>
                  {stat.success_rate}% OK
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Avg Latency</p>
                  <p className="font-mono font-bold">{stat.avg_latency}ms</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Calls (24h)</p>
                  <p className="font-mono font-bold">{stat.total_calls}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card className="col-span-3">
            <CardContent className="py-6 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No TTS events in the last 24 hours
            </CardContent>
          </Card>
        )}
      </div>

      {/* Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-5 w-5" />
            Provider Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Primary Provider</Label>
              <Select
                value={providerSettings?.default_tts_provider || "elevenlabs"}
                onValueChange={(v) => updateSettings.mutate({ default_tts_provider: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="aws_polly">AWS Polly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fallback Provider</Label>
              <Select
                value={providerSettings?.fallback_tts_provider || "aws_polly"}
                onValueChange={(v) => updateSettings.mutate({ fallback_tts_provider: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="aws_polly">AWS Polly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Latency Threshold (ms)</Label>
              <Input
                type="number"
                value={providerSettings?.max_tts_latency_ms ?? 1200}
                onChange={(e) => updateSettings.mutate({ max_tts_latency_ms: parseInt(e.target.value) || 1200 })}
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-fallback if primary exceeds this</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Force Provider Override</Label>
              <p className="text-xs text-muted-foreground">Bypass fallback logic — use one provider exclusively</p>
            </div>
            <Select
              value={providerSettings?.force_provider || "none"}
              onValueChange={(v) => updateSettings.mutate({ force_provider: v === "none" ? null : v })}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Auto (default)</SelectItem>
                <SelectItem value="elevenlabs">Force ElevenLabs</SelectItem>
                <SelectItem value="aws_polly">Force AWS Polly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Persona Grid */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Brand Personas</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingPersona(null)}>
              <Plus className="h-4 w-4 mr-1" /> Add Persona
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPersona ? "Edit Persona" : "New Persona"}</DialogTitle>
            </DialogHeader>
            <PersonaForm
              persona={editingPersona}
              businessId={currentBusiness?.id || null}
              onSaved={() => {
                setDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["voice-matrix"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Radio className="h-6 w-6 animate-pulse text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((p) => (
            <Card key={p.id} className={`border ${p.active ? "border-primary/30" : "border-border opacity-60"}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={brandColors[p.brand_key] || "bg-muted text-muted-foreground"}>
                      {p.brand_key}
                    </Badge>
                    <span className="font-medium">{p.persona_name}</span>
                  </div>
                  <Switch
                    checked={p.active ?? false}
                    onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })}
                  />
                </div>
                <div className="text-xs space-y-1 text-muted-foreground">
                  {p.elevenlabs_agent_id && (
                    <div className="flex items-center gap-1">
                      <Mic className="h-3 w-3" />
                      <span>Agent: {p.elevenlabs_agent_id.slice(0, 12)}…</span>
                    </div>
                  )}
                  {p.elevenlabs_voice_id && (
                    <div className="flex items-center gap-1">
                      <Volume2 className="h-3 w-3" />
                      <span>Voice: {p.elevenlabs_voice_id.slice(0, 12)}…</span>
                    </div>
                  )}
                  {p.aws_voice_id && (
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      <span>Polly: {p.aws_voice_id}</span>
                    </div>
                  )}
                  {p.language_code && (
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span>Lang: {p.language_code}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <VoicePreviewButton
                    voiceModelId={p.elevenlabs_voice_id}
                    sampleText={`Hi, this is ${p.persona_name} from ${p.brand_key}. How can I help you today?`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditingPersona(p);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Persona Form ---
function PersonaForm({
  persona,
  businessId,
  onSaved,
}: {
  persona: VoiceMatrixRow | null;
  businessId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    brand_key: persona?.brand_key || "",
    persona_name: persona?.persona_name || "",
    elevenlabs_voice_id: persona?.elevenlabs_voice_id || "",
    elevenlabs_agent_id: persona?.elevenlabs_agent_id || "",
    aws_voice_id: persona?.aws_voice_id || "",
    language_code: persona?.language_code || "en",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.brand_key || !form.persona_name) {
      toast.error("Brand key and persona name are required");
      return;
    }
    setSaving(true);
    try {
      if (persona) {
        const { error } = await supabase
          .from("voice_matrix")
          .update({
            brand_key: form.brand_key,
            persona_name: form.persona_name,
            elevenlabs_voice_id: form.elevenlabs_voice_id || null,
            elevenlabs_agent_id: form.elevenlabs_agent_id || null,
            aws_voice_id: form.aws_voice_id || null,
            language_code: form.language_code || null,
          })
          .eq("id", persona.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("voice_matrix").insert({
          brand_key: form.brand_key,
          persona_name: form.persona_name,
          elevenlabs_voice_id: form.elevenlabs_voice_id || null,
          elevenlabs_agent_id: form.elevenlabs_agent_id || null,
          aws_voice_id: form.aws_voice_id || null,
          language_code: form.language_code || null,
          business_id: businessId,
          active: true,
        });
        if (error) throw error;
      }
      toast.success(persona ? "Persona updated" : "Persona created");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Brand Key</Label>
          <Input value={form.brand_key} onChange={(e) => setForm({ ...form, brand_key: e.target.value })} placeholder="gasmask" />
        </div>
        <div>
          <Label>Persona Name</Label>
          <Input value={form.persona_name} onChange={(e) => setForm({ ...form, persona_name: e.target.value })} placeholder="Founder Voice" />
        </div>
      </div>
      <div>
        <Label>ElevenLabs Agent ID</Label>
        <Input value={form.elevenlabs_agent_id} onChange={(e) => setForm({ ...form, elevenlabs_agent_id: e.target.value })} placeholder="agent_..." />
      </div>
      <div>
        <Label>ElevenLabs Voice ID</Label>
        <Input value={form.elevenlabs_voice_id} onChange={(e) => setForm({ ...form, elevenlabs_voice_id: e.target.value })} placeholder="Voice ID for direct TTS" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>AWS Polly Voice</Label>
          <Input value={form.aws_voice_id} onChange={(e) => setForm({ ...form, aws_voice_id: e.target.value })} placeholder="Matthew" />
        </div>
        <div>
          <Label>Language</Label>
          <Input value={form.language_code} onChange={(e) => setForm({ ...form, language_code: e.target.value })} placeholder="en" />
        </div>
      </div>
      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : persona ? "Update Persona" : "Create Persona"}
      </Button>
    </div>
  );
}
