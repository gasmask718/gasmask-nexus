import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { Users, Plus, Pencil, Trash2, RefreshCw, Eye, Loader2, Sparkles, Filter, Activity, Database } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ContactEnrichmentPanel } from "@/components/communication/ContactEnrichmentPanel";

interface AudienceSegment {
  id: string;
  name: string;
  description: string | null;
  filter_config: any;
  is_default: boolean;
  is_dynamic: boolean;
  cached_count: number | null;
  cached_at: string | null;
  engagement_rate: number | null;
  created_at: string;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

const FIELD_OPTIONS = [
  { value: "borough", label: "Borough" },
  { value: "payment_status", label: "Order Payment Status" },
  { value: "assigned_ambassador", label: "Assigned Ambassador" },
  { value: "last_contacted_days", label: "Days Since Last Contact" },
  { value: "total_orders_min", label: "Min Total Orders" },
  { value: "tags", label: "Store Tags" },
  { value: "pickup_probability", label: "Pickup Probability" },
];

const OPERATOR_OPTIONS = [
  { value: "equals", label: "Equals" },
  { value: "in", label: "In (comma-separated)" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
  { value: "contains", label: "Contains" },
];

export default function AudienceBuilderTab() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<AudienceSegment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AudienceSegment | null>(null);
  const [previewSegmentId, setPreviewSegmentId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFilters, setFormFilters] = useState<FilterCondition[]>([{ field: "", operator: "equals", value: "" }]);

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ["audience-segments", currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audience_segments")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AudienceSegment[];
    },
  });

  // Preview members query using unified identity resolver
  const { data: previewMembers, isFetching: countLoading } = useQuery({
    queryKey: ["audience-preview", previewSegmentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_audience_segment" as any, { p_segment_id: previewSegmentId! });
      if (error) throw error;
      return data || [];
    },
    enabled: !!previewSegmentId,
  });

  // Audience diagnostics
  const { data: diagnostics, refetch: refetchDiagnostics } = useQuery({
    queryKey: ["audience-diagnostics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audience_diagnostics" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string; filter_config: any; id?: string }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("audience_segments")
          .update({ name: payload.name, description: payload.description, filter_config: payload.filter_config, updated_at: new Date().toISOString() })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("audience_segments")
          .insert({ name: payload.name, description: payload.description, filter_config: payload.filter_config, business_id: currentBusiness?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience-segments"] });
      toast.success(editingSegment ? "Audience updated" : "Audience created");
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const refreshMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      // Use invoice-aware RPC to get real count
      const { data: count, error: rpcError } = await supabase.rpc("resolve_audience_count" as any, { p_segment_id: segmentId });
      if (rpcError) throw rpcError;
      const { error } = await supabase
        .from("audience_segments")
        .update({ cached_count: Number(count) || 0, cached_at: new Date().toISOString() })
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience-segments"] });
      toast.success("Audience count refreshed");
    },
  });

  const openCreate = () => {
    setEditingSegment(null);
    setFormName("");
    setFormDescription("");
    setFormFilters([{ field: "", operator: "equals", value: "" }]);
    setModalOpen(true);
  };

  const openEdit = (seg: AudienceSegment) => {
    setEditingSegment(seg);
    setFormName(seg.name);
    setFormDescription(seg.description || "");
    const conditions = seg.filter_config?.conditions || [];
    setFormFilters(conditions.length ? conditions : [{ field: "", operator: "equals", value: "" }]);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSegment(null);
  };

  const addFilter = () => setFormFilters([...formFilters, { field: "", operator: "equals", value: "" }]);
  const removeFilter = (i: number) => setFormFilters(formFilters.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, key: keyof FilterCondition, val: string) => {
    const updated = [...formFilters];
    updated[i] = { ...updated[i], [key]: val };
    setFormFilters(updated);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("Name is required"); return; }
    const validFilters = formFilters.filter(f => f.field && f.value);
    saveMutation.mutate({
      name: formName,
      description: formDescription,
      filter_config: { source: "store_master", conditions: validFilters, fields: ["store_id", "store_name", "phone", "last_order_date", "total_orders"] },
      id: editingSegment?.id,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("audience_segments").delete().eq("id", deleteTarget.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["audience-segments"] });
    toast.success("Audience deleted");
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Audience Builder
          </h3>
          <p className="text-sm text-muted-foreground">
            Create reusable audience segments for campaigns, auto-text, and dialer
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Audience
        </Button>
      </div>

      {/* Segments Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : segments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No audience segments yet</p>
              <Button variant="outline" className="mt-3" onClick={openCreate}>Create your first audience</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                  <TableHead>Last Refreshed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((seg) => (
                  <TableRow key={seg.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{seg.name}</span>
                        {seg.is_default && <Badge variant="secondary" className="ml-2 text-[10px]">Default</Badge>}
                        {seg.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{seg.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={seg.is_dynamic ? "default" : "outline"} className="text-[10px]">
                        {seg.is_dynamic ? "Dynamic" : "Static"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {seg.cached_count != null ? seg.cached_count.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {seg.engagement_rate != null ? `${seg.engagement_rate}%` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {seg.cached_at ? format(new Date(seg.cached_at), "MMM d, yyyy, h:mm a") : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refreshMutation.mutate(seg.id)} disabled={refreshMutation.isPending}>
                          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPreviewSegmentId(seg.id); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(seg)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!seg.is_default && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(seg)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Audience Diagnostics Panel */}
      {diagnostics && (
        <Card className="border-accent/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent-foreground" />
              Audience Diagnostics
            </CardTitle>
            <CardDescription className="text-xs">Identity resolution across all invoice sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{Number(diagnostics.total_invoices || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Invoices Scanned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{Number(diagnostics.distinct_store_ids || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Stores with Invoices</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary-foreground">{Number(diagnostics.distinct_phones || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Distinct Phones</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent-foreground">{Number(diagnostics.resolved_customers || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Resolved Customers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{Number(diagnostics.invoices_no_identity || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">No Identity</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">${Number(diagnostics.total_revenue || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total Revenue</p>
              </div>
            </div>
            {diagnostics.source_summary && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(diagnostics.source_summary as any[]).map((s: any) => (
                  <Badge key={s.source} variant="outline" className="text-xs">
                    {s.source}: {s.count} (${Number(s.revenue || 0).toLocaleString()})
                  </Badge>
                ))}
              </div>
            )}
            {Number(diagnostics.invoices_no_identity || 0) > 0 && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Database className="h-3 w-3" />
                {Number(diagnostics.invoices_no_identity || 0).toLocaleString()} invoices have no store_id, phone, or name
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact Enrichment Engine */}
      <ContactEnrichmentPanel />

      {/* Preview Card */}
      {previewSegmentId && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Audience Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {countLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-3xl font-bold">{(Array.isArray(previewMembers) ? previewMembers.length : 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total recipients matched</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPreviewSegmentId(null)}>Close</Button>
                </div>
                {Array.isArray(previewMembers) && previewMembers.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Store</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Lifetime Spend</TableHead>
                        <TableHead>Last Order</TableHead>
                        <TableHead>Sources</TableHead>
                        <TableHead>Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(previewMembers as any[]).slice(0, 20).map((m: any) => (
                        <TableRow key={m.store_id}>
                          <TableCell className="font-medium">{m.store_name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{m.phone}</TableCell>
                          <TableCell className="text-right font-mono">{m.total_orders}</TableCell>
                          <TableCell className="text-right font-mono">${Number(m.lifetime_spend || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.last_order_date ? format(new Date(m.last_order_date), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {(m.sources_used || []).map((s: string) => (
                                <Badge key={s} variant="outline" className="text-[9px] px-1 py-0">{s}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.match_method === 'id' ? 'default' : 'secondary'} className="text-[9px]">
                              {m.match_method}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {Array.isArray(previewMembers) && previewMembers.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center">Showing 20 of {previewMembers.length} recipients</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSegment ? "Edit Audience" : "New Audience Segment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. High-Value Stores" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What does this audience represent?" rows={2} />
            </div>

            {/* Filter Builder */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Filter className="h-3.5 w-3.5" /> Filters
              </Label>
              <div className="space-y-2">
                {formFilters.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={f.field} onValueChange={(v) => updateFilter(i, "field", v)}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Field" /></SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={f.operator} onValueChange={(v) => updateFilter(i, "operator", v)}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={f.value} onChange={(e) => updateFilter(i, "value", e.target.value)} placeholder="Value" className="flex-1" />
                    {formFilters.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFilter(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addFilter} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Filter
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSegment ? "Update" : "Create"} Audience
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Audience"
        itemName={deleteTarget?.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
