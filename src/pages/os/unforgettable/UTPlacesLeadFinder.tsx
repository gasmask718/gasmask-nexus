import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Search, MapPin, Phone, Globe, Star, Download, Loader2,
  CheckCircle, AlertTriangle, X, ChevronRight, Zap, ExternalLink, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// ── Category presets ─────────────────────────────────────────────
const CATEGORY_PRESETS = [
  { label: "Event Hall", query: "event hall venue banquet" },
  { label: "Party Rental", query: "party rental equipment" },
  { label: "Decorator", query: "event decorator party decorator" },
  { label: "Caterer", query: "caterer catering service" },
  { label: "Bartender", query: "bartender bar service" },
  { label: "Photographer", query: "photographer event photography" },
  { label: "Videographer", query: "videographer event video" },
  { label: "Florist", query: "florist flower arrangement" },
  { label: "Event Planner", query: "event planner coordinator" },
  { label: "Entertainment", query: "entertainment dj musician" },
  { label: "Security", query: "security guard event security" },
  { label: "Cleaners", query: "cleaning service post event" },
  { label: "Staffing", query: "staffing agency event staff" },
] as const;

// ── Google type → UT category mapping ────────────────────────────
function normalizeGoogleType(types: string[], name: string): { category: string; confidence: number } {
  const all = [...types.map(t => t.toLowerCase()), name.toLowerCase()];
  const check = (kws: string[]) => kws.some(k => all.some(a => a.includes(k)));

  if (check(["banquet", "wedding_venue", "event_venue", "convention"])) return { category: "event_hall", confidence: 0.9 };
  if (check(["tent_rental", "party_equipment", "equipment_rental"])) return { category: "rental_company", confidence: 0.85 };
  if (check(["caterer", "catering"])) return { category: "caterer", confidence: 0.9 };
  if (check(["florist", "flower"])) return { category: "florist", confidence: 0.9 };
  if (check(["photographer", "photography"])) return { category: "photographer", confidence: 0.85 };
  if (check(["videograph"])) return { category: "photographer", confidence: 0.8 };
  if (check(["dj", "disc_jockey", "entertainer", "musician", "music"])) return { category: "entertainer", confidence: 0.8 };
  if (check(["event_planner", "coordinator", "wedding_planner"])) return { category: "event_planner", confidence: 0.85 };
  if (check(["security", "guard"])) return { category: "security", confidence: 0.85 };
  if (check(["clean", "janitor"])) return { category: "cleaner", confidence: 0.8 };
  if (check(["bartend", "bar_service"])) return { category: "bartender", confidence: 0.85 };
  if (check(["staffing", "temp_agency"])) return { category: "staff", confidence: 0.75 };
  if (check(["decorator", "decor"])) return { category: "decorator", confidence: 0.85 };
  if (check(["rental"])) return { category: "rental_company", confidence: 0.7 };
  if (check(["hall", "venue", "ballroom"])) return { category: "event_hall", confidence: 0.7 };
  return { category: "other", confidence: 0.5 };
}

interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  types: string[];
  rating: number | null;
  rating_count?: number | null;
  business_status: string | null;
  maps_url: string | null;
  phone: string | null;
  website: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ut_category: string;
  category_confidence: number;
  duplicate_status: "new" | "probable_duplicate" | "exact_duplicate";
}


