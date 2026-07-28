import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PhoneForwarded, Mic } from "lucide-react";
import { toast } from "sonner";
import { prettyPhone } from "@/hooks/usePhoneLog";

/**
 * VoiceRoutingSettingsCard — owner controls for who the store's call rings.
 * Reads/writes voice_routing_settings + voice_va_forwarding (business 'gasmask').
 */
export function VoiceRoutingSettingsCard({ business = "gasmask" }: { business?: string }) {
  const qc = useQueryClient();
  const [ownerNumber, setOwnerNumber] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["voice-routing-settings", business],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_routing_settings")
        .select("*")
        .eq("business", business)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: vas } = useQuery({
    queryKey: ["voice-va-forwarding", business],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_va_forwarding")
        .select("*")
        .eq("business", business)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("voice_routing_settings").update(patch).eq("business", business);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-routing-settings", business] });
      toast.success("Call routing updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleVa = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase.from("voice_va_forwarding").update({ is_available: available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-va-forwarding", business] });
      toast.success("VA availability updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No voice routing configured for {business}.
        </CardContent>
      </Card>
    );
  }

  const owner = ownerNumber ?? settings.owner_forward_number ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneForwarded className="h-4 w-4" /> Call routing
        </CardTitle>
        <CardDescription>
          Incoming calls ring the available VAs and the owner at the same time. If nobody picks up, the caller
          leaves a voicemail and you get the transcript by text.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">Routing active</Label>
            <p className="text-xs text-muted-foreground">Turn off to send every caller straight to voicemail.</p>
          </div>
          <Switch
            checked={!!settings.is_active}
            onCheckedChange={(v) => save.mutate({ is_active: v })}
            disabled={save.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner-number" className="text-sm">
            Owner cell (always rings)
          </Label>
          <div className="flex gap-2">
            <Input
              id="owner-number"
              value={owner}
              onChange={(e) => setOwnerNumber(e.target.value)}
              placeholder="+17183089391"
            />
            <Button
              onClick={() => save.mutate({ owner_forward_number: owner })}
              disabled={save.isPending || owner === settings.owner_forward_number}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="flex items-center gap-1 text-sm">
              <Mic className="h-3.5 w-3.5" /> Record calls (with disclosure)
            </Label>
            <p className="text-xs text-muted-foreground">
              Every caller hears: “{settings.disclosure_text}”
            </p>
          </div>
          <Switch
            checked={!!settings.recording_enabled}
            onCheckedChange={(v) => save.mutate({ recording_enabled: v })}
            disabled={save.isPending}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">Text me voicemail transcripts</Label>
            <p className="text-xs text-muted-foreground">Sent to the owner cell as soon as Twilio transcribes.</p>
          </div>
          <Switch
            checked={!!settings.sms_transcript_to_owner}
            onCheckedChange={(v) => save.mutate({ sms_transcript_to_owner: v })}
            disabled={save.isPending}
          />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-sm">If nobody answers</Label>
          <p className="text-xs text-muted-foreground">
            Humans always ring first. This is what happens next.
          </p>
          <div className="flex gap-2 pt-1">
            {[
              { key: "ai_agent", label: "AI phone agent, then voicemail" },
              { key: "voicemail", label: "Voicemail only" },
            ].map((opt) => (
              <Button
                key={opt.key}
                size="sm"
                variant={
                  (settings.no_answer_action ?? "ai_agent") === opt.key ? "default" : "outline"
                }
                onClick={() => save.mutate({ no_answer_action: opt.key })}
                disabled={save.isPending}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">VA phones</Label>
          {(vas || []).length === 0 && (
            <p className="text-xs text-muted-foreground">No VA phones added — calls ring the owner only.</p>
          )}
          {(vas || []).map((va: Record<string, unknown>) => (
            <div key={va.id as string} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{(va.va_name as string) || "VA"}</p>
                <p className="text-xs text-muted-foreground">{prettyPhone(va.forward_number as string)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={va.is_available ? "default" : "secondary"} className="text-[10px]">
                  {va.is_available ? "Available" : "Off"}
                </Badge>
                <Switch
                  checked={!!va.is_available}
                  onCheckedChange={(v) => toggleVa.mutate({ id: va.id as string, available: v })}
                  disabled={toggleVa.isPending}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
