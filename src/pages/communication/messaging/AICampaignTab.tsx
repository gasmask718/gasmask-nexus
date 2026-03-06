import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useQuery } from "@tanstack/react-query";
import { Bot, Sparkles, Plus, Trash2, Loader2, Rocket, RefreshCw, Users, Phone } from "lucide-react";

interface DripStep {
  id: string;
  day: number;
  message: string;
  condition: "none" | "no_reply" | "no_click";
}

const ROLES = ["Wholesaler", "Ambassador", "Driver", "Biker", "Customer"];

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
  const [baseScript, setBaseScript] = useState(
    "Hi this is GasMask checking inventory.\nHow many tubes do you currently have left?",
  );
  const [aiPersonalization, setAiPersonalization] = useState(true);
  const [autoFollowUp, setAutoFollowUp] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // New Targeting State
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customNumbers, setCustomNumbers] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const [dripSteps, setDripSteps] = useState<DripStep[]>([
    {
      id: "1",
      day: 0,
      message: "Hi this is GasMask checking inventory. How many tubes do you currently have left?",
      condition: "none",
    },
    {
      id: "2",
      day: 2,
      message: "Hey just following up — were you able to check your stock? We can get a reorder out quickly.",
      condition: "no_reply",
    },
    {
      id: "3",
      day: 5,
      message: "Last check-in! If you need anything, just reply here and we'll take care of it.",
      condition: "no_reply",
    },
  ]);

  // Fetch users based on selected roles
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["ai-target-users", selectedRoles, currentBusiness?.id],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, phone, role")
        .eq("business_id", currentBusiness?.id || "");

      if (selectedRoles.length > 0) {
        query = query.in("role", selectedRoles);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const toggleUser = (id: string) => {
    const newSet = new Set(selectedUserIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedUserIds(newSet);
  };

  const selectAllUsers = () => {
    if (selectedUserIds.size === users.length && users.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map((u) => u.id)));
    }
  };

  const customNumbersList = customNumbers
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n);
  const recipientCount = selectedUserIds.size + customNumbersList.length;

  const addStep = () => {
    const lastDay = dripSteps.length > 0 ? Math.max(...dripSteps.map((s) => s.day)) : 0;
    setDripSteps([...dripSteps, { id: Date.now().toString(), day: lastDay + 2, message: "", condition: "no_reply" }]);
  };

  const removeStep = (id: string) => setDripSteps(dripSteps.filter((s) => s.id !== id));

  const updateStep = (id: string, field: keyof DripStep, value: any) => {
    setDripSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleLaunch = async () => {
    if (!campaignName) {
      toast({ title: "Campaign name missing", variant: "destructive" });
      return;
    }
    if (recipientCount === 0) {
      toast({ title: "No targets selected", variant: "destructive" });
      return;
    }
    if (dripSteps.some((s) => !s.message.trim())) {
      toast({ title: "All steps need content", variant: "destructive" });
      return;
    }
    setIsLaunching(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("messaging_campaigns")
        .insert({
          business_id: currentBusiness?.id || null,
          mode: "ai_campaign",
          provider: "twilio", // EXPLICIT TWILIO TAG
          name: campaignName,
          script: baseScript,
          ai_enabled: true,
          status: "active",
          persona: selectedPersona,
          target_filter: {
            roles: selectedRoles,
            user_ids: Array.from(selectedUserIds),
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

      toast({
        title: "AI Campaign Launched!",
        description: `"${campaignName}" is now running autonomously via Twilio.`,
      });
      setCampaignName("");
      setSelectedUserIds(new Set());
      setCustomNumbers("");
    } catch (error: any) {
      toast({ title: "Launch Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!campaignName) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setIsSavingDraft(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from("messaging_campaigns").insert({
        business_id: currentBusiness?.id || null,
        mode: "ai_campaign",
        provider: "twilio",
        name: campaignName,
        script: baseScript,
        ai_enabled: true,
        status: "draft",
        persona: selectedPersona,
        target_filter: {
          roles: selectedRoles,
          user_ids: Array.from(selectedUserIds),
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
        {/* Campaign Settings (Left Column) */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Campaign Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                placeholder="e.g., Reactivation AI Drip"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            {/* Targeting Engine */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Target Audience
              </Label>

              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Filter by Role</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map((role) => (
                    <Badge
                      key={role}
                      variant={selectedRoles.includes(role) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleRole(role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="border rounded-md bg-background">
                <ScrollArea className="h-[180px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px] p-2">
                          <Checkbox
                            checked={users.length > 0 && selectedUserIds.size === users.length}
                            onCheckedChange={selectAllUsers}
                          />
                        </TableHead>
                        <TableHead className="p-2 text-xs">Name (Role)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersLoading ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-8">
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-8">
                            No users found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="p-2">
                              <Checkbox checked={selectedUserIds.has(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                            </TableCell>
                            <TableCell className="p-2 text-xs">
                              {u.full_name || "Unknown"} <span className="text-muted-foreground">({u.role})</span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="space-y-2 pt-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Custom Numbers</Label>
                <Textarea
                  placeholder="+1234567890..."
                  value={customNumbers}
                  onChange={(e) => setCustomNumbers(e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>

              {recipientCount > 0 && (
                <div className="text-xs font-medium text-primary bg-primary/10 p-2 rounded flex items-center gap-2">
                  <Phone className="h-3 w-3" /> {recipientCount} Total Targets
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>AI Persona</Label>
              <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONAS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
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
              <Button
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleLaunch}
                disabled={isLaunching || recipientCount === 0}
              >
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

        {/* Drip Steps (Right Column) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Conversation Flow
                </CardTitle>
                <CardDescription>AI will personalize each step and manage replies</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addStep} className="gap-1">
                <Plus className="h-3 w-3" /> Add Step
              </Button>
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
                        <Badge variant="secondary" className="text-xs">
                          {step.condition === "no_reply" ? "If no reply" : "If no click"}
                        </Badge>
                      )}
                      {dripSteps.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeStep(step.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Day</Label>
                      <Input
                        type="number"
                        min={0}
                        value={step.day}
                        onChange={(e) => updateStep(step.id, "day", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Condition</Label>
                      <Select value={step.condition} onValueChange={(v) => updateStep(step.id, "condition", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Always send</SelectItem>
                          <SelectItem value="no_reply">If no reply</SelectItem>
                          <SelectItem value="no_click">If no click</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea
                    value={step.message}
                    onChange={(e) => updateStep(step.id, "message", e.target.value)}
                    placeholder="Enter message for this step..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            ))}

            {/* AI Responsibilities */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Responsibilities
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Classify replies (inventory levels, reorder intent, questions)</li>
                  <li>• Ask follow-up questions based on responses</li>
                  <li>• Detect reorder intent and flag for fulfillment</li>
                  <li>• Escalate to human if confused or hostile</li>
                  <li>• Stop outreach on opt-out or successful engagement</li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
