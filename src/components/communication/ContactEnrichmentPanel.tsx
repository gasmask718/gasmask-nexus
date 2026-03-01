import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Zap, CheckCircle2, XCircle, Loader2, Phone, Search, ShieldCheck } from "lucide-react";

interface EnrichmentCandidate {
  id: string;
  store_id: string;
  proposed_phone: string;
  normalized_phone: string;
  confidence: number;
  source: string;
  status: string;
  created_at: string;
  store_name?: string;
}

export function ContactEnrichmentPanel() {
  const queryClient = useQueryClient();
  const [scanned, setScanned] = useState(false);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["enrichment-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_enrichment_candidates")
        .select("*")
        .order("confidence", { ascending: false })
        .limit(200);
      if (error) throw error;

      // Fetch store names
      const storeIds = [...new Set((data || []).map((c: any) => c.store_id))];
      if (storeIds.length === 0) return [];

      const { data: stores } = await supabase
        .from("store_master")
        .select("id, store_name")
        .in("id", storeIds);

      const storeMap = new Map((stores || []).map((s: any) => [s.id, s.store_name]));
      return (data || []).map((c: any) => ({
        ...c,
        store_name: storeMap.get(c.store_id) || "Unknown",
      })) as EnrichmentCandidate[];
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("enrich_store_contacts");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setScanned(true);
      queryClient.invalidateQueries({ queryKey: ["enrichment-candidates"] });
      toast.success(`Scan complete: ${data?.candidates_created || 0} new candidates found from ${data?.stores_missing_phone || 0} stores missing phones`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase.rpc("approve_enrichment_candidate", { p_candidate_id: candidateId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrichment-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["audience-diagnostics"] });
      toast.success("Phone approved and applied to store");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase.rpc("reject_enrichment_candidate", { p_candidate_id: candidateId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrichment-candidates"] });
      toast.success("Candidate rejected");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("bulk_approve_enrichment");
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["enrichment-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["audience-diagnostics"] });
      queryClient.invalidateQueries({ queryKey: ["audience-segments"] });
      toast.success(`${count} phones approved and applied`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pending = candidates.filter((c) => c.status === "pending");
  const approved = candidates.filter((c) => c.status === "approved");
  const rejected = candidates.filter((c) => c.status === "rejected");

  const sourceLabel = (s: string) => {
    const map: Record<string, string> = {
      store_contacts: "Contacts",
      crm_customer: "CRM",
      invoice_receipt: "Invoice",
      marketplace_order: "Marketplace",
    };
    return map[s] || s;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Contact Enrichment Engine
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Recover missing phone numbers from historical data to expand your messageable audience
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
            >
              {scanMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Search className="h-3.5 w-3.5 mr-1" />
              )}
              Scan Sources
            </Button>
            {pending.length > 0 && (
              <Button
                size="sm"
                onClick={() => bulkApproveMutation.mutate()}
                disabled={bulkApproveMutation.isPending}
              >
                {bulkApproveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                )}
                Approve All ({pending.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-primary">{pending.length}</p>
            <p className="text-[10px] text-muted-foreground">Pending Review</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-green-600">{approved.length}</p>
            <p className="text-[10px] text-muted-foreground">Approved</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-destructive">{rejected.length}</p>
            <p className="text-[10px] text-muted-foreground">Rejected</p>
          </div>
        </div>

        {/* Candidates Table */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 && !scanned ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Click "Scan Sources" to discover phone numbers from historical data</p>
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>All candidates have been reviewed</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Phone Found</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.store_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.proposed_phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px]">{sourceLabel(c.source)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={c.confidence >= 0.9 ? "default" : "secondary"}
                        className="text-[9px]"
                      >
                        {Math.round(c.confidence * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700"
                          onClick={() => approveMutation.mutate(c.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => rejectMutation.mutate(c.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
