import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, CheckCircle2, XCircle, Clock, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RADIUS_OPTIONS = [
  { label: "5 miles", value: "8047" },
  { label: "10 miles", value: "16093" },
  { label: "25 miles", value: "40234" },
  { label: "50 miles", value: "80467" },
];

const PRESETS = [
  { emoji: "🧹", label: "Cleaning Services", industry: "cleaning service" },
  { emoji: "📦", label: "Moving Companies", industry: "moving company" },
  { emoji: "🔧", label: "Plumbers", industry: "plumber" },
  { emoji: "⚡", label: "Electricians", industry: "electrician" },
  { emoji: "🌿", label: "Landscaping", industry: "landscaping" },
  { emoji: "🚗", label: "Auto Repair", industry: "auto repair" },
  { emoji: "🎨", label: "Painters", industry: "painting contractor" },
  { emoji: "🏗️", label: "Contractors", industry: "general contractor" },
];

function statusBadge(status: string) {
  switch (status) {
    case "queued": return <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
    case "running": return <Badge className="text-[10px] bg-amber-500 animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case "completed": return <Badge className="text-[10px] bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
    case "failed": return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

export default function LeadDiscoveryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radius, setRadius] = useState("40234");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Fetch search history
  const { data: jobs } = useQuery({
    queryKey: ["brandaro-discovery-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_discovery_jobs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    refetchInterval: activeJobId ? 3000 : 30000,
  });

  // Check if active job completed
  const activeJob = jobs?.find((j: any) => j.id === activeJobId);
  useEffect(() => {
    if (activeJob && (activeJob.status === "completed" || activeJob.status === "failed")) {
      if (activeJob.status === "completed") {
        toast({
          title: "✅ Discovery Complete",
          description: `Found ${activeJob.total_found} businesses. ${activeJob.no_website_count} without websites. ${activeJob.imported_count} new leads imported.`,
        });
      } else {
        toast({ title: "Discovery Failed", description: activeJob.error_message || "Unknown error", variant: "destructive" });
      }
      setActiveJobId(null);
    }
  }, [activeJob?.status]);

  // Launch search mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      if (!industry || !city) throw new Error("Industry and City are required");

      // Create job record
      const { data: job, error: jobErr } = await supabase
        .from("brandaro_discovery_jobs" as any)
        .insert({
          search_query: `${industry} in ${city}`,
          city,
          state: state || null,
          industry,
          radius_meters: parseInt(radius),
          status: "queued",
        } as any)
        .select()
        .single();

      if (jobErr) throw jobErr;
      const jobId = (job as any).id;
      setActiveJobId(jobId);

      // Call edge function (fire and forget — it updates the job row)
      const { error: fnErr } = await supabase.functions.invoke("brandaro-lead-discovery", {
        body: { job_id: jobId, city, state, industry, radius_meters: parseInt(radius) },
      });

      if (fnErr) throw fnErr;
      return jobId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-discovery-jobs"] });
      toast({ title: "🚀 Search Launched", description: `Scanning Google Places for ${industry} in ${city}...` });
    },
    onError: (err: any) => {
      setActiveJobId(null);
      toast({ title: "Search Failed", description: err.message, variant: "destructive" });
    },
  });

  const isRunning = !!activeJobId || searchMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          Lead Discovery
        </h1>
        <p className="text-sm text-muted-foreground">Find businesses without websites using Google Places + AI scoring</p>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Launch New Search
          </CardTitle>
          <CardDescription>Search Google Places by industry and location. Only businesses without websites are imported.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Industry / Business Type</label>
              <Input
                placeholder="e.g. plumber, auto repair..."
                value={industry}
                onChange={e => setIndustry(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">City</label>
              <Input placeholder="e.g. Austin" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">State</label>
              <Input placeholder="e.g. TX" value={state} onChange={e => setState(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Radius</label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => searchMutation.mutate()}
            disabled={isRunning || !industry || !city}
            className="w-full md:w-auto"
          >
            {isRunning ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...</>
            ) : (
              <>Find Leads →</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Presets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quick Search Presets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button
                key={p.industry}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setIndustry(p.industry);
                  // Focus city input
                  setTimeout(() => {
                    const cityInput = document.querySelector('input[placeholder="e.g. Austin"]') as HTMLInputElement;
                    cityInput?.focus();
                  }, 100);
                }}
              >
                {p.emoji} {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Progress */}
      {activeJob && activeJob.status === "running" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <div>
                <p className="text-sm font-medium">Searching Google Places...</p>
                <p className="text-xs text-muted-foreground">Scanning {activeJob.industry} businesses in {activeJob.city}...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary (when just completed) */}
      {activeJob && activeJob.status === "completed" && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <div><p className="text-lg font-bold">{activeJob.total_found}</p><p className="text-[10px] text-muted-foreground">Total Found</p></div>
                <div><p className="text-lg font-bold text-amber-500">{activeJob.no_website_count}</p><p className="text-[10px] text-muted-foreground">No Website</p></div>
                <div><p className="text-lg font-bold text-green-500">{activeJob.imported_count}</p><p className="text-[10px] text-muted-foreground">Imported</p></div>
                <div><p className="text-lg font-bold text-muted-foreground">{activeJob.skipped_duplicates}</p><p className="text-[10px] text-muted-foreground">Duplicates Skipped</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search History</CardTitle>
        </CardHeader>
        <CardContent>
          {(!jobs || jobs.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No searches yet. Launch your first discovery above.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Industry</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Found</TableHead>
                  <TableHead className="text-right">No Website</TableHead>
                  <TableHead className="text-right">Imported</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium text-xs">{job.industry}</TableCell>
                    <TableCell className="text-xs">{job.city}{job.state ? `, ${job.state}` : ''}</TableCell>
                    <TableCell>{statusBadge(job.status)}</TableCell>
                    <TableCell className="text-right text-xs">{job.total_found}</TableCell>
                    <TableCell className="text-right text-xs">{job.no_website_count}</TableCell>
                    <TableCell className="text-right text-xs font-medium text-green-600">{job.imported_count}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{job.skipped_duplicates}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
