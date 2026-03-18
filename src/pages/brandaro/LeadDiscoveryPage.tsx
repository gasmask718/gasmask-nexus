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

      // Score and insert qualified leads
      const qualified = (inserted || []).map(cl => {
        let score = 0;
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
        };
      });

      const { error: qualErr } = await supabase.from("brandaro_qualified_leads").insert(qualified);
      if (qualErr) throw qualErr;

      return { qualified: qualified.length, tier1: qualified.filter(q => q.priority_tier === "tier_1").length };
    },
    onSuccess: (stats) => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-qualified-stats"] });
      toast({ title: "Qualification Complete", description: `${stats.qualified} leads qualified. ${stats.tier1} are Tier 1 (call immediately).` });
    },
    onError: (err: any) => {
      toast({ title: "Qualification Failed", description: err.message, variant: "destructive" });
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
        <p className="text-muted-foreground">Import Google Maps leads, detect missing websites, auto-qualify</p>
      </div>

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
