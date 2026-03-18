import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Database, Phone, Star, MapPin, Filter, MessageSquare, ListPlus, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast as sonnerToast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500",
  queued: "bg-violet-500/10 text-violet-500",
  calling: "bg-amber-500/10 text-amber-500",
  no_answer: "bg-gray-500/10 text-gray-400",
  voicemail: "bg-gray-500/10 text-gray-400",
  callback: "bg-orange-500/10 text-orange-500",
  interested: "bg-emerald-500/10 text-emerald-500",
  hot_lead: "bg-red-500/10 text-red-500",
  sold: "bg-green-500/10 text-green-600",
  not_interested: "bg-gray-600/10 text-gray-500",
  send_info: "bg-cyan-500/10 text-cyan-500",
  wrong_number: "bg-gray-600/10 text-gray-500",
  disqualified: "bg-gray-700/10 text-gray-600",
};

const TIER_COLORS: Record<string, string> = {
  tier_1: "bg-red-500/10 text-red-500 border-red-500/20",
  tier_2: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  tier_3: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

export default function LeadDatabasePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [callingId, setCallingId] = useState<string | null>(null);
  const [textingId, setTextingId] = useState<string | null>(null);
  const [queuingId, setQueuingId] = useState<string | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["brandaro-qualified-leads", filterTier, filterStatus, search],
    queryFn: async () => {
      let query = supabase
        .from("brandaro_qualified_leads")
        .select("*")
        .order("priority_score", { ascending: false })
        .limit(200);

      if (filterTier !== "all") query = query.eq("priority_tier", filterTier);
      if (filterStatus !== "all") query = query.eq("lead_status", filterStatus);
      if (search) query = query.ilike("business_name", `%${search}%`);

      const { data } = await query;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("brandaro_qualified_leads")
        .update({ lead_status: status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-qualified-leads"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-qualified-stats"] });
    },
  });

  // ── Call Now ──
  const handleCallNow = async (lead: any) => {
    if (!lead.phone_number) { sonnerToast.error("No phone number"); return; }
    setCallingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke('brandaro-closer-action', {
        body: { action: 'call', phone: lead.phone_number, lead_id: lead.id },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Call failed');
      sonnerToast.success(`📞 Call initiated to ${lead.business_name}`);
      // Update last contact
      await (supabase as any).from("brandaro_qualified_leads")
        .update({ lead_status: 'calling', updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      queryClient.invalidateQueries({ queryKey: ["brandaro-qualified-leads"] });
    } catch (err: any) {
      sonnerToast.error(`Call failed: ${err.message}`);
    } finally {
      setCallingId(null);
    }
  };

  // ── Text Now ──
  const handleTextNow = async (lead: any) => {
    if (!lead.phone_number) { sonnerToast.error("No phone number"); return; }
    setTextingId(lead.id);
    try {
      const message = `Hi! This is Brandaro Digital. We build professional websites for businesses like ${lead.business_name || 'yours'}. Interested in a free demo? Reply YES!`;
      const { data, error } = await supabase.functions.invoke('brandaro-closer-action', {
        body: { action: 'sms', phone: lead.phone_number, message, lead_id: lead.id },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'SMS failed');
      sonnerToast.success(`💬 SMS sent to ${lead.business_name}`);
    } catch (err: any) {
      sonnerToast.error(`SMS failed: ${err.message}`);
    } finally {
      setTextingId(null);
    }
  };

  // ── Add to Queue ──
  const handleAddToQueue = async (lead: any) => {
    setQueuingId(lead.id);
    try {
      const { error } = await (supabase as any).from("brandaro_call_queue").insert({
        lead_id: lead.id,
        priority_tier: lead.priority_tier === "tier_1" ? 1 : lead.priority_tier === "tier_2" ? 2 : 3,
        priority_score: lead.priority_score || 50,
        retry_count: lead.call_attempts || 0,
      });
      if (error) throw error;
      sonnerToast.success(`Added ${lead.business_name} to call queue`);
      // Update status
      await (supabase as any).from("brandaro_qualified_leads")
        .update({ lead_status: 'queued', updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      queryClient.invalidateQueries({ queryKey: ["brandaro-qualified-leads"] });
    } catch (err: any) {
      sonnerToast.error(`Queue failed: ${err.message}`);
    } finally {
      setQueuingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-cyan-500" />
          Lead Database
        </h1>
        <p className="text-muted-foreground">Qualified leads with priority scoring and status tracking</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search business name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
            />
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="tier_1">🔴 Tier 1 — Immediate</SelectItem>
                <SelectItem value="tier_2">🟡 Tier 2 — Medium</SelectItem>
                <SelectItem value="tier_3">🔵 Tier 3 — Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="calling">Calling</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="hot_lead">Hot Lead</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="callback">Callback</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{leads?.length || 0} leads</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center">Loading...</TableCell></TableRow>
                ) : leads?.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">
                    No qualified leads. Import and qualify leads from the Discovery Engine.
                  </TableCell></TableRow>
                ) : leads?.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Badge className={TIER_COLORS[lead.priority_tier || "tier_3"]}>
                        {lead.priority_tier?.replace("_", " ").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{lead.priority_score}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{lead.business_name}</TableCell>
                    <TableCell className="text-sm">
                      {lead.phone_number ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {lead.phone_number}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {lead.city || "—"}, {lead.state || ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{lead.industry || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {lead.rating ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-400" /> {lead.rating} ({lead.review_count})
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[lead.lead_status || "new"]}>
                        {(lead.lead_status || "new").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-center">{lead.call_attempts || 0}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.lead_status || "new"}
                        onValueChange={(val) => updateStatus.mutate({ id: lead.id, status: val })}
                      >
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="queued">Queue</SelectItem>
                          <SelectItem value="interested">Interested</SelectItem>
                          <SelectItem value="hot_lead">Hot Lead</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                          <SelectItem value="callback">Callback</SelectItem>
                          <SelectItem value="disqualified">Disqualify</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
