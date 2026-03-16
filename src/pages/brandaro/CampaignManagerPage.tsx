import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, FolderOpen, Play, Pause, BarChart3 } from "lucide-react";

export default function CampaignManagerPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["brandaro-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Count matching leads
      let query = supabase.from("brandaro_qualified_leads").select("id", { count: "exact", head: true });
      if (industryFilter) query = query.ilike("industry", `%${industryFilter}%`);
      if (cityFilter) query = query.ilike("city", `%${cityFilter}%`);
      if (stateFilter) query = query.ilike("state", `%${stateFilter}%`);
      const { count } = await query;

      const { error } = await supabase.from("brandaro_campaigns").insert({
        name,
        description: description || null,
        industry_filter: industryFilter || null,
        city_filter: cityFilter || null,
        state_filter: stateFilter || null,
        total_leads: count || 0,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign created");
      setShowCreate(false);
      setName(""); setDescription(""); setIndustryFilter(""); setCityFilter(""); setStateFilter("");
      queryClient.invalidateQueries({ queryKey: ["brandaro-campaigns"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string }) => {
      const next = current === "active" ? "paused" : "active";
      const { error } = await supabase.from("brandaro_campaigns").update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brandaro-campaigns"] }),
  });

  const statusColor = (s: string) => {
    if (s === "active") return "default";
    if (s === "paused") return "secondary";
    if (s === "completed") return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Group leads into targeted calling campaigns</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No campaigns yet. Create your first campaign to organize leads.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Filters</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Contacted</TableHead>
                  <TableHead>Interested</TableHead>
                  <TableHead>Conv. Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {[c.industry_filter, c.city_filter, c.state_filter].filter(Boolean).join(", ") || "None"}
                    </TableCell>
                    <TableCell>{c.total_leads}</TableCell>
                    <TableCell>{c.contacted_leads}</TableCell>
                    <TableCell>{c.interested_leads}</TableCell>
                    <TableCell>{c.conversion_rate ? `${c.conversion_rate}%` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(c.status) as any}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus.mutate({ id: c.id, current: c.status })}
                      >
                        {c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Texas Plumbers" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Target segment details..." rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Industry</Label>
                <Input value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} placeholder="Plumber" />
              </div>
              <div>
                <Label>City</Label>
                <Input value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} placeholder="Houston" />
              </div>
              <div>
                <Label>State</Label>
                <Input value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} placeholder="TX" />
              </div>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} className="w-full">
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
