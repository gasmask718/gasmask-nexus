import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Search, Globe, AlertTriangle, CheckCircle2, Rocket, Loader2, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Column mapping for Outscraper CSV
const COLUMN_MAP: Record<string, string> = {
  "name": "business_name",
  "business_name": "business_name",
  "full_address": "address",
  "address": "address",
  "city": "city",
  "state": "state",
  "zip": "zip_code",
  "zip_code": "zip_code",
  "postal_code": "zip_code",
  "phone": "phone_number",
  "phone_number": "phone_number",
  "category": "industry",
  "type": "industry",
  "industry": "industry",
  "rating": "rating",
  "reviews": "review_count",
  "review_count": "review_count",
  "reviews_count": "review_count",
  "website": "website_url",
  "site": "website_url",
  "email": "email",
  "google_maps_url": "google_maps_url",
  "link": "google_maps_url",
};

function normalizeColumn(col: string): string {
  const clean = col.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return COLUMN_MAP[clean] || clean;
}

function detectWebsiteStatus(url?: string): string {
  if (!url || url.trim() === "" || url === "N/A" || url === "n/a") return "no_website";
  return "has_website";
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.replace(/"/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

export default function LeadDiscoveryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importStats, setImportStats] = useState<{ total: number; noWebsite: number; duplicates: number } | null>(null);
  
  // Live generation state
  const [genQuery, setGenQuery] = useState("");
  const [genLocation, setGenLocation] = useState("");
  const [genLimit, setGenLimit] = useState("50");

  const { data: rawLeads, isLoading } = useQuery({
    queryKey: ["brandaro-raw-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_raw_leads")
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      const batchId = `import_${Date.now()}`;
      let noWebsite = 0;
      let duplicates = 0;

      const normalized = rows.map(row => {
        const mapped: Record<string, any> = {};
        Object.entries(row).forEach(([key, val]) => {
          const norm = normalizeColumn(key);
          mapped[norm] = val;
        });

        const ws = detectWebsiteStatus(mapped.website_url);
        if (ws === "no_website") noWebsite++;

        return {
          business_name: mapped.business_name || "Unknown",
          phone_number: mapped.phone_number || null,
          address: mapped.address || null,
          city: mapped.city || null,
          state: mapped.state || null,
          zip_code: mapped.zip_code || null,
          industry: mapped.industry || null,
          rating: mapped.rating ? parseFloat(mapped.rating) : null,
          review_count: mapped.review_count ? parseInt(mapped.review_count) : 0,
          website_url: mapped.website_url || null,
          website_status: ws,
          email: mapped.email || null,
          google_maps_url: mapped.google_maps_url || null,
          source: "csv_import",
          import_batch_id: batchId,
          imported_by: user?.id,
          raw_data: mapped,
        };
      });

      // Deduplicate within batch by phone
      const seen = new Set<string>();
      const unique = normalized.filter(r => {
        if (!r.phone_number) return true;
        if (seen.has(r.phone_number)) { duplicates++; return false; }
        seen.add(r.phone_number);
        return true;
      });

      const { error } = await supabase.from("brandaro_raw_leads").insert(unique);
      if (error) throw error;

      return { total: unique.length, noWebsite, duplicates };
    },
    onSuccess: (stats) => {
      setImportStats(stats);
      queryClient.invalidateQueries({ queryKey: ["brandaro-raw-leads"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-raw-count"] });
      toast({ title: "Import Complete", description: `${stats.total} leads imported. ${stats.noWebsite} have no website.` });
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast({ title: "Error", description: "No data rows found in CSV", variant: "destructive" });
        return;
      }
      importMutation.mutate(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [importMutation, toast]);

  // Auto-qualify: push no-website leads to clean + qualified tables
  const qualifyMutation = useMutation({
    mutationFn: async () => {
      const { data: raw } = await supabase
        .from("brandaro_raw_leads")
        .select("*")
        .eq("website_status", "no_website");
      
      if (!raw || raw.length === 0) throw new Error("No unqualified leads with missing websites");

      // Insert into clean leads
      const cleanLeads = raw.map(r => ({
        raw_lead_id: r.id,
        business_name: r.business_name,
        phone_number: r.phone_number,
        phone_valid: !!r.phone_number && r.phone_number.length >= 10,
        address: r.address,
        city: r.city,
        state: r.state,
        zip_code: r.zip_code,
        industry: r.industry,
        rating: r.rating,
        review_count: r.review_count,
        website_status: "no_website",
        email: r.email,
        google_maps_url: r.google_maps_url,
      }));

      const { data: inserted, error: cleanErr } = await supabase
        .from("brandaro_clean_leads")
        .insert(cleanLeads)
        .select();
      if (cleanErr) throw cleanErr;

      // Score and insert qualified leads — no-website leads get a massive boost
      const qualified = (inserted || []).map(cl => {
        let score = 0;
        const isNoWebsite = cl.website_status === "no_website";
        if (isNoWebsite) score += 25; // 🔥 No website = high value target
        if (cl.phone_valid) score += 30;
        if (cl.rating && Number(cl.rating) >= 4.0) score += 20;
        if (cl.review_count && cl.review_count >= 10) score += 15;
        if (cl.review_count && cl.review_count >= 50) score += 10;
        if (cl.industry) score += 10;
        if (cl.city) score += 5;

        const tier = score >= 60 ? "tier_1" : score >= 35 ? "tier_2" : "tier_3";

        return {
          clean_lead_id: cl.id,
          business_name: cl.business_name,
          phone_number: cl.phone_number,
          city: cl.city,
          state: cl.state,
          industry: cl.industry,
          rating: cl.rating,
          review_count: cl.review_count,
          priority_score: score,
          priority_tier: tier,
          lead_status: "new" as const,
          website_status: cl.website_status || "unknown",
        };
      });

      const { data: qualifiedInserted, error: qualErr } = await supabase
        .from("brandaro_qualified_leads")
        .insert(qualified)
        .select("id, priority_score, priority_tier, website_status, phone_number");
      if (qualErr) throw qualErr;

      // Auto-insert no-website leads with phone numbers into call queue
      const noWebsiteForQueue = (qualifiedInserted || []).filter(
        q => (q as any).website_status === "no_website" && q.phone_number
      );
      if (noWebsiteForQueue.length > 0) {
        const queueRows = noWebsiteForQueue.map((q, idx) => ({
          lead_id: q.id,
          priority_tier: q.priority_tier === "tier_1" ? 1 : q.priority_tier === "tier_2" ? 2 : 3,
          priority_score: q.priority_score || 70,
          queue_position: idx + 1,
          retry_count: 0,
        }));
        await supabase.from("brandaro_call_queue").insert(queueRows);
      }

      return {
        qualified: qualified.length,
        tier1: qualified.filter(q => q.priority_tier === "tier_1").length,
        autoQueued: noWebsiteForQueue.length,
      };
    },
    onSuccess: (stats) => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-qualified-stats"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-call-queue"] });
      toast({ title: "Qualification Complete", description: `${stats.qualified} leads qualified. ${stats.tier1} Tier 1. ${stats.autoQueued} no-website leads auto-queued for calling.` });
    },
    onError: (err: any) => {
      toast({ title: "Qualification Failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Job tracking ──
  const { data: recentJobs, refetch: refetchJobs } = useQuery({
    queryKey: ["brandaro-lead-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_lead_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 10000, // Poll every 10s to catch webhook completions
  });

  const pendingJobs = recentJobs?.filter(j => j.status === "pending") || [];
  const delayedJobs = pendingJobs.filter(j => {
    const created = new Date(j.created_at).getTime();
    return Date.now() - created > 2 * 60 * 1000; // > 2 minutes
  });

  // ── Live Outscraper Generation (async mode) ──
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!genQuery || !genLocation) throw new Error("Business type and location are required");
      const { data, error } = await supabase.functions.invoke('brandaro-live-discovery', {
        body: { query: genQuery, location: genLocation, limit: parseInt(genLimit) || 50 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Generation failed');
      return data;
    },
    onSuccess: (data) => {
      refetchJobs();
      toast({
        title: "🚀 Job Submitted",
        description: `Outscraper is processing your request. Results will arrive automatically via webhook.${data.request_id ? ` Job ID: ${data.request_id}` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    },
  });

  const noWebsiteCount = rawLeads?.filter(l => l.website_status === "no_website").length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6 text-cyan-500" />
          Lead Discovery Engine
        </h1>
        <p className="text-muted-foreground">Generate leads from Google Maps, import CSVs, detect missing websites, auto-qualify</p>
      </div>

      {/* ── LIVE GENERATION ── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-5 w-5 text-primary" /> Generate Leads from Google Maps
          </CardTitle>
          <CardDescription>Live search via Outscraper API — find businesses without websites</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Business Type</label>
              <Input
                placeholder="e.g. restaurants, plumber, salon..."
                value={genQuery}
                onChange={e => setGenQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Location</label>
              <Input
                placeholder="e.g. Brooklyn, NY"
                value={genLocation}
                onChange={e => setGenLocation(e.target.value)}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-foreground mb-1 block">Limit</label>
              <Select value={genLimit} onValueChange={setGenLimit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !genQuery || !genLocation}
              className="min-w-[160px]"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><MapPin className="h-4 w-4 mr-2" /> Generate Leads</>
              )}
            </Button>
          </div>
          {generateMutation.data && (
            <div className="mt-3 p-2 rounded bg-muted text-sm">
              ✅ Job submitted in async mode. Results will auto-import via webhook.
            </div>
          )}
          {pendingJobs.length > 0 && (
            <div className="mt-3 space-y-2">
              {pendingJobs.map(job => {
                const isDelayed = delayedJobs.some(d => d.id === job.id);
                return (
                  <div key={job.id} className={`flex items-center gap-2 text-sm p-2 rounded border ${isDelayed ? 'border-amber-500/40 bg-amber-500/10' : 'border-primary/20 bg-primary/5'}`}>
                    {isDelayed ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    <span className="font-medium">{job.search_query}</span>
                    <span className="text-muted-foreground">in {job.location}</span>
                    <Badge variant={isDelayed ? "destructive" : "outline"}>
                      {isDelayed ? "Delayed" : "Pending"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
          {recentJobs && recentJobs.filter(j => j.status === "completed").length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Recent Completed Jobs</p>
              {recentJobs.filter(j => j.status === "completed").slice(0, 3).map(job => (
                <div key={job.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{job.search_query} · {job.location}</span>
                  <Badge>+{job.inserted_count}</Badge>
                  <Badge variant="secondary">Dupes: {job.duplicate_count}</Badge>
                  <Badge variant="destructive">No Site: {job.no_website_count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5" /> CSV Import
            </CardTitle>
            <CardDescription>Upload Outscraper or Google Maps CSV exports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Click to upload CSV</span>
              <Input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
                disabled={importMutation.isPending}
              />
            </label>
            {importMutation.isPending && (
              <p className="text-sm text-muted-foreground animate-pulse">Importing leads...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5" /> Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {importStats ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Imported</span>
                  <Badge>{importStats.total}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-500 font-medium">No Website (Target)</span>
                  <Badge variant="destructive">{importStats.noWebsite}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Duplicates Skipped</span>
                  <Badge variant="secondary">{importStats.duplicates}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Upload a CSV to see import results</p>
            )}

            <Button 
              className="w-full mt-4" 
              onClick={() => qualifyMutation.mutate()}
              disabled={qualifyMutation.isPending || noWebsiteCount === 0}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Auto-Qualify {noWebsiteCount} No-Website Leads
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Imports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Imports</CardTitle>
          <CardDescription>{rawLeads?.length || 0} leads (last 100)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Website</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : rawLeads?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No leads imported yet</TableCell></TableRow>
                ) : rawLeads?.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.business_name}</TableCell>
                    <TableCell className="text-sm">{lead.phone_number || "—"}</TableCell>
                    <TableCell className="text-sm">{lead.city || "—"}</TableCell>
                    <TableCell className="text-sm">{lead.industry || "—"}</TableCell>
                    <TableCell className="text-sm">{lead.rating || "—"} ⭐ ({lead.review_count})</TableCell>
                    <TableCell>
                      {lead.website_status === "no_website" ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> No Site
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Has Site</Badge>
                      )}
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
