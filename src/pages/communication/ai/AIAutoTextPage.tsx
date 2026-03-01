import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  MessageSquare, Send, Sparkles, Clock, Users, CheckCircle, 
  XCircle, RefreshCw, Zap, Target, BarChart3, Plus, Trash2, 
  Wand2, ArrowRight, Calendar, MessageCircle, Loader2,
  Radio, AlertTriangle, ArrowUpRight, Eye, Pause, Play,
  Bot, UserCheck, PhoneForwarded
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  type: "blast" | "drip";
  status: "running" | "completed" | "scheduled" | "draft" | "paused";
  sent: number;
  delivered: number;
  replies: number;
  optOuts: number;
  ctr: number;
  scheduledAt?: string;
  startedAt?: string;
}

interface DripStep {
  id: string;
  day: number;
  message: string;
  condition: "none" | "no_reply" | "no_click";
}

interface Conversation {
  id: string;
  storeName: string;
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  direction: "inbound" | "outbound";
  status: "ai_handling" | "escalated" | "resolved";
  campaignName: string;
  messageCount: number;
}

// ─── Mock Data ───────────────────────────────────────────────────────

const mockActiveCampaigns: Campaign[] = [
  { id: "1", name: "Win Back Campaign", type: "drip", status: "running", sent: 450, delivered: 432, replies: 34, optOuts: 3, ctr: 8.2, startedAt: "2026-02-28 09:00" },
  { id: "2", name: "New Product Launch", type: "blast", status: "running", sent: 820, delivered: 795, replies: 67, optOuts: 5, ctr: 12.5, startedAt: "2026-03-01 08:00" },
  { id: "3", name: "Holiday Promo", type: "blast", status: "scheduled", sent: 0, delivered: 0, replies: 0, optOuts: 0, ctr: 0, scheduledAt: "2026-03-05 09:00" },
  { id: "4", name: "Reactivation Drip", type: "drip", status: "paused", sent: 210, delivered: 198, replies: 12, optOuts: 1, ctr: 6.1, startedAt: "2026-02-25 10:00" },
];

const mockConversations: Conversation[] = [
  { id: "1", storeName: "Quick Stop #412", phone: "+15551234567", lastMessage: "Yes, I'd like to place a reorder!", lastMessageAt: "2 min ago", direction: "inbound", status: "ai_handling", campaignName: "Win Back Campaign", messageCount: 4 },
  { id: "2", storeName: "Corner Mart", phone: "+15559876543", lastMessage: "Can I get pricing on the new flavors?", lastMessageAt: "8 min ago", direction: "inbound", status: "escalated", campaignName: "New Product Launch", messageCount: 6 },
  { id: "3", storeName: "Fresh & Go", phone: "+15554445555", lastMessage: "Thanks for the info!", lastMessageAt: "25 min ago", direction: "inbound", status: "resolved", campaignName: "Win Back Campaign", messageCount: 3 },
  { id: "4", storeName: "Metro Deli", phone: "+15556667777", lastMessage: "STOP", lastMessageAt: "1 hr ago", direction: "inbound", status: "resolved", campaignName: "Holiday Promo", messageCount: 1 },
];

const aiMessageTemplates = [
  "Hey {first_name}! Just wanted to reach out and see how things are going at {store_name}. We've got some great new products that might interest you!",
  "Hi {first_name}, hope all is well! Haven't heard from you in a bit - any questions about our latest offerings? I'm here to help!",
  "Quick check-in, {first_name}! Your customers at {store_name} would love our new arrivals. Ready to stock up?",
  "Hey there! Just a friendly reminder that we're always here for {store_name}. Need anything? Let's chat!",
  "Last chance alert, {first_name}! Don't miss out on exclusive deals for {store_name}. Reply YES to learn more!"
];

// ─── Component ───────────────────────────────────────────────────────

