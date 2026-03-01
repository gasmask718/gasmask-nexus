import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Send, Zap, Users, Calendar, Loader2, Wand2, Sparkles, Shield, AlertTriangle,
} from "lucide-react";

const SEGMENTS = [
  { value: "all", label: "All Stores" },
  { value: "borough_manhattan", label: "Manhattan" },
  { value: "borough_brooklyn", label: "Brooklyn" },
  { value: "borough_bronx", label: "Bronx" },
  { value: "borough_queens", label: "Queens" },
  { value: "new_30d", label: "New Stores (30 days)" },
  { value: "dead_60d", label: "Dead Stores (60+ days)" },
  { value: "high_value", label: "High Value" },
  { value: "low_engagement", label: "Low Engagement" },
];

const TEMPLATES = [
  { name: "Inventory Check", category: "Operations", msg: "Hi this is GasMask —\nQuick inventory check:\nHow many tubes do you currently have left?\n(few / 1/4 / 1/2 / 3/4 / full)" },
  { name: "New Product Alert", category: "Promo", msg: "Hey {{contact_name}}! GasMask just dropped new products for {{store_name}}. Reply YES to see the lineup!" },
  { name: "Payment Reminder", category: "Collections", msg: "Hi {{contact_name}}, friendly reminder on your balance for {{store_name}}. Need help? Reply here." },
  { name: "Reactivation", category: "Win Back", msg: "Hi {{contact_name}}, we miss {{store_name}}! It's been a while — got a minute to catch up?" },
];

export default function ManualBulkTab() {
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  const [campaignName, setCampaignName] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [throttle, setThrottle] = useState("50");
  const [jitterEnabled, setJitterEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  // Get store count for selected segment
  const { data: storeCount } = useQuery({
    queryKey: ["store-count-segment", selectedSegment, currentBusiness?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("store_master")
        .select("id", { count: "exact", head: true });
      return count || 0;
    },
    enabled: !!selectedSegment,
  });

  const handleSendNow = async () => {
    if (!campaignName || !messageContent || !selectedSegment) {
      toast({ title: "Missing Information", description: "Fill in all required fields.", variant: "destructive" });
      return;
    }
    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.from("messaging_campaigns").insert({
        business_id: currentBusiness?.id || null,
        mode: "manual_bulk",
        name: campaignName,
        script: messageContent,
        ai_enabled: false,
        status: "active",
        target_filter: { segment: selectedSegment, throttle: parseInt(throttle), jitter: jitterEnabled },
        throttle_per_minute: parseInt(throttle),
        total_targets: storeCount || 0,
        created_by: user.id,
      }).select().single();

      if (error) throw error;

      // Launch via edge function
      await supabase.functions.invoke("messaging-launch", {
        body: { campaign_id: data.id },
      });

      toast({ title: "Campaign Launched!", description: `"${campaignName}" is now sending to ${storeCount || 0} recipients.` });
      setCampaignName(""); setMessageContent(""); setSelectedSegment("");
    } catch (error: any) {
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast({ title: "Select Date & Time", variant: "destructive" });
      return;
    }
    setIsScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

      await supabase.from("messaging_campaigns").insert({
        business_id: currentBusiness?.id || null,
        mode: "manual_bulk",
        name: campaignName,
        script: messageContent,
        ai_enabled: false,
        status: "pending",
        target_filter: { segment: selectedSegment, throttle: parseInt(throttle), jitter: jitterEnabled },
        throttle_per_minute: parseInt(throttle),
        total_targets: storeCount || 0,
        scheduled_at: scheduledAt,
        created_by: user.id,
      });

      toast({ title: "Campaign Scheduled", description: `"${campaignName}" scheduled for ${scheduleDate} at ${scheduleTime}.` });
      setShowScheduleModal(false);
      setCampaignName(""); setMessageContent(""); setSelectedSegment("");
    } catch (error: any) {
      toast({ title: "Schedule Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Manual Bulk Message
          </CardTitle>
          <CardDescription>Send ONE message to MANY stores instantly — operator controlled</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input placeholder="e.g., Monday Inventory Check" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Select value={selectedSegment} onValueChange={setSelectedSegment}>
              <SelectTrigger><SelectValue placeholder="Select target stores" /></SelectTrigger>
              <SelectContent>
                {SEGMENTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedSegment && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-primary">{storeCount?.toLocaleString() || "..."} recipients selected</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Message Content</Label>
            <Textarea
              placeholder={"Hi this is GasMask —\nQuick inventory check:\nHow many tubes do you currently have left?\n(few / 1/4 / 1/2 / 3/4 / full)"}
              value={messageContent}
              onChange={e => setMessageContent(e.target.value)}
              rows={5}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Variables: {"{{store_name}}"}, {"{{contact_name}}"}
              </p>
              <p className="text-xs text-muted-foreground">{messageContent.length}/160</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Send Rate</Label>
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
            <div className="space-y-2">
              <Label>Random Delay Jitter</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={jitterEnabled} onCheckedChange={setJitterEnabled} />
                <span className="text-sm text-muted-foreground">{jitterEnabled ? "On" : "Off"}</span>
              </div>
            </div>
          </div>

          {/* Compliance Guard */}
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-3 flex items-start gap-2">
              <Shield className="h-4 w-4 text-warning mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Compliance Guard Active</p>
                Auto-blocks: opted-out contacts, no SMS consent, quiet hours (9PM-8AM)
              </div>
            </CardContent>
          </Card>

          <div className="pt-2 flex gap-2">
            <Button className="flex-1 gap-2" onClick={handleSendNow} disabled={!campaignName || !messageContent || !selectedSegment || isSending}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? "Launching..." : "Send Now"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              if (!campaignName || !messageContent || !selectedSegment) {
                toast({ title: "Fill all fields first", variant: "destructive" });
                return;
              }
              setShowScheduleModal(true);
            }}>
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
                <p className="text-sm whitespace-pre-wrap">{messageContent || "Your message preview will appear here..."}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">{messageContent.length}/160 characters</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2">
              {TEMPLATES.map((t, i) => (
                <Card
                  key={i}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => { setMessageContent(t.msg); toast({ title: `Loaded: ${t.name}` }); }}
                >
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

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
            <DialogDescription>Choose when to send "{campaignName}"</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={isScheduling} className="gap-2">
              {isScheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              {isScheduling ? "Scheduling..." : "Confirm Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