export default function UTPlacesLeadFinder() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Search state
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("NJ");
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailTarget, setDetailTarget] = useState<PlaceResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; failed: number; phonesEnriched: number } | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Dedup is handled by the database (ut_upsert_partner_lead + partial unique index
  // on external_place_id). No client-side pre-check: re-imports come back as skips.
  const getDupStatus = useCallback((): "new" | "probable_duplicate" | "exact_duplicate" => "new", []);

  // Exactly 2 uppercase chars or '' — '' must never reach the RPC (CHECK constraint).
  const normState = (raw: string | null | undefined) => {
    const s = (raw || "").toUpperCase().slice(0, 2);
    return s.length === 2 ? s : "";
  };


  // ── SEARCH: uses search_all for auto-pagination (up to 60 results) ──
  const handleSearch = useCallback(async (overrideQuery?: string) => {
    const q = overrideQuery || keyword;
    if (!q.trim()) { toast.error("Enter a search query"); return; }
    const fullQuery = `${q} in ${city || ""}${city && state ? ", " : ""}${state || ""}`.trim();
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    setDetailTarget(null);
    setImportResult(null);
    setSearchProgress("Searching Google Places (up to 60 results)...");

    try {

      const { data, error } = await supabase.functions.invoke("ut-places-search", {
        body: { action: "search_all", query: fullQuery, max_pages: 3 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const enriched: PlaceResult[] = (Array.isArray(data.places) ? data.places : []).map((p: any) => {
        const { category, confidence } = normalizeGoogleType(p.types || [], p.name || "");
        return {
          ...p,
          ut_category: category,
          category_confidence: confidence,
          duplicate_status: getDupStatus(),
        };
      });
      setResults(enriched);
      setRecentSearches(prev => [fullQuery, ...prev.filter(s => s !== fullQuery)].slice(0, 8));
      const pagesMsg = data.pages_fetched ? ` (${data.pages_fetched} page${data.pages_fetched > 1 ? 's' : ''})` : '';
      toast.success(`Found ${enriched.length} results${pagesMsg}`);

      // Auto-enrich phones for results missing them
      const needEnrich = enriched.filter(r => !r.phone && r.duplicate_status !== "exact_duplicate");
      if (needEnrich.length > 0) {
        setSearchProgress(`Auto-enriching ${needEnrich.length} leads with phone numbers...`);
        setEnriching(true);
        setEnrichProgress(0);
        const BATCH = 20;
        let enrichedCount = 0;
        for (let i = 0; i < needEnrich.length; i += BATCH) {
          const batch = needEnrich.slice(i, i + BATCH);
          try {
            const { data: eData } = await supabase.functions.invoke("ut-places-search", {
              body: { action: "enrich_batch", place_ids: batch.map(r => r.place_id) },
            });
            if (eData?.enriched) {
              const enrichedMap = new Map<string, any>();
              for (const e of eData.enriched) enrichedMap.set(e.place_id, e);
              setResults(prev => prev.map(r => {
                const e = enrichedMap.get(r.place_id);
                if (!e) return r;
                return { ...r, phone: e.phone || r.phone, website: e.website || r.website, rating: e.rating || r.rating };
              }));
              enrichedCount += eData.enriched_count || 0;
            }
          } catch { /* continue */ }
          setEnrichProgress(Math.round(((i + batch.length) / needEnrich.length) * 100));
        }
        setEnriching(false);
        setEnrichProgress(0);
        if (enrichedCount > 0) toast.success(`Auto-enriched ${enrichedCount} leads with phone data`);
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearching(false);
      setSearchProgress("");
    }
  }, [keyword, city, state, getDupStatus]);

  // ── ENRICH: batch-fetch phone numbers for results missing them ──
  const handleEnrichPhones = useCallback(async () => {
    const needEnrich = results.filter(r => !r.phone && r.duplicate_status !== "exact_duplicate");
    if (!needEnrich.length) { toast.info("All results already have phone numbers"); return; }

    setEnriching(true);
    setEnrichProgress(0);
    let enrichedCount = 0;
    const BATCH = 20;

    for (let i = 0; i < needEnrich.length; i += BATCH) {
      const batch = needEnrich.slice(i, i + BATCH);
      const ids = batch.map(r => r.place_id);

      try {
        const { data, error } = await supabase.functions.invoke("ut-places-search", {
          body: { action: "enrich_batch", place_ids: ids },
        });
        if (error) throw error;

        const enrichedMap = new Map<string, any>();
        for (const e of (Array.isArray(data?.enriched) ? data.enriched : [])) {
          enrichedMap.set(e.place_id, e);
        }

        setResults(prev => prev.map(r => {
          const e = enrichedMap.get(r.place_id);
          if (!e) return r;
          return {
            ...r,
            phone: e.phone || r.phone,
            website: e.website || r.website,
            rating: e.rating || r.rating,
          };
        }));
        enrichedCount += data?.enriched_count || 0;
      } catch {
        // continue with next batch
      }
      setEnrichProgress(Math.round(((i + batch.length) / needEnrich.length) * 100));
    }

    setEnriching(false);
    setEnrichProgress(0);
    toast.success(`Enriched ${enrichedCount} leads with phone/website data`);
  }, [results]);

  // ── IMPORT: per-place ut_upsert_partner_lead RPC (DB is the deduper) ──
  const handleImport = useCallback(async () => {
    const toImport = results.filter(r => selected.has(r.place_id));
    if (!toImport.length) { toast.error("No leads selected for import"); return; }
    setImporting(true);
    let imported = 0, skipped = 0, failed = 0;
    const phonesEnriched = toImport.filter(r => r.phone).length;

    const upsertOne = async (p: PlaceResult) => {
      const st = normState(p.state);
      if (!p.place_id || st.length !== 2) {
        // '' must never reach the RPC — the CHECK constraint requires 2 uppercase chars.
        skipped++;
        console.warn(`Skipped ${p.name}: ${!p.place_id ? "missing place_id" : "unresolvable state"}`);
        return;
      }
      const record: Record<string, unknown> = {
        business: "ut",
        external_place_id: p.place_id,
        business_name: p.name,
        category: p.ut_category,
        phone: p.phone || null,
        website: p.website || null,
        full_address: p.address || null,
        city: p.city || null,
        state: st,
        google_rating: p.rating,
        review_count: p.rating_count ?? null,
        google_types: p.types || [],
        maps_url: p.maps_url || null,
        source: "google_places",
        external_source: "google_places",
        status: p.phone ? "new" : "needs_enrichment",
      };
      if (typeof p.latitude === "number") record.latitude = p.latitude;
      if (typeof p.longitude === "number") record.longitude = p.longitude;

      try {
        const { data, error } = await (supabase.rpc as any)("ut_upsert_partner_lead", { p: record });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.was_insert) imported++; else skipped++;
      } catch (e: any) {
        failed++;
        console.error(`Upsert failed for ${p.place_id}:`, e?.message || e);
      }
    };

    const CHUNK = 10;
    for (let i = 0; i < toImport.length; i += CHUNK) {
      await Promise.all(toImport.slice(i, i + CHUNK).map(upsertOne));
    }

    setImportResult({ imported, skipped, failed, phonesEnriched });
    setImporting(false);
    if (imported > 0 || skipped > 0) {
      qc.invalidateQueries({ queryKey: ["ut-partner-leads"] });
      qc.invalidateQueries({ queryKey: ["ut-lead-stats"] });
      qc.invalidateQueries({ queryKey: ["ut-territory-heatmap"] });
      toast.success(`Imported ${imported} leads${skipped ? ` · ${skipped} skipped` : ""}`);
      const importedIds = new Set(toImport.map(r => r.place_id));
      setResults(prev => prev.map(r => (
        importedIds.has(r.place_id) ? { ...r, duplicate_status: "exact_duplicate" as const } : r
      )));
    }
  }, [results, selected, qc]);


  const toggleSelect = (pid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const selectAllNew = () => {
    setSelected(new Set(results.filter(r => r.duplicate_status === "new").map(r => r.place_id)));
  };

  // ── Detail panel handler ──
  const handleDetail = useCallback((place: PlaceResult) => {
    setDetailTarget(place);
    setDetailLoading(true);
    setDetailData(null);
    supabase.functions.invoke("ut-places-search", {
      body: { action: "details", place_id: place.place_id },
    }).then(({ data, error }) => {
      if (!error && data) {
        setDetailData(data);
        if (data.phone && !place.phone) {
          setResults(prev => prev.map(r => r.place_id === place.place_id ? { ...r, phone: data.phone, website: data.website || r.website } : r));
        }
      } else {
        toast.error("Failed to load details");
      }
    }).finally(() => setDetailLoading(false));
  }, []);

  const newCount = results.filter(r => r.duplicate_status === "new").length;
  const dupCount = results.filter(r => r.duplicate_status !== "new").length;
  const noPhoneCount = results.filter(r => !r.phone && r.duplicate_status !== "exact_duplicate").length;

  const DUP_BADGE: Record<string, string> = {
    new: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    probable_duplicate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    exact_duplicate: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/os/unforgettable/intelligence")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Google Places Lead Finder
            </h1>
            <p className="text-xs text-muted-foreground">Discover, enrich & import event vendors — up to 60 per search</p>
          </div>
        </div>
        {results.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{results.length} found</Badge>
            <Badge variant="outline" className="text-emerald-400">{newCount} new</Badge>
            {dupCount > 0 && <Badge variant="outline" className="text-yellow-400">{dupCount} dups</Badge>}
            {noPhoneCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleEnrichPhones} disabled={enriching} className="gap-1.5 text-xs">
                {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Enrich {noPhoneCount} phones
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={selectAllNew}>Select All New</Button>
            <Button size="sm" onClick={handleImport} disabled={importing || selected.size === 0} className="gap-1.5">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Import {selected.size}
            </Button>
          </div>
        )}
      </div>

      {/* Enrich progress bar */}
      {enriching && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-400">Enriching phone numbers via Place Details API...</span>
            <span className="text-muted-foreground">{enrichProgress}%</span>
          </div>
          <Progress value={enrichProgress} className="h-1.5" />
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-border/30 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="e.g. event hall, party rental..." value={keyword} onChange={e => setKeyword(e.target.value)} className="flex-1"
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <Input placeholder="City" value={city} onChange={e => setCity(e.target.value)} className="w-36"
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <Input placeholder="State" value={state} onChange={e => setState(e.target.value)} className="w-20"
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <Button onClick={() => handleSearch()} disabled={searching} className="gap-1.5">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_PRESETS.map(p => (
            <button key={p.label} onClick={() => { setKeyword(p.query); handleSearch(p.query); }}
              className="px-2.5 py-1 text-xs rounded-full border border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-colors">
              {p.label}
            </button>
          ))}
        </div>
        {recentSearches.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Recent:</span>
            {recentSearches.slice(0, 4).map(s => (
              <button key={s} onClick={() => { setKeyword(s); handleSearch(s); }}
                className="hover:text-foreground underline underline-offset-2">{s.length > 30 ? s.slice(0, 30) + "…" : s}</button>
            ))}
          </div>
        )}
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span><strong>{importResult.imported}</strong> imported</span>
              <span className="text-emerald-400">{importResult.phonesEnriched} with phone</span>
              <span className="text-yellow-400">{importResult.imported - importResult.phonesEnriched} needs enrichment</span>
              {importResult.skipped > 0 && <span className="text-muted-foreground">{importResult.skipped} skipped</span>}
              {importResult.failed > 0 && <span className="text-red-400">{importResult.failed} failed</span>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setImportResult(null)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      {/* Search progress */}
      {searching && searchProgress && (
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/20 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {searchProgress}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {results.length === 0 && !searching ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <MapPin className="h-10 w-10 opacity-30" />
              <p className="text-sm">Search Google Places to discover event vendors</p>
              <p className="text-xs">Auto-paginates up to 60 results per search</p>
              <p className="text-xs">Use "Enrich phones" to fetch missing contact info</p>
            </div>
          ) : searching && !results.length ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{searchProgress || "Searching..."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-center">📞</TableHead>
                  <TableHead className="text-center">🌐</TableHead>
                  <TableHead className="text-center">⭐</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.place_id} className={`cursor-pointer ${detailTarget?.place_id === r.place_id ? "bg-primary/5" : ""}`}
                    onClick={() => handleDetail(r)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.place_id)} onCheckedChange={() => toggleSelect(r.place_id)}
                        disabled={r.duplicate_status === "exact_duplicate"} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.address}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{r.ut_category.replace(/_/g, " ")}</Badge>
                      {r.category_confidence < 0.7 && <span className="text-[10px] text-yellow-400 ml-1">?</span>}
                    </TableCell>
                    <TableCell className="text-sm">{r.city || "—"}</TableCell>
                    <TableCell className="text-center">
                      {r.phone ? <Phone className="h-3.5 w-3.5 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.website ? <Globe className="h-3.5 w-3.5 text-blue-400 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm">{r.rating ? `${r.rating}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={DUP_BADGE[r.duplicate_status] || ""}>
                        {r.duplicate_status === "new" ? "New" : r.duplicate_status === "probable_duplicate" ? "Maybe Dup" : "Duplicate"}
                      </Badge>
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Detail panel */}
        {detailTarget && (
          <div className="w-80 border-l border-border/50 bg-muted/20 overflow-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Place Details</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDetailTarget(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {detailLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">{detailData?.name || detailTarget.name}</div>
                    <div className="text-xs text-muted-foreground">{detailData?.address || detailTarget.address}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Category</div>
                      <Badge variant="outline" className="capitalize">{detailTarget.ut_category.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Confidence</div>
                      <span>{Math.round(detailTarget.category_confidence * 100)}%</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Rating</div>
                      <span className="flex items-center gap-1">
                        {detailData?.rating || detailTarget.rating || "—"}
                        {detailData?.rating_count && <span className="text-muted-foreground">({detailData.rating_count})</span>}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Status</div>
                      <Badge variant="outline" className={DUP_BADGE[detailTarget.duplicate_status]}>
                        {detailTarget.duplicate_status === "new" ? "New" : "Duplicate"}
                      </Badge>
                    </div>
                  </div>

                  {(detailData?.phone || detailTarget.phone) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      {detailData?.phone || detailTarget.phone}
                    </div>
                  )}
                  {!(detailData?.phone || detailTarget.phone) && (
                    <div className="flex items-center gap-2 text-xs text-yellow-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      No phone — use "Enrich phones" to fetch
                    </div>
                  )}
                  {(detailData?.website || detailTarget.website) && (
                    <a href={detailData?.website || detailTarget.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-400 hover:underline">
                      <Globe className="h-3.5 w-3.5" />
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {detailTarget.maps_url && (
                    <a href={detailTarget.maps_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      View on Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Google Types</div>
                    <div className="flex flex-wrap gap-1">
                      {(detailData?.types || detailTarget.types || []).slice(0, 6).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                  </div>

                  {detailTarget.duplicate_status !== "exact_duplicate" && (
                    <Button className="w-full gap-1.5" size="sm"
                      onClick={() => { toggleSelect(detailTarget.place_id); if (!selected.has(detailTarget.place_id)) toast.info("Added to import selection"); }}>
                      <Zap className="h-3.5 w-3.5" />
                      {selected.has(detailTarget.place_id) ? "Remove from Import" : "Add to Import"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
