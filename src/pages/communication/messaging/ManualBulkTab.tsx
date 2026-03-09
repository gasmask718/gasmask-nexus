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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Send, Zap, Calendar, Loader2, Shield, AlertTriangle } from "lucide-react";
import ContactSelector, { SelectedContact } from "@/components/communication/ContactSelector";

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
  const [selectedContacts, setSelectedContacts] = useState<Map<string, SelectedContact>>(new Map());
  const [customNumbers, setCustomNumbers] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [throttle, setThrottle] = useState("50");
  const [jitterEnabled, setJitterEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"send" | "schedule" | null>(null);

  const handleSelectionChange = useCallback((contacts: Map<string, SelectedContact>) => {
    setSelectedContacts(contacts);
  }, []);

  const customNumbersList = customNumbers.split(",").map((n) => n.trim()).filter((n) => n);
  const recipientCount = selectedContacts.size + customNumbersList.length;
  const canSend = !!campaignName && !!messageContent && recipientCount > 0;

  const triggerSend = (action: "send" | "schedule") => {
    if (!canSend) {
      toast({ title: "Missing Information", description: "Fill in all required fields and select targets.", variant: "destructive" });
      return;
    }
    if (action === "schedule" && (!scheduleDate || !scheduleTime)) {
      setShowScheduleModal(true);
      return;
    }
    if (recipientCount > 500) {
      setPendingAction(action);
      setShowConfirmModal(true);
    } else {
      executeSend(action);
    }
  };

  const executeSend = async (action: "send" | "schedule") => {
    const isSchedule = action === "schedule";
    isSchedule ? setIsScheduling(true) : setIsSending(true);
    setShowConfirmModal(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const contacts = Array.from(selectedContacts.values());
      const targetFilter = {
        contacts,
        custom_numbers: customNumbersList,
        throttle: parseInt(throttle),
        jitter: jitterEnabled,
      };

      const campaignPayload: any = {
        business_id: currentBusiness?.id || null,
        mode: "manual_bulk",
        provider: "twilio",
        name: campaignName,
        script: messageContent,
        ai_enabled: false,
        status: isSchedule ? "pending" : "active",
        target_filter: targetFilter,
        throttle_per_minute: parseInt(throttle),
        total_targets: recipientCount,
        created_by: user.id,
      };

      if (isSchedule) {
        campaignPayload.scheduled_at = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      }

      const { data, error } = await (supabase as any)
        .from("messaging_campaigns")
        .insert(campaignPayload)
        .select()
        .single();
      if (error) throw error;

      if (!isSchedule) {
        await (supabase as any).functions.invoke("messaging-launch", { body: { campaign_id: data.id } });
      }

      toast({
        title: isSchedule ? "Campaign Scheduled" : "Campaign Launched!",
        description: `"${campaignName}" ${isSchedule ? "scheduled" : "sending"} via Twilio to ${recipientCount.toLocaleString()} recipients.`,
      });

      setCampaignName("");
      setMessageContent("");
      setCustomNumbers("");
      setSelectedContacts(new Map());
      setShowScheduleModal(false);
    } catch (error: any) {
      toast({ title: isSchedule ? "Schedule Failed" : "Send Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
      setIsScheduling(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Manual Bulk Message
          </CardTitle>
          <CardDescription>Send instantly via Twilio to selected contacts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input placeholder="e.g., Monday Inventory Check" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </div>

          <ContactSelector
            selectedContacts={selectedContacts}
            onSelectionChange={handleSelectionChange}
            customNumbers={customNumbers}
            onCustomNumbersChange={setCustomNumbers}
          />

          <div className="space-y-2">
            <Label>Message Content</Label>
            <Textarea
              placeholder="Hi this is GasMask —\nQuick inventory check..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={5}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Variables: {"{{contact_name}}, {{store_name}}"}</p>
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
            <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => triggerSend("send")} disabled={!canSend || isSending}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? "Launching..." : "Send via Twilio"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { if (!canSend) { toast({ title: "Fill all fields first", variant: "destructive" }); return; } setShowScheduleModal(true); }}>
              <Calendar className="h-4 w-4" /> Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Message Preview</CardTitle><CardDescription>How your message will appear</CardDescription></CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4">
              <div className="bg-blue-600 text-white rounded-lg p-3 max-w-[80%] ml-auto">
                <p className="text-sm whitespace-pre-wrap">{messageContent || "Your message preview will appear here..."}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">{messageContent.length}/160 characters</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick Templates</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2">
              {TEMPLATES.map((t, i) => (
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

      {/* Confirm Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Confirm Twilio Bulk Send</DialogTitle>
            <DialogDescription>You are about to send to {recipientCount.toLocaleString()} recipients via Twilio. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => pendingAction && executeSend(pendingAction)}>Confirm Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
            <DialogDescription>Choose when to send "{campaignName}"</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Time</Label><Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => triggerSend("schedule")} disabled={!scheduleDate || !scheduleTime || isScheduling}>
              {isScheduling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
