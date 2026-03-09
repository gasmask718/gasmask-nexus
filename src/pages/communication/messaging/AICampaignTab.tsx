import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Bot, Sparkles, Plus, Trash2, Loader2, Rocket, RefreshCw } from "lucide-react";
import ContactSelector, { SelectedContact } from "@/components/communication/ContactSelector";

interface DripStep {
  id: string;
  day: number;
  message: string;
  condition: "none" | "no_reply" | "no_click";
}

const PERSONAS = [
  { value: "friendly", label: "Friendly & Casual" },
  { value: "professional", label: "Professional" },
  { value: "urgent", label: "Urgent / FOMO" },
  { value: "empathetic", label: "Warm & Empathetic" },
];

export default function AICampaignTab() {
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  const [campaignName, setCampaignName] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("friendly");
  const [baseScript, setBaseScript] = useState("Hi this is GasMask checking inventory.\nHow many tubes do you currently have left?");
  const [aiPersonalization, setAiPersonalization] = useState(true);
  const [autoFollowUp, setAutoFollowUp] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [selectedContacts, setSelectedContacts] = useState<Map<string, SelectedContact>>(new Map());
  const [customNumbers, setCustomNumbers] = useState("");

  const handleSelectionChange = useCallback((contacts: Map<string, SelectedContact>) => {
    setSelectedContacts(contacts);
  }, []);

  const [dripSteps, setDripSteps] = useState<DripStep[]>([
    { id: "1", day: 0, message: "Hi this is GasMask checking inventory. How many tubes do you currently have left?", condition: "none" },
    { id: "2", day: 2, message: "Hey just following up — were you able to check your stock? We can get a reorder out quickly.", condition: "no_reply" },
    { id: "3", day: 5, message: "Last check-in! If you need anything, just reply here and we'll take care of it.", condition: "no_reply" },
  ]);

  const customNumbersList = customNumbers.split(",").map((n) => n.trim()).filter((n) => n);
  const recipientCount = selectedContacts.size + customNumbersList.length;

  const addStep = () => {
    const lastDay = dripSteps.length > 0 ? Math.max(...dripSteps.map((s) => s.day)) : 0;
    setDripSteps([...dripSteps, { id: Date.now().toString(), day: lastDay + 2, message: "", condition: "no_reply" }]);
  };
  const removeStep = (id: string) => setDripSteps(dripSteps.filter((s) => s.id !== id));
  const updateStep = (id: string, field: keyof DripStep, value: any) => {
    setDripSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleLaunch = async () => {
    if (!campaignName) { toast({ title: "Campaign name missing", variant: "destructive" }); return; }
    if (recipientCount === 0) { toast({ title: "No targets selected", variant: "destructive" }); return; }
    if (dripSteps.some((s) => !s.message.trim())) { toast({ title: "All steps need content", variant: "destructive" }); return; }
    setIsLaunching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const contacts = Array.from(selectedContacts.values());
      const { data, error } = await (supabase as any)
        .from("messaging_campaigns")
        .insert({
          business_id: currentBusiness?.id || null,
          mode: "ai_campaign",
          provider: "twilio",
          name: campaignName,
          script: baseScript,
          ai_enabled: true,
          status: "active",
          persona: selectedPersona,
          target_filter: {
            contacts,
            custom_numbers: customNumbersList,
            steps: dripSteps.map((s) => ({ day: s.day, message: s.message, condition: s.condition })),
            ai_personalization: aiPersonalization,
            auto_follow_up: autoFollowUp,
          },
          total_targets: recipientCount,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      await supabase.functions.invoke("messaging-launch", { body: { campaign_id: data.id } });
      toast({ title: "AI Campaign Launched!", description: `"${campaignName}" is now running via Twilio.` });
      setCampaignName("");
      setSelectedContacts(new Map());
      setCustomNumbers("");
    } catch (error: any) {
      toast({ title: "Launch Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!campaignName) { toast({ title: "Name required", variant: "destructive" }); return; }
    setIsSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const contacts = Array.from(selectedContacts.values());
      await (supabase as any).from("messaging_campaigns").insert({
        business_id: currentBusiness?.id || null,
        mode: "ai_campaign",
        provider: "twilio",
        name: campaignName,
        script: baseScript,
        ai_enabled: true,
        status: "draft",
        persona: selectedPersona,
        target_filter: {
          contacts,
          custom_numbers: customNumbersList,
          steps: dripSteps.map((s) => ({ day: s.day, message: s.message, condition: s.condition })),
        },
        total_targets: recipientCount,
        created_by: user.id,
      });
      toast({ title: "Draft Saved" });
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Campaign Settings */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> AI Campaign Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input placeholder="e.g., Reactivation AI Drip" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>

            <ContactSelector
              selectedContacts={selectedContacts}
              onSelectionChange={handleSelectionChange}
              customNumbers={customNumbers}
              onCustomNumbersChange={setCustomNumbers}
            />

            <div className="space-y-2">
              <Label>AI Persona</Label>
              <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSONAS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">AI Personalization</Label>
                <Switch checked={aiPersonalization} onCheckedChange={setAiPersonalization} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto Follow-Up</Label>
                <Switch checked={autoFollowUp} onCheckedChange={setAutoFollowUp} />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleLaunch} disabled={isLaunching || recipientCount === 0}>
                {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {isLaunching ? "Launching..." : "Launch via Twilio"}
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleSaveDraft} disabled={isSavingDraft}>
                {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save as Draft
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Drip Steps */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Conversation Flow</CardTitle>
                <CardDescription>AI will personalize each step and manage replies</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addStep} className="gap-1"><Plus className="h-3 w-3" /> Add Step</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {dripSteps.map((step, idx) => (
              <Card key={step.id} className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Step {idx + 1}</Badge>
                      <span className="text-xs text-muted-foreground">Day {step.day}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {step.condition !== "none" && (
                        <Badge variant="secondary" className="text-xs">{step.condition === "no_reply" ? "If no reply" : "If no click"}</Badge>
                      )}
                      {dripSteps.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeStep(step.id)}><Trash2 className="h-3 w-3" /></Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Day</Label>
                      <Input type="number" min={0} value={step.day} onChange={(e) => updateStep(step.id, "day", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Condition</Label>
                      <Select value={step.condition} onValueChange={(v) => updateStep(step.id, "condition", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Always</SelectItem>
                          <SelectItem value="no_reply">If no reply</SelectItem>
                          <SelectItem value="no_click">If no click</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Message</Label>
                    <Textarea rows={2} value={step.message} onChange={(e) => updateStep(step.id, "message", e.target.value)} placeholder="Enter step message..." />
                  </div>
                  {aiPersonalization && (
                    <div className="flex items-center gap-1 text-[10px] text-primary">
                      <Sparkles className="h-3 w-3" /> AI will personalize this message per recipient
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
