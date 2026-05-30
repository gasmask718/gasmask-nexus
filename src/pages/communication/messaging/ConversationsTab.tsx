import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Bot, User, MessageSquare, AlertTriangle, CheckCircle, Phone, Search, Filter, FileText, Mail, PhoneCall, RefreshCw, MapPin } from "lucide-react";
import { useStoreIdentityMap, phoneToKey, type StoreIdentityMatch } from "@/hooks/useStoreIdentityMap";

interface UnifiedMessage {
  id: string;
  phone: string;
  direction: string;
  body: string;
  status: string;
  created_at: string;
  source: "campaign" | "invoice" | "comm_sms" | "comm_email" | "comm_call" | "comm_ai_call" | "twilio_log";
  campaign_name?: string;
  campaign_id?: string;
  ai_generated?: boolean;
  channel?: string;
  twilio_sid?: string;
}

export default function ConversationsTab() {
  const queryClient = useQueryClient();
  const { currentBusiness } = useBusiness();
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [searchPhone, setSearchPhone] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const { data: identityMap } = useStoreIdentityMap();

  const resolveIdentity = useCallback(
    (rawPhone: string | null | undefined): StoreIdentityMatch | null => {
      const key = phoneToKey(rawPhone);
      if (!key || !identityMap) return null;
      return identityMap.get(key) || null;
    },
    [identityMap]
  );

  // Fetch Twilio message history via edge function
  const fetchTwilioMessages = useCallback(async (): Promise<UnifiedMessage[]> => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-twilio-messages");
      if (error || !data?.messages) return [];
      return (data.messages as any[]).map((msg: any) => ({
        id: msg.sid || msg.id,
        phone: msg.direction === "outbound-api" || msg.direction === "outbound" ? msg.to : msg.from,
        direction: msg.direction?.includes("outbound") ? "outbound" : "inbound",
        body: msg.body || "",
        status: msg.status || "sent",
        created_at: msg.date_sent || msg.date_created || new Date().toISOString(),
        source: "twilio_log" as const,
        channel: "sms",
        twilio_sid: msg.sid,
      }));
    } catch {
      return [];
    }
  }, []);

  const { data: threads, isLoading: threadsLoading, refetch } = useQuery({
    queryKey: ["unified-conversations", currentBusiness?.id],
    queryFn: async () => {
      // 1. Fetch messaging_messages (campaigns + invoice receipts)
      const { data: msgData } = await (supabase as any)
        .from("messaging_messages")
        .select("id, campaign_id, direction, body, ai_generated, status, phone, created_at, twilio_sid, messaging_campaigns(name)")
        .order("created_at", { ascending: false })
        .limit(1000);

      // 2. Fetch communication_logs (SMS, email, calls, AI calls)
      const { data: commData } = await supabase
        .from("communication_logs")
        .select("id, channel, direction, summary, message_content, delivery_status, recipient_phone, sender_phone, created_at, outcome, performed_by")
        .order("created_at", { ascending: false })
        .limit(1000);

      // 3. Fetch Twilio API messages
      const twilioMsgs = await fetchTwilioMessages();

      const unified: UnifiedMessage[] = [];
      const seenSids = new Set<string>();

      // Map messaging_messages
      for (const msg of msgData || []) {
        const source = msg.campaign_id ? "campaign" : "invoice";
        if (msg.twilio_sid) seenSids.add(msg.twilio_sid);
        unified.push({
          id: msg.id,
          phone: msg.phone || "",
          direction: msg.direction || "outbound",
          body: msg.body || "",
          status: msg.status || "sent",
          created_at: msg.created_at,
          source,
          campaign_name: msg.campaign_id ? (msg.messaging_campaigns?.name || "Unknown Campaign") : "Invoice Receipt",
          campaign_id: msg.campaign_id,
          ai_generated: msg.ai_generated,
          channel: "sms",
          twilio_sid: msg.twilio_sid,
        });
      }

      // Map communication_logs
      for (const log of (commData as any[]) || []) {
        const phone = log.direction === "outbound" ? log.recipient_phone : log.sender_phone;
        if (!phone) continue;

        let source: UnifiedMessage["source"] = "comm_sms";
        if (log.channel === "email") source = "comm_email";
        else if (log.channel === "call") source = "comm_call";
        else if (log.channel === "ai_call" || log.channel === "va_call") source = "comm_ai_call";

        unified.push({
          id: log.id,
          phone: phone || "",
          direction: log.direction || "outbound",
          body: log.message_content || log.summary || "",
          status: log.delivery_status || log.outcome || "sent",
          created_at: log.created_at,
          source,
          channel: log.channel,
          ai_generated: log.performed_by === "ai",
        });
      }

      // Add Twilio messages not already tracked in messaging_messages (dedupe by SID)
      for (const tm of twilioMsgs) {
        if (tm.twilio_sid && seenSids.has(tm.twilio_sid)) continue;
        unified.push(tm);
      }

      // Sort all by date desc
      unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Group into threads by phone
      const grouped = new Map<string, any>();
      for (const msg of unified) {
        // Normalize phone for grouping
        const cleanPhone = msg.phone?.replace(/\D/g, "").slice(-10) || "unknown";
        const key = msg.campaign_id
          ? `campaign_${msg.campaign_id}_${cleanPhone}`
          : `${msg.source}_${cleanPhone}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            phone: msg.phone,
            cleanPhone,
            source: msg.source,
            campaignId: msg.campaign_id || null,
            campaignName: msg.campaign_name || getSourceLabel(msg.source),
            lastMessage: msg.body,
            lastMessageAt: msg.created_at,
            aiGenerated: msg.ai_generated,
            messageCount: 0,
            hasInbound: false,
            hasFailed: false,
            channel: msg.channel,
          });
        }
        const entry = grouped.get(key)!;
        entry.messageCount++;
        if (msg.direction === "inbound") entry.hasInbound = true;
        if (msg.status === "failed" || msg.status === "undelivered") entry.hasFailed = true;
      }

      return Array.from(grouped.values());
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // Apply filters
  const filteredThreads = (threads || []).filter((t: any) => {
    if (searchPhone) {
      const q = searchPhone.toLowerCase();
      const id = resolveIdentity(t.phone);
      const inPhone = t.phone?.toLowerCase().includes(q) || t.cleanPhone?.includes(searchPhone.replace(/\D/g, ""));
      const inName = id?.primaryName?.toLowerCase().includes(q);
      const inAddress = id?.address?.toLowerCase().includes(q);
      if (!inPhone && !inName && !inAddress) return false;
    }
    if (statusFilter === "needs_review" && !t.hasInbound) return false;
    if (statusFilter === "failed" && !t.hasFailed) return false;
    if (statusFilter === "sent" && (t.hasInbound || t.hasFailed)) return false;
    if (directionFilter === "inbound" && !t.hasInbound) return false;
    if (directionFilter === "outbound" && t.hasInbound) return false;
    if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
    return true;
  });

  const selectedThread = filteredThreads?.find((t: any) => t.key === selectedThreadKey);

  // Fetch transcript for selected thread
  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ["unified-transcript", selectedThread?.phone, selectedThread?.campaignId, selectedThread?.source],
    queryFn: async () => {
      if (!selectedThread) return [];
      const results: UnifiedMessage[] = [];
      const cleanPhone = selectedThread.phone?.replace(/\D/g, "").slice(-10) || "";

      // Fetch from messaging_messages
      let msgQuery = (supabase as any)
        .from("messaging_messages")
        .select("id, campaign_id, direction, body, ai_generated, status, phone, created_at, twilio_sid")
        .or(`phone.ilike.%${cleanPhone}%`)
        .order("created_at", { ascending: true })
        .limit(200);

      if (selectedThread.campaignId) {
        msgQuery = msgQuery.eq("campaign_id", selectedThread.campaignId);
      }

      const { data: msgData } = await msgQuery;
      for (const m of msgData || []) {
        results.push({
          id: m.id, phone: m.phone, direction: m.direction || "outbound",
          body: m.body || "", status: m.status || "sent", created_at: m.created_at,
          source: m.campaign_id ? "campaign" : "invoice", ai_generated: m.ai_generated,
          channel: "sms", twilio_sid: m.twilio_sid,
        });
      }

      // Fetch from communication_logs
      if (!selectedThread.campaignId) {
        const { data: commData } = await supabase
          .from("communication_logs")
          .select("id, channel, direction, summary, message_content, delivery_status, recipient_phone, sender_phone, created_at, outcome, performed_by")
          .or(`recipient_phone.ilike.%${cleanPhone}%,sender_phone.ilike.%${cleanPhone}%`)
          .order("created_at", { ascending: true })
          .limit(200);

        for (const log of (commData as any[]) || []) {
          let source: UnifiedMessage["source"] = "comm_sms";
          if (log.channel === "email") source = "comm_email";
          else if (log.channel === "call") source = "comm_call";
          else if (log.channel === "ai_call" || log.channel === "va_call") source = "comm_ai_call";

          results.push({
            id: log.id,
            phone: log.direction === "outbound" ? log.recipient_phone : log.sender_phone,
            direction: log.direction || "outbound",
            body: log.message_content || log.summary || "",
            status: log.delivery_status || log.outcome || "sent",
            created_at: log.created_at,
            source, channel: log.channel, ai_generated: log.performed_by === "ai",
          });
        }
      }

      results.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return results;
    },
    enabled: !!selectedThreadKey && !!selectedThread,
  });

  // Realtime: auto-refresh when new messages arrive
  useEffect(() => {
    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messaging_messages',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['unified-conversations'] });
        if (selectedThreadKey) {
          queryClient.invalidateQueries({ queryKey: ['unified-transcript'] });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'communication_logs',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['unified-conversations'] });
        if (selectedThreadKey) {
          queryClient.invalidateQueries({ queryKey: ['unified-transcript'] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedThreadKey]);

  const getStatusBadge = (conv: any) => {
    if (conv.source === "twilio_log") return <Badge className="gap-1 bg-green-500/20 text-green-700 border-green-500/30"><Phone className="h-3 w-3" /> Twilio</Badge>;
    if (conv.source === "invoice") return <Badge className="gap-1 bg-amber-500/20 text-amber-700 border-amber-500/30"><FileText className="h-3 w-3" /> Receipt</Badge>;
    if (conv.source === "comm_call" || conv.source === "comm_ai_call") return <Badge className="gap-1 bg-purple-500/20 text-purple-700 border-purple-500/30"><PhoneCall className="h-3 w-3" /> Call</Badge>;
    if (conv.source === "comm_email") return <Badge className="gap-1 bg-blue-500/20 text-blue-700 border-blue-500/30"><Mail className="h-3 w-3" /> Email</Badge>;
    if (conv.hasInbound) return <Badge className="gap-1 bg-destructive/20 text-destructive border-destructive/30"><AlertTriangle className="h-3 w-3" /> Needs Review</Badge>;
    if (conv.hasFailed) return <Badge variant="destructive" className="gap-1 text-xs">Failed</Badge>;
    if (conv.aiGenerated) return <Badge className="gap-1 bg-primary/20 text-primary border-primary/30"><Bot className="h-3 w-3" /> AI</Badge>;
    return <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3" /> Sent</Badge>;
  };

  if (threadsLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading conversations...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by phone..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px] h-9"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="campaign">Campaigns</SelectItem>
            <SelectItem value="invoice">Invoice Receipts</SelectItem>
            <SelectItem value="comm_sms">Direct SMS</SelectItem>
            <SelectItem value="comm_email">Email</SelectItem>
            <SelectItem value="comm_call">Calls</SelectItem>
            <SelectItem value="comm_ai_call">AI Calls</SelectItem>
            <SelectItem value="twilio_log">Twilio Logs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 h-9">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-muted-foreground text-xs"><MessageSquare className="h-3.5 w-3.5" /> All</div><p className="text-xl font-bold mt-1">{(threads || []).length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-muted-foreground text-xs"><MessageSquare className="h-3.5 w-3.5" /> Campaigns</div><p className="text-xl font-bold mt-1">{(threads || []).filter((c: any) => c.source === "campaign").length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-muted-foreground text-xs"><FileText className="h-3.5 w-3.5" /> Receipts</div><p className="text-xl font-bold mt-1">{(threads || []).filter((c: any) => c.source === "invoice").length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Phone className="h-3.5 w-3.5" /> SMS</div><p className="text-xl font-bold mt-1">{(threads || []).filter((c: any) => c.source === "comm_sms" || c.source === "twilio_log").length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-muted-foreground text-xs"><PhoneCall className="h-3.5 w-3.5" /> Calls</div><p className="text-xl font-bold mt-1">{(threads || []).filter((c: any) => c.source === "comm_call" || c.source === "comm_ai_call").length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Review</div><p className="text-xl font-bold mt-1">{(threads || []).filter((c: any) => c.hasInbound).length}</p></CardContent></Card>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
        <Card className="col-span-1 flex flex-col h-full overflow-hidden">
          <CardHeader className="py-4 border-b"><CardTitle className="text-lg">All Conversations ({filteredThreads.length})</CardTitle></CardHeader>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {filteredThreads.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No conversations match filters.</div>
              ) : filteredThreads.map((thread: any) => (
                <div key={thread.key} onClick={() => setSelectedThreadKey(thread.key)}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedThreadKey === thread.key ? "bg-muted" : ""}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold truncate">{thread.phone || "Unknown"}</p>
                    {getStatusBadge(thread)}
                  </div>
                  <p className="text-xs text-primary truncate mb-2">{thread.campaignName || getSourceLabel(thread.source)}</p>
                  <p className="text-sm text-muted-foreground truncate">{thread.lastMessage}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>{thread.messageCount} messages</span>
                    <span>{new Date(thread.lastMessageAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="col-span-1 md:col-span-2 flex flex-col h-full overflow-hidden bg-muted/10">
          {selectedThreadKey && selectedThread ? (
            <>
              <CardHeader className="py-4 border-b bg-background">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">{selectedThread.phone}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      Source: <span className="font-medium text-foreground">{selectedThread.campaignName || getSourceLabel(selectedThread.source)}</span>
                      <Badge variant="outline" className="ml-2 bg-green-50 text-green-600 border-green-200 gap-1"><Phone className="h-3 w-3" /> Twilio</Badge>
                    </p>
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-4">
                {transcriptLoading ? (
                  <div className="text-center text-muted-foreground py-10">Loading transcript...</div>
                ) : (
                  <div className="space-y-6">
                    {transcript?.map((msg: UnifiedMessage) => {
                      const isOutbound = msg.direction === "outbound";
                      return (
                        <div key={msg.id} className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</span>
                            {getChannelIcon(msg.channel || msg.source)}
                            {msg.ai_generated && <Bot className="h-3 w-3 text-primary" />}
                            {!isOutbound && <User className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <div className={`max-w-[80%] rounded-lg p-3 text-sm shadow-sm ${isOutbound ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-background border rounded-tl-none"}`}>
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                            {isOutbound ? (<>Sent via {getProviderLabel(msg.source)} • Status: <span className="capitalize">{msg.status}</span></>) : (<>Received</>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p>Select a conversation to view the full transcript.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "campaign": return "Campaign";
    case "invoice": return "Invoice Receipt";
    case "comm_sms": return "Direct SMS";
    case "comm_email": return "Email";
    case "comm_call": return "Phone Call";
    case "comm_ai_call": return "AI Call";
    case "twilio_log": return "Twilio Message";
    default: return "Message";
  }
}

function getProviderLabel(source: string): string {
  if (source === "twilio_log") return "Twilio";
  if (source.startsWith("comm_")) return "System";
  return "Twilio";
}

function getChannelIcon(channel?: string) {
  switch (channel) {
    case "email":
    case "comm_email":
      return <Mail className="h-3 w-3 text-blue-500" />;
    case "call":
    case "comm_call":
    case "ai_call":
    case "comm_ai_call":
      return <PhoneCall className="h-3 w-3 text-purple-500" />;
    default:
      return <MessageSquare className="h-3 w-3 text-green-500" />;
  }
}