export default function AIAutoTextPage() {
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  
  // Campaign Builder state
  const [builderMode, setBuilderMode] = useState<"blast" | "drip">("blast");
  const [campaignName, setCampaignName] = useState("");
  const [messageType, setMessageType] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [throttle, setThrottle] = useState("50");
  const [generatingStepId, setGeneratingStepId] = useState<string | null>(null);
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSendingBlast, setIsSendingBlast] = useState(false);

  // Drip state
  const [dripCampaignName, setDripCampaignName] = useState("");
  const [dripTargetSegment, setDripTargetSegment] = useState("");
  const [isLaunchingDrip, setIsLaunchingDrip] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [dripSteps, setDripSteps] = useState<DripStep[]>([
    { id: "1", day: 1, message: "Hey {first_name}! We have some exciting new products you might love. Check them out!", condition: "none" },
    { id: "2", day: 3, message: "Hi again! Just wanted to make sure you saw our new arrivals. Any questions?", condition: "no_reply" },
    { id: "3", day: 7, message: "Last chance! Don't miss out on these amazing deals. Reply to learn more!", condition: "no_reply" },
  ]);

  // ─── Handlers (unchanged logic) ───────────────────────────────────

  const handleSendNow = async () => {
    if (!campaignName || !messageContent || !selectedSegment) {
      toast({ title: "Missing Information", description: "Please fill in campaign name, message content, and target segment.", variant: "destructive" });
      return;
    }
    setIsSendingBlast(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" }); return; }
      const { error } = await supabase.from('ai_text_sequences').insert({
        business_id: currentBusiness?.id || null, title: campaignName, goal: 'bulk_blast',
        steps: [{ message: messageContent, persona: selectedPersona, messageType, throttle: parseInt(throttle) }],
        target_filter: { segment: selectedSegment }, is_active: true, created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Campaign Sent!", description: `"${campaignName}" is now sending to the ${selectedSegment} segment.` });
      setCampaignName(""); setMessageContent(""); setSelectedSegment(""); setMessageType(""); setSelectedPersona("");
    } catch (error: any) {
      console.error('Failed to send bulk blast:', error);
      toast({ title: "Send Failed", description: error.message || "Could not send the campaign.", variant: "destructive" });
    } finally { setIsSendingBlast(false); }
  };

  const handleOpenScheduleModal = () => {
    if (!campaignName || !messageContent || !selectedSegment) {
      toast({ title: "Missing Information", description: "Please fill in all fields before scheduling.", variant: "destructive" });
      return;
    }
    setShowScheduleModal(true);
  };

  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast({ title: "Select Date & Time", description: "Please select both a date and time.", variant: "destructive" });
      return;
    }
    setIsScheduling(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({ title: "Campaign Scheduled", description: `"${campaignName}" is scheduled for ${scheduleDate} at ${scheduleTime}.` });
    setIsScheduling(false); setShowScheduleModal(false); setScheduleDate(""); setScheduleTime("");
    setCampaignName(""); setMessageContent(""); setSelectedSegment("");
  };

  const handleAIRewrite = async () => {
    if (!messageContent.trim()) { toast({ title: "No Content", description: "Please enter text to rewrite.", variant: "destructive" }); return; }
    setAiActionLoading("rewrite");
    await new Promise(resolve => setTimeout(resolve, 1500));
    const msgs = [
      `Hey {first_name}! Great news from {brand} - we've got something special for {store_name}. Let's connect!`,
      `Hi there! {brand} has exciting updates for {store_name}. Your customers will love what's new!`,
      `{first_name}, quick heads up - {brand} just dropped some amazing products perfect for {store_name}!`,
    ];
    setMessageContent(msgs[Math.floor(Math.random() * msgs.length)]);
    setAiActionLoading(null);
    toast({ title: "Message Rewritten" });
  };

  const handleMakeShorter = async () => {
    if (!messageContent.trim()) { toast({ title: "No Content", variant: "destructive" }); return; }
    setAiActionLoading("shorter");
    await new Promise(resolve => setTimeout(resolve, 1200));
    const shorts = [
      `{first_name}, new products just in! Check them out at {store_name}.`,
      `Hey {first_name}! {brand} has fresh stock for you. Interested?`,
      `Quick update, {first_name}: New arrivals ready for {store_name}!`,
    ];
    setMessageContent(shorts[Math.floor(Math.random() * shorts.length)]);
    setAiActionLoading(null);
    toast({ title: "Message Shortened" });
  };

  const handleFixGrammar = async () => {
    if (!messageContent.trim()) { toast({ title: "No Content", variant: "destructive" }); return; }
    setAiActionLoading("grammar");
    await new Promise(resolve => setTimeout(resolve, 1000));
    let fixed = messageContent;
    fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
    if (!/[.!?]$/.test(fixed.trim())) fixed = fixed.trim() + ".";
    fixed = fixed.replace(/\bi\b/g, "I").replace(/\bdont\b/gi, "don't").replace(/\bcant\b/gi, "can't").replace(/\bwont\b/gi, "won't");
    setMessageContent(fixed);
    setAiActionLoading(null);
    toast({ title: "Grammar Fixed" });
  };

  const handleAIGenerate = async (stepId: string, stepIndex: number) => {
    setGeneratingStepId(stepId);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const templateIndex = Math.min(stepIndex, aiMessageTemplates.length - 1);
    setDripSteps(prev => prev.map(step => step.id === stepId ? { ...step, message: aiMessageTemplates[templateIndex] } : step));
    setGeneratingStepId(null);
    toast({ title: "Message Generated" });
  };

  const addDripStep = () => {
    const lastDay = dripSteps.length > 0 ? Math.max(...dripSteps.map(s => s.day)) : 0;
    setDripSteps([...dripSteps, { id: Date.now().toString(), day: lastDay + 2, message: "", condition: "no_reply" }]);
  };

  const removeDripStep = (id: string) => { setDripSteps(dripSteps.filter(s => s.id !== id)); };

  const handleLaunchDripCampaign = async () => {
    if (!dripCampaignName.trim()) { toast({ title: "Name Required", variant: "destructive" }); return; }
    if (!dripTargetSegment) { toast({ title: "Segment Required", variant: "destructive" }); return; }
    if (dripSteps.some(s => !s.message.trim())) { toast({ title: "Empty Steps", description: "All steps must have content.", variant: "destructive" }); return; }
    setIsLaunchingDrip(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "Auth Required", variant: "destructive" }); return; }
      const { error } = await supabase.from('ai_text_sequences').insert({
        business_id: currentBusiness?.id || null, title: dripCampaignName, goal: 'drip_campaign',
        steps: dripSteps.map(s => ({ day: s.day, message: s.message, condition: s.condition })),
        target_filter: { segment: dripTargetSegment }, is_active: true, created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Campaign Launched!", description: `"${dripCampaignName}" is now active.` });
      setDripCampaignName(""); setDripTargetSegment(""); setDripSteps([{ id: "1", day: 1, message: "", condition: "none" }]);
    } catch (error: any) {
      toast({ title: "Launch Failed", description: error.message, variant: "destructive" });
    } finally { setIsLaunchingDrip(false); }
  };

  const handleSaveAsDraft = async () => {
    if (!dripCampaignName.trim()) { toast({ title: "Name Required", variant: "destructive" }); return; }
    setIsSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "Auth Required", variant: "destructive" }); return; }
      const { error } = await supabase.from('ai_text_sequences').insert({
        business_id: currentBusiness?.id || null, title: dripCampaignName, goal: 'drip_campaign_draft',
        steps: dripSteps.map(s => ({ day: s.day, message: s.message, condition: s.condition })),
        target_filter: { segment: dripTargetSegment }, is_active: false, created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Draft Saved" });
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally { setIsSavingDraft(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            AI Auto Text
          </h1>
          <p className="text-muted-foreground">Campaign builder, live monitoring & AI conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            {mockActiveCampaigns.filter(c => c.status === "running").length} Active
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MessageCircle className="h-3 w-3" />
            {mockConversations.filter(c => c.status === "ai_handling").length} AI Handling
          </Badge>
        </div>
      </div>

      {/* ═══ 3-Tab Architecture ═══ */}
      <Tabs defaultValue="builder" className="space-y-6">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="builder" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Campaign Builder
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            Active Campaigns
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Conversations
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: CAMPAIGN BUILDER ═══ */}
        <TabsContent value="builder" className="space-y-6">
          {/* Builder mode toggle */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={builderMode === "blast" ? "default" : "outline"}
              onClick={() => setBuilderMode("blast")}
              className="gap-1.5"
            >
              <Zap className="h-3.5 w-3.5" />
              Bulk Blast
            </Button>
            <Button
              size="sm"
              variant={builderMode === "drip" ? "default" : "outline"}
              onClick={() => setBuilderMode("drip")}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Drip Sequence
            </Button>
          </div>

          {builderMode === "blast" ? (
            /* ── Bulk Blast Builder ── */
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Bulk SMS Builder
                  </CardTitle>
                  <CardDescription>Send personalized messages to thousands of stores</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input placeholder="e.g., New Year Promo Blast" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Message Type</Label>
                    <Select value={messageType} onValueChange={setMessageType}>
                      <SelectTrigger><SelectValue placeholder="Select message type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai-generated">AI Generated</SelectItem>
                        <SelectItem value="template">From Template</SelectItem>
                        <SelectItem value="manual">Manual / Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Brand Voice Persona</Label>
                    <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                      <SelectTrigger><SelectValue placeholder="Select tone" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly & Casual</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="urgent">Urgent / FOMO</SelectItem>
                        <SelectItem value="empathetic">Warm & Empathetic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Segment</Label>
                    <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                      <SelectTrigger><SelectValue placeholder="Select target stores" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stores</SelectItem>
                        <SelectItem value="new">New Stores (Last 30 days)</SelectItem>
                        <SelectItem value="dead">Dead Stores (No orders 60+ days)</SelectItem>
                        <SelectItem value="high-value">High Value Stores</SelectItem>
                        <SelectItem value="low-engagement">Low Engagement</SelectItem>
                        <SelectItem value="custom">Custom List</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Message Content</Label>
                      <div className="flex items-center gap-2">
                        <Switch checked={isAIEnabled} onCheckedChange={setIsAIEnabled} />
                        <span className="text-xs text-muted-foreground">AI Assist</span>
                      </div>
                    </div>
                    <Textarea placeholder="Type your message... Use {first_name}, {store_name}, {brand} for personalization" value={messageContent} onChange={(e) => setMessageContent(e.target.value)} rows={4} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={handleAIRewrite} disabled={aiActionLoading !== null || !messageContent.trim()}>
                        {aiActionLoading === "rewrite" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        {aiActionLoading === "rewrite" ? "Rewriting..." : "AI Rewrite"}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={handleMakeShorter} disabled={aiActionLoading !== null || !messageContent.trim()}>
                        {aiActionLoading === "shorter" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {aiActionLoading === "shorter" ? "Shortening..." : "Make Shorter"}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={handleFixGrammar} disabled={aiActionLoading !== null || !messageContent.trim()}>
                        {aiActionLoading === "grammar" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        {aiActionLoading === "grammar" ? "Fixing..." : "Fix Grammar"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Send Rate (messages/minute)</Label>
                    <Select value={throttle} onValueChange={setThrottle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10/min (Slow)</SelectItem>
                        <SelectItem value="50">50/min (Normal)</SelectItem>
                        <SelectItem value="100">100/min (Fast)</SelectItem>
                        <SelectItem value="200">200/min (Turbo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-4 flex gap-2">
                    <Button className="flex-1 gap-2" disabled={!campaignName || !messageContent || !selectedSegment || isSendingBlast} onClick={handleSendNow}>
                      {isSendingBlast ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {isSendingBlast ? "Sending..." : "Send Now"}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleOpenScheduleModal}>
                      <Calendar className="h-4 w-4" /> Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview & Templates */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Message Preview</CardTitle>
                    <CardDescription>How your message will appear</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="bg-primary text-primary-foreground rounded-lg p-3 max-w-[80%] ml-auto">
                        <p className="text-sm">{messageContent || "Your message preview will appear here..."}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-right">{messageContent.length}/160 characters</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Templates */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Templates</CardTitle>
                    <CardDescription>Click to load a pre-built message</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 grid-cols-2">
                      {[
                        { name: "New Product Alert", category: "Promo", msg: "Hey {first_name}! {brand} just dropped new products for {store_name}. Reply YES to see the lineup!" },
                        { name: "Reactivation", category: "Win Back", msg: "Hi {first_name}, we miss {store_name}! It's been a while — got a minute to catch up?" },
                        { name: "Payment Reminder", category: "Collections", msg: "Hi {first_name}, friendly reminder on your balance for {store_name}. Need help? Reply here." },
                        { name: "Feedback Request", category: "Engagement", msg: "Hey {first_name}! How's {store_name} doing with our latest products? Your feedback matters!" },
                      ].map((t, i) => (
                        <Card key={i} className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setMessageContent(t.msg); toast({ title: `Loaded: ${t.name}` }); }}>
                          <CardContent className="p-3">
                            <p className="text-sm font-medium">{t.name}</p>
                            <Badge variant="secondary" className="mt-1 text-xs">{t.category}</Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* ── Drip Sequence Builder ── */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Multi-Step Drip Campaign
                </CardTitle>
                <CardDescription>Create automated message sequences that nurture leads over time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input placeholder="e.g., Store Reactivation Sequence" value={dripCampaignName} onChange={(e) => setDripCampaignName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Segment</Label>
                    <Select value={dripTargetSegment} onValueChange={setDripTargetSegment}>
                      <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dead">Dead Stores</SelectItem>
                        <SelectItem value="new">New Stores</SelectItem>
                        <SelectItem value="low-engagement">Low Engagement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg">Message Steps</Label>
                    <Button size="sm" variant="outline" onClick={addDripStep} className="gap-1">
                      <Plus className="h-4 w-4" /> Add Step
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {dripSteps.map((step, index) => (
                      <Card key={step.id} className="border-dashed">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Day {step.day}</Badge>
                              {index > 0 && (
                                <Select defaultValue={step.condition}>
                                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Always send</SelectItem>
                                    <SelectItem value="no_reply">If no reply</SelectItem>
                                    <SelectItem value="no_click">If no click</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            {dripSteps.length > 1 && (
                              <Button size="sm" variant="ghost" onClick={() => removeDripStep(step.id)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                          <Textarea
                            value={step.message}
                            onChange={(e) => setDripSteps(prev => prev.map(s => s.id === step.id ? { ...s, message: e.target.value } : s))}
                            placeholder="Enter message for this step..." rows={2}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => handleAIGenerate(step.id, index)} disabled={generatingStepId === step.id}>
                              {generatingStepId === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                              {generatingStepId === step.id ? "Generating..." : "AI Generate"}
                            </Button>
                          </div>
                          {index < dripSteps.length - 1 && (
                            <div className="flex justify-center pt-2"><ArrowRight className="h-5 w-5 text-muted-foreground" /></div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="pt-4 flex gap-2">
                    <Button className="flex-1 gap-2" onClick={handleLaunchDripCampaign} disabled={isLaunchingDrip || isSavingDraft}>
                      {isLaunchingDrip ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      {isLaunchingDrip ? "Launching..." : "Launch Drip Campaign"}
                    </Button>
                    <Button variant="outline" onClick={handleSaveAsDraft} disabled={isLaunchingDrip || isSavingDraft}>
                      {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {isSavingDraft ? "Saving..." : "Save as Draft"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 2: ACTIVE CAMPAIGNS ═══ */}
        <TabsContent value="active" className="space-y-6">
          {/* Live Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10"><Send className="h-5 w-5 text-green-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{mockActiveCampaigns.reduce((a, c) => a + c.sent, 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Sent</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10"><MessageCircle className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{mockActiveCampaigns.reduce((a, c) => a + c.replies, 0)}</p>
                  <p className="text-xs text-muted-foreground">Replies</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><BarChart3 className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">
                    {(mockActiveCampaigns.filter(c => c.delivered > 0).reduce((a, c) => a + c.ctr, 0) / Math.max(1, mockActiveCampaigns.filter(c => c.delivered > 0).length)).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Response Rate</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><XCircle className="h-5 w-5 text-destructive" /></div>
                <div>
                  <p className="text-2xl font-bold">{mockActiveCampaigns.reduce((a, c) => a + c.optOuts, 0)}</p>
                  <p className="text-xs text-muted-foreground">Opt-Outs</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaign List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                Campaign Monitor
              </CardTitle>
              <CardDescription>Live execution status and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Replies</TableHead>
                      <TableHead>Opt-Outs</TableHead>
                      <TableHead>Response %</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockActiveCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell><Badge variant="outline">{campaign.type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={
                            campaign.status === "running" ? "default" :
                            campaign.status === "paused" ? "secondary" :
                            campaign.status === "scheduled" ? "outline" : "secondary"
                          } className="gap-1">
                            {campaign.status === "running" && <Radio className="h-2.5 w-2.5 animate-pulse" />}
                            {campaign.status === "paused" && <Pause className="h-2.5 w-2.5" />}
                            {campaign.status === "scheduled" && <Clock className="h-2.5 w-2.5" />}
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{campaign.sent.toLocaleString()}</TableCell>
                        <TableCell>{campaign.delivered.toLocaleString()}</TableCell>
                        <TableCell>{campaign.replies}</TableCell>
                        <TableCell>
                          {campaign.optOuts > 0 ? (
                            <span className="text-destructive">{campaign.optOuts}</span>
                          ) : "0"}
                        </TableCell>
                        <TableCell>
                          <span className={campaign.ctr >= 10 ? "text-green-600 font-medium" : campaign.ctr >= 5 ? "text-yellow-600" : "text-muted-foreground"}>
                            {campaign.ctr}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {campaign.status === "running" && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {campaign.status === "paused" && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Delivery Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Delivery Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Delivery Rate</span>
                <span className="font-medium text-green-600">96.8%</span>
              </div>
              <Progress value={96.8} className="h-2" />
              <div className="grid grid-cols-3 gap-4 pt-2 text-center">
                <div><p className="text-lg font-bold text-green-600">1,425</p><p className="text-xs text-muted-foreground">Delivered</p></div>
                <div><p className="text-lg font-bold text-yellow-600">32</p><p className="text-xs text-muted-foreground">Pending</p></div>
                <div><p className="text-lg font-bold text-destructive">15</p><p className="text-xs text-muted-foreground">Failed</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB 3: CONVERSATIONS (AI AUTO-REPLIES) ═══ */}
        <TabsContent value="conversations" className="space-y-6">
          {/* Conversation Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10"><Bot className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{mockConversations.filter(c => c.status === "ai_handling").length}</p>
                  <p className="text-xs text-muted-foreground">AI Handling</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10"><AlertTriangle className="h-5 w-5 text-yellow-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{mockConversations.filter(c => c.status === "escalated").length}</p>
                  <p className="text-xs text-muted-foreground">Escalated</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{mockConversations.filter(c => c.status === "resolved").length}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversation List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                AI-Managed Conversations
              </CardTitle>
              <CardDescription>Replies from campaign recipients handled by AI — escalate or take over when needed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockConversations.map((conv) => (
                  <div key={conv.id} className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${
                    conv.status === "escalated" ? "border-yellow-500/50 bg-yellow-500/5" :
                    conv.status === "ai_handling" ? "border-blue-500/30 bg-blue-500/5" :
                    "border-border"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{conv.storeName}</span>
                        <Badge variant={
                          conv.status === "ai_handling" ? "default" :
                          conv.status === "escalated" ? "destructive" : "secondary"
                        } className="text-xs gap-1">
                          {conv.status === "ai_handling" && <Bot className="h-2.5 w-2.5" />}
                          {conv.status === "escalated" && <AlertTriangle className="h-2.5 w-2.5" />}
                          {conv.status === "resolved" && <CheckCircle className="h-2.5 w-2.5" />}
                          {conv.status === "ai_handling" ? "AI Handling" : conv.status === "escalated" ? "Needs Human" : "Resolved"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">via {conv.campaignName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{conv.lastMessageAt}</span>
                        <span>·</span>
                        <span>{conv.messageCount} messages</span>
                        <span>·</span>
                        <span>{conv.phone}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4 shrink-0">
                      {conv.status === "ai_handling" && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-8">
                          <UserCheck className="h-3 w-3" />
                          Take Over
                        </Button>
                      )}
                      {conv.status === "escalated" && (
                        <Button size="sm" variant="default" className="gap-1 text-xs h-8">
                          <PhoneForwarded className="h-3 w-3" />
                          Handle Now
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Schedule Campaign
            </DialogTitle>
            <DialogDescription>
              Choose when to send "{campaignName || "your campaign"}" to {selectedSegment || "selected stores"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Select value={scheduleTime} onValueChange={setScheduleTime}>
                <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                <SelectContent>
                  {["06:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"].map(t => (
                    <SelectItem key={t} value={t}>{parseInt(t) > 12 ? `${parseInt(t)-12}:00 PM` : parseInt(t) === 12 ? "12:00 PM" : `${parseInt(t)}:00 AM`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">Campaign Summary</p>
              <p className="text-xs text-muted-foreground">Message: {messageContent.slice(0, 50)}{messageContent.length > 50 ? "..." : ""}</p>
              <p className="text-xs text-muted-foreground">Target: {selectedSegment || "Not selected"}</p>
              <p className="text-xs text-muted-foreground">Rate: {throttle} messages/minute</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowScheduleModal(false)} disabled={isScheduling}>Cancel</Button>
            <Button onClick={handleConfirmSchedule} disabled={isScheduling || !scheduleDate || !scheduleTime} className="gap-2">
              {isScheduling ? <><Loader2 className="h-4 w-4 animate-spin" />Scheduling...</> : <><Clock className="h-4 w-4" />Confirm Schedule</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
