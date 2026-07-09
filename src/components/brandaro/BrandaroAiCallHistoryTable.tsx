import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronDown, ChevronRight, Phone, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const OUTCOME_STYLES: Record<string, string> = {
  interested: "bg-green-500/15 text-green-400 border-green-500/30",
  hot: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  hot_lead: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  booked: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  callback: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  demo_sent: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  not_interested: "bg-red-500/15 text-red-400 border-red-500/30",
  do_not_call: "bg-red-500/15 text-red-400 border-red-500/30",
  no_answer: "bg-muted text-muted-foreground",
  voicemail: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  connected: "bg-green-500/15 text-green-400 border-green-500/30",
  answered: "bg-green-500/15 text-green-400 border-green-500/30",
  "in-progress": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  busy: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "no-answer": "bg-muted text-muted-foreground",
};

function truncate(s: string | null, n = 100) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

export function BrandaroAiCallHistoryTable() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["brandaro-ai-calls-history", outcomeFilter],
    queryFn: async () => {
      let q = supabase
        .from("brandaro_ai_calls")
        .select(`
          id, lead_id, status, outcome, interest_level, transcript,
          ai_score, duration_seconds, called_at, completed_at, created_at,
          brandaro_qualified_leads:lead_id ( business_name, phone_number, city, state, industry )
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      if (outcomeFilter !== "all") q = q.eq("outcome", outcomeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const filtered = calls.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const lead = c.brandaro_qualified_leads;
    return (
      lead?.business_name?.toLowerCase().includes(s) ||
      lead?.phone_number?.toLowerCase().includes(s) ||
      lead?.city?.toLowerCase().includes(s) ||
      c.outcome?.toLowerCase().includes(s) ||
      c.status?.toLowerCase().includes(s) ||
      c.transcript?.toLowerCase().includes(s)
    );
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4 text-primary" />
          Call History
          <Badge variant="outline" className="ml-1 text-[10px]">
            brandaro_ai_calls · {filtered.length}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2 pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search business, phone, outcome, transcript…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All outcomes</option>
            <option value="interested">Interested</option>
            <option value="hot_lead">Hot Lead</option>
            <option value="booked">Booked</option>
            <option value="callback">Callback</option>
            <option value="demo_sent">Demo Sent</option>
            <option value="not_interested">Not Interested</option>
            <option value="no_answer">No Answer</option>
            <option value="voicemail">Voicemail</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">No calls found</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">AI Score</TableHead>
                  <TableHead>Transcript</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => {
                  const lead = c.brandaro_qualified_leads;
                  const isOpen = expanded.has(c.id);
                  const hasTranscript = !!c.transcript;
                  return (
                    <>
                      <TableRow key={c.id} className={cn(hasTranscript && "cursor-pointer")} onClick={() => hasTranscript && toggle(c.id)}>
                        <TableCell>
                          {hasTranscript ? (
                            isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{lead?.business_name || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {[lead?.city, lead?.state].filter(Boolean).join(", ")}
                            {lead?.phone_number ? ` · ${lead.phone_number}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLES[String(c.status || "").toLowerCase()] || "")}>
                            {c.status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.outcome ? (
                            <Badge variant="outline" className={cn("text-[10px] capitalize", OUTCOME_STYLES[String(c.outcome).toLowerCase()] || "")}>
                              {String(c.outcome).replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {c.duration_seconds ? `${Math.round(c.duration_seconds)}s` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {c.ai_score != null ? Number(c.ai_score).toFixed(0) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="text-[11px] text-muted-foreground">
                            {hasTranscript ? truncate(c.transcript, 100) : <em>no transcript</em>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-[10px] text-muted-foreground whitespace-nowrap">
                          {c.called_at || c.created_at
                            ? format(new Date(c.called_at || c.created_at), "MMM d, h:mm a")
                            : "—"}
                        </TableCell>
                      </TableRow>
                      {isOpen && hasTranscript && (
                        <TableRow key={c.id + "-t"}>
                          <TableCell colSpan={8} className="bg-muted/40">
                            <div className="text-[11px] text-muted-foreground whitespace-pre-wrap py-2 px-1 leading-relaxed max-h-64 overflow-y-auto">
                              {c.transcript}
                            </div>
                            <div className="flex items-center gap-3 pb-2 text-[10px] text-muted-foreground">
                              {c.interest_level && <span>interest: <strong className="text-foreground">{c.interest_level}</strong></span>}
                              {c.completed_at && <span>completed: {format(new Date(c.completed_at), "MMM d, h:mm a")}</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
