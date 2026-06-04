import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Clock, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// T4c RULING: REPOINT — reads store_escalations (the real system driven by escalation_rules).
// communication_escalations is DEPRECATED.

interface StoreEscalation {
  id: string;
  store_id: string;
  reason: string;
  priority: number;
  status: string;
  attempts_made: number;
  contacts_attempted: number;
  last_attempt_at: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  store?: { store_name: string | null } | null;
}

function severityFromPriority(p: number): "critical" | "high" | "medium" | "low" {
  if (p >= 8) return "critical";
  if (p >= 6) return "high";
  if (p >= 4) return "medium";
  return "low";
}

export default function EscalationsPanel(_props: { businessId?: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["store-escalations", filter],
    queryFn: async () => {
      let q = supabase
        .from("store_escalations")
        .select("*, store:store_master(store_name)")
        .in("status", ["pending", "assigned", "visited"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as StoreEscalation[];
    },
  });

  const resolveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_escalations")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escalation resolved");
      qc.invalidateQueries({ queryKey: ["store-escalations"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to resolve"),
  });

  const filtered = filter === "all"
    ? escalations
    : escalations.filter((e) => severityFromPriority(e.priority) === filter);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading escalations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-orange-500" size={20} />
          <h2 className="text-lg font-semibold">Active Escalations</h2>
          <Badge variant="secondary">{escalations.length}</Badge>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
            <p className="text-muted-foreground">No active escalations</p>
            <p className="text-xs text-muted-foreground mt-2">
              Source: store_escalations (driven by escalation_rules)
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((e) => {
            const sev = severityFromPriority(e.priority);
            return (
              <Card
                key={e.id}
                className={cn(
                  "border-l-4",
                  sev === "critical" && "border-l-red-500",
                  sev === "high" && "border-l-orange-500",
                  sev === "medium" && "border-l-yellow-500",
                  sev === "low" && "border-l-muted",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 size={16} className="text-muted-foreground" />
                      <CardTitle className="text-base">
                        {e.store?.store_name || "Unknown Store"}
                      </CardTitle>
                      <Badge variant="outline">{e.reason}</Badge>
                      <Badge variant="outline">priority {e.priority}</Badge>
                    </div>
                    <Badge
                      className={cn(
                        sev === "critical" && "bg-red-500",
                        sev === "high" && "bg-orange-500",
                        sev === "medium" && "bg-yellow-500",
                        sev === "low" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {sev}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>Created: {new Date(e.created_at).toLocaleDateString()}</span>
                      <span>Attempts: {e.attempts_made}</span>
                      <span>Contacts: {e.contacts_attempted}</span>
                      <Badge variant="secondary">{e.status}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMut.mutate(e.id)}
                      disabled={resolveMut.isPending}
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Resolve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
