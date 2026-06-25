import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Globe,
  Search,
  Map,
  Settings,
  AlertTriangle,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import { YelpBusinessSearch } from "@/components/territory/YelpBusinessSearch";
import { Progress } from "@/components/ui/progress";

type SourceType = "csv" | "google_places" | "yelp" | "openstreetmap";
type Step = "source" | "scope" | "upload" | "map" | "preview" | "ingesting" | "result";

interface ColumnMapping {
  full_address: string;
  city: string;
  state: string;
  zip: string;
  latitude: string;
  longitude: string;
  address_type: string;
  notes: string;
}

interface NeighborhoodResult {
  neighborhood_id: string;
  neighborhood: string;
  status: "success" | "partial" | "failed";
  inserted: number;
  skipped: number;
  total: number;
  error?: string;
}

interface DBNeighborhood {
  id: string;
  name: string;
  borough_id: string;
  city: string | null;
  state: string | null;
  bbox: any | null;
  ingestion_status: string | null;
  last_ingested_at: string | null;
  ingestion_stats: any | null;
  borough?: { name: string } | null;
}

const REQUIRED_FIELDS = ["full_address", "city", "state"] as const;
const OPTIONAL_FIELDS = ["zip", "latitude", "longitude", "address_type", "notes"] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;

const FIELD_LABELS: Record<string, string> = {
  full_address: "Full Address *",
  city: "City *",
  state: "State *",
  zip: "ZIP Code",
  latitude: "Latitude",
  longitude: "Longitude",
  address_type: "Address Type",
  notes: "Notes",
};

const BUSINESS_TYPES = [
  "smoke_shop",
  "convenience_store",
  "deli",
  "grocery",
  "hookah_lounge",
  "gas_station",
  "liquor_store",
  "tobacco_shop",
  "vape_shop",
];

const SOURCES: { key: SourceType; label: string; icon: any; description: string; requiresKey: boolean }[] = [
  {
    key: "google_places",
    label: "Google Places",
    icon: Search,
    description: "Search Google Maps for businesses by type and location",
    requiresKey: true,
  },
  {
    key: "yelp",
    label: "Yelp Fusion",
    icon: Globe,
    description: "Search Yelp business listings by category and area",
    requiresKey: true,
  },
  {
    key: "openstreetmap",
    label: "OpenStreetMap",
    icon: Map,
    description: "Free Overpass API — neighborhood-based bbox queries",
    requiresKey: false,
  },
  {
    key: "csv",
    label: "CSV Upload",
    icon: FileSpreadsheet,
    description: "Upload a CSV file with address data",
    requiresKey: false,
  },
];

const STATUS_COLORS: Record<string, string> = {
  complete: "text-emerald-500",
  partial: "text-amber-500",
  failed: "text-destructive",
  ingesting: "text-primary",
  pending: "text-muted-foreground",
};

export default function TerritoryIngestion() {
  const [source, setSource] = useState<SourceType | null>(null);
  const [step, setStep] = useState<Step>("source");

  // CSV state
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [fileName, setFileName] = useState("");

  // API scope state
  const [scopeCity, setScopeCity] = useState("");
  const [scopeState, setScopeState] = useState("");
  const [scopeCountry, setScopeCountry] = useState("US");
  const [scopeTypes, setScopeTypes] = useState<string[]>(["smoke_shop", "convenience_store"]);
  const [selectedNeighborhoodIds, setSelectedNeighborhoodIds] = useState<string[]>([]);
  const [neighborhoodInput, setNeighborhoodInput] = useState("");
  const [legacyNeighborhoods, setLegacyNeighborhoods] = useState<string[]>([]);
  const [apiProgress, setApiProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [apiResults, setApiResults] = useState<any>(null);
  const [boroughFilter, setBoroughFilter] = useState<string>("all");

  // New State: Yelp Selected Items (Accumulates across pages)
  const [yelpSelectedItems, setYelpSelectedItems] = useState<any[]>([]);

  // Fetch neighborhoods from DB
  const { data: dbNeighborhoods = [], isLoading: hoodsLoading } = useQuery({
    queryKey: ["ingestion-neighborhoods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("neighborhoods")
        .select(
          "id, name, borough_id, city, state, bbox, ingestion_status, last_ingested_at, ingestion_stats, borough:boroughs(name)",
        )
        .order("name");
      if (error) throw error;
      return (data || []) as DBNeighborhood[];
    },
  });

  // Fetch boroughs for filtering
  const { data: boroughs = [] } = useQuery({
    queryKey: ["ingestion-boroughs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boroughs").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredNeighborhoods = useMemo(() => {
    if (boroughFilter === "all") return dbNeighborhoods;
    return dbNeighborhoods.filter((n) => n.borough_id === boroughFilter);
  }, [dbNeighborhoods, boroughFilter]);

  const resetAll = () => {
    setSource(null);
    setStep("source");
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setFileName("");
    setScopeCity("");
    setScopeState("");
    setScopeTypes(["smoke_shop", "convenience_store"]);
    setSelectedNeighborhoodIds([]);
    setLegacyNeighborhoods([]);
    setNeighborhoodInput("");
    setApiProgress(0);
    setProgressLabel("");
    setApiResults(null);
    setYelpSelectedItems([]); // Clear yelp selections
  };

  const handleSourceSelect = (s: SourceType) => {
    setSource(s);
    setStep(s === "csv" ? "upload" : "scope");
  };

  const toggleNeighborhood = (id: string) => {
    setSelectedNeighborhoodIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllFiltered = () => {
    const allIds = filteredNeighborhoods.map((n) => n.id);
    const allSelected = allIds.every((id) => selectedNeighborhoodIds.includes(id));
    if (allSelected) {
      setSelectedNeighborhoodIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedNeighborhoodIds((prev) => [...new Set([...prev, ...allIds])]);
    }
  };

  const addLegacyNeighborhood = () => {
    const trimmed = neighborhoodInput.trim();
    if (trimmed && !legacyNeighborhoods.includes(trimmed)) {
      setLegacyNeighborhoods((prev) => [...prev, trimmed]);
    }
    setNeighborhoodInput("");
  };

  // CSV handling
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text
        .split("\n")
        .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")))
        .filter((line) => line.some((cell) => cell.length > 0));
      if (lines.length < 2) {
        toast({
          title: "Invalid File",
          description: "CSV must have a header row and at least one data row.",
          variant: "destructive",
        });
        return;
      }
      const fileHeaders = lines[0];
      setHeaders(fileHeaders);
      setRawData(lines.slice(1));
      const autoMap: Partial<ColumnMapping> = {};
      for (const field of ALL_FIELDS) {
        const matchIdx = fileHeaders.findIndex(
          (h) => h.toLowerCase().replace(/[_\s-]/g, "") === field.replace(/[_\s-]/g, ""),
        );
        if (matchIdx >= 0) autoMap[field] = fileHeaders[matchIdx];
      }
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  }, []);

  const isMappingValid = REQUIRED_FIELDS.every((f) => mapping[f]);

  const mappedRecords = rawData
    .map((row) => {
      const record: Record<string, string | null> = {};
      for (const field of ALL_FIELDS) {
        const headerName = mapping[field];
        if (headerName) {
          const idx = headers.indexOf(headerName);
          record[field] = idx >= 0 ? row[idx] || null : null;
        } else record[field] = null;
      }
      return record;
    })
    .filter((r) => r.full_address && r.city && r.state);

  const csvIngestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("ingest_territory_addresses", { p_addresses: mappedRecords as any });
      if (error) throw error;
      return data as { inserted: number; duplicates: number; total: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Ingestion Complete",
        description: `${data.inserted} inserted, ${data.duplicates} duplicates skipped.`,
      });
      setApiResults(data);
      setStep("result");
    },
    onError: (err: any) => toast({ title: "Ingestion Failed", description: err.message, variant: "destructive" }),
  });

  // API ingestion
  const apiIngestMutation = useMutation({
    mutationFn: async () => {
      setStep("ingesting");
      setApiProgress(5);

      // Yelp now routes through Google Places with Yelp-style search terms
      const functionName =
        source === "google_places" || source === "yelp"
          ? "ingest-google-places"
          : "ingest-openstreetmap";

      const totalTargets = selectedNeighborhoodIds.length || legacyNeighborhoods.length || 1;
      const isYelpManual = source === "yelp" && yelpSelectedItems.length > 0;

      setProgressLabel(
        isYelpManual
          ? `Ingesting ${yelpSelectedItems.length} selected Yelp business(es)...`
          : `Ingesting ${totalTargets} target(s) × ${scopeTypes.length} type(s)…`,
      );
      setApiProgress(15);

      const body: Record<string, any> = {
        city: scopeCity,
        state: scopeState,
        country: scopeCountry,
        business_types: source === "yelp"
          ? ['smoke shop', 'tobacco store', 'bodega', 'corner store', 'deli grocery', 'convenience store', 'hookah lounge', 'vape shop']
          : scopeTypes,
      };

      // Prefer DB neighborhood IDs, fall back to legacy free-text
      if (selectedNeighborhoodIds.length > 0) {
        body.neighborhood_ids = selectedNeighborhoodIds;
      } else if (legacyNeighborhoods.length > 0) {
        body.neighborhoods = legacyNeighborhoods;
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      setApiProgress(100);
      setProgressLabel("Complete");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setApiResults(data);
      setStep("result");
      if (data?.warning) {
        toast({ title: "Ingestion Warning", description: data.warning, variant: "destructive" });
      } else {
        const enrichedMsg = data?.enriched ? ` · ${data.enriched} enriched with phone` : '';
        toast({ title: "Ingestion Complete", description: `${data?.inserted ?? 0} new · ${data?.skipped ?? 0} skipped${enrichedMsg}` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Ingestion Failed", description: err.message, variant: "destructive" });
      setStep("scope");
    },
  });

  const stepLabels =
    source === "csv" ? ["source", "upload", "map", "preview", "result"] : ["source", "scope", "ingesting", "result"];

  const toggleType = (t: string) => {
    setScopeTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const failedNeighborhoods =
    (apiResults?.neighborhoods as NeighborhoodResult[] | undefined)?.filter(
      (n: NeighborhoodResult) => n.status === "failed",
    ) || [];

  const partialNeighborhoods =
    (apiResults?.neighborhoods as NeighborhoodResult[] | undefined)?.filter(
      (n: NeighborhoodResult) => n.status === "partial",
    ) || [];

  const retryPartial = () => {
    const partialIds = partialNeighborhoods.map((n) => n.neighborhood_id).filter(Boolean);
    if (partialIds.length > 0) {
      setSelectedNeighborhoodIds(partialIds);
      setLegacyNeighborhoods([]);
    } else {
      setLegacyNeighborhoods(partialNeighborhoods.map((n) => n.neighborhood));
      setSelectedNeighborhoodIds([]);
    }
    setStep("scope");
    setApiProgress(0);
    setProgressLabel("");
    setApiResults(null);
  };

  const retryFailed = () => {
    const failedIds = failedNeighborhoods.map((n) => n.neighborhood_id).filter(Boolean);
    if (failedIds.length > 0) {
      setSelectedNeighborhoodIds(failedIds);
      setLegacyNeighborhoods([]);
    } else {
      setLegacyNeighborhoods(failedNeighborhoods.map((n) => n.neighborhood));
      setSelectedNeighborhoodIds([]);
    }
    setStep("scope");
    setApiProgress(0);
    setProgressLabel("");
    setApiResults(null);
  };

  const selectedCount = selectedNeighborhoodIds.length + legacyNeighborhoods.length;
  const queryEstimate = (selectedCount || 1) * scopeTypes.length;

  // Last enrichment run = max(last_ingested_at) across all neighborhoods
  const lastEnrichmentRun = useMemo(() => {
    const stamps = dbNeighborhoods
      .map((n) => n.last_ingested_at)
      .filter(Boolean) as string[];
    if (stamps.length === 0) return null;
    return stamps.sort().reverse()[0];
  }, [dbNeighborhoods]);

  const activelyIngesting = apiIngestMutation.isPending || csvIngestMutation.isPending || step === "ingesting";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Territory Ingestion</h1>
          <p className="text-muted-foreground">Discover and import addresses into the territory intelligence layer.</p>
        </div>
      </div>

      {/* Enrichment status banner — Audit T10 */}
      <Card className="border-border/60">
        <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${activelyIngesting ? "bg-primary animate-pulse" : lastEnrichmentRun ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {activelyIngesting ? "Enrichment running…" : "Enrichment idle"}
              </p>
              <p className="text-xs text-muted-foreground">
                Last run:{" "}
                {lastEnrichmentRun
                  ? `${new Date(lastEnrichmentRun).toLocaleString()} (${dbNeighborhoods.filter((n) => n.last_ingested_at).length} of ${dbNeighborhoods.length} neighborhoods)`
                  : "no enrichment runs recorded yet"}
              </p>
            </div>
          </div>
          {activelyIngesting && (
            <div className="flex-1 min-w-[200px] max-w-sm">
              <Progress value={apiProgress || 10} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{progressLabel || "Processing…"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {stepLabels.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <Badge variant={step === s ? "default" : "outline"} className="capitalize">
              {s}
            </Badge>
          </div>
        ))}
      </div>


      {/* STEP: Source Selection */}
      {step === "source" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SOURCES.map((s) => (
            <Card
              key={s.key}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleSourceSelect(s.key)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{s.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                    {s.requiresKey && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        Requires API Key
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* STEP: Yelp Business Search */}
      {step === "scope" && source === "yelp" && (
        <div className="space-y-4">
          {/* IMPORTANT: You must update your YelpBusinessSearch component to accept these new props:
              1. selectedItems (Array)
              2. onSelectionChange (Function to update array)
              This ensures selection state lives here in the parent and persists across page changes in the child.
           */}
          <YelpBusinessSearch
            onBack={() => {
              setSource(null);
              setStep("source");
            }}
            selectedItems={yelpSelectedItems}
            onSelectionChange={setYelpSelectedItems}
            // Passing the parent ingestion mutation if you want to trigger it from the child
            onIngest={() => apiIngestMutation.mutate()}
            isIngesting={apiIngestMutation.isPending}
          />
          {/* Fallback Ingest Button if not present in Child */}
          {yelpSelectedItems.length > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="text-sm">
                  <span className="font-bold">{yelpSelectedItems.length}</span> businesses selected across all pages.
                </div>
                <Button onClick={() => apiIngestMutation.mutate()} disabled={apiIngestMutation.isPending}>
                  {apiIngestMutation.isPending ? "Ingesting..." : "Ingest All Selected"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* STEP: Scope (API sources — non-Yelp) */}
      {step === "scope" && source && source !== "csv" && source !== "yelp" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Define Search Scope — {SOURCES.find((s) => s.key === source)?.label}
            </CardTitle>
            <CardDescription>
              Select neighborhoods from your territory database for targeted, reliable ingestion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>City *</Label>
                <Input value={scopeCity} onChange={(e) => setScopeCity(e.target.value)} placeholder="e.g. New York" />
              </div>
              <div className="space-y-1">
                <Label>State *</Label>
                <Input value={scopeState} onChange={(e) => setScopeState(e.target.value)} placeholder="e.g. NY" />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={scopeCountry} onChange={(e) => setScopeCountry(e.target.value)} placeholder="US" />
              </div>
            </div>

            {/* DB Neighborhood selector — all API sources */}
            <div className="space-y-3">
              {selectedNeighborhoodIds.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary">Neighborhood-Scoped Search</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Select Neighborhoods
                  <Badge variant="outline" className="text-xs">
                    {dbNeighborhoods.length} in DB
                  </Badge>
                </Label>
                <div className="flex items-center gap-2">
                  {boroughs.length > 0 && (
                    <Select value={boroughFilter} onValueChange={setBoroughFilter}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Filter by borough" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Boroughs</SelectItem>
                        {boroughs.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" onClick={selectAllFiltered} className="text-xs h-8">
                    {filteredNeighborhoods.every((n) => selectedNeighborhoodIds.includes(n.id))
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
              </div>

              {hoodsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : filteredNeighborhoods.length > 0 ? (
                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Neighborhood</TableHead>
                        <TableHead>Borough</TableHead>
                        <TableHead className="text-center">BBox</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Last Run</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNeighborhoods.map((n) => (
                        <TableRow
                          key={n.id}
                          className={`cursor-pointer ${selectedNeighborhoodIds.includes(n.id) ? "bg-primary/5" : ""}`}
                          onClick={() => toggleNeighborhood(n.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedNeighborhoodIds.includes(n.id)}
                              onCheckedChange={() => toggleNeighborhood(n.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{n.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{n.borough?.name || "—"}</TableCell>
                          <TableCell className="text-center">
                            {n.bbox ? (
                              <Badge variant="outline" className="text-xs text-emerald-500">
                                Cached
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Auto-resolve
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`text-xs font-medium capitalize ${STATUS_COLORS[n.ingestion_status || "pending"] || "text-muted-foreground"}`}
                            >
                              {n.ingestion_status || "pending"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {n.last_ingested_at ? new Date(n.last_ingested_at).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No neighborhoods found. Add them in Territory settings first, or use manual entry below.
                </p>
              )}

              {selectedNeighborhoodIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedNeighborhoodIds.length} neighborhood(s) × {scopeTypes.length} type(s) = ~
                  {selectedNeighborhoodIds.length * scopeTypes.length} targeted bbox queries
                </p>
              )}

              {/* Legacy manual input fallback */}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                  Manual entry (for neighborhoods not in DB)
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={neighborhoodInput}
                      onChange={(e) => setNeighborhoodInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLegacyNeighborhood();
                        }
                      }}
                      placeholder="e.g. Williamsburg"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addLegacyNeighborhood}
                      disabled={!neighborhoodInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {legacyNeighborhoods.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {legacyNeighborhoods.map((hood) => (
                        <Badge key={hood} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                          {hood}
                          <button
                            onClick={() => setLegacyNeighborhoods((prev) => prev.filter((n) => n !== hood))}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </div>

            <div className="space-y-2">
              <Label>Business Types</Label>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map((t) => (
                  <Badge
                    key={t}
                    variant={scopeTypes.includes(t) ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleType(t)}
                  >
                    {t.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>

            {selectedCount === 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-400">
                  No neighborhoods selected — will attempt city-wide query. Selecting neighborhoods yields more precise,
                  reliable results.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSource(null);
                  setStep("source");
                }}
              >
                Back
              </Button>
              <Button
                onClick={() => apiIngestMutation.mutate()}
                disabled={!scopeCity || !scopeState || scopeTypes.length === 0}
              >
                {selectedCount > 0 ? `Ingest ${selectedCount} Neighborhood(s)` : "Start City-Wide Ingestion"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP: Ingesting (API progress) */}
      {step === "ingesting" && (
        <Card>
          <CardContent className="py-12">
            <div className="max-w-md mx-auto space-y-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="font-medium">Ingesting from {SOURCES.find((s) => s.key === source)?.label}…</p>
              <Progress value={apiProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
              <p className="text-xs text-muted-foreground">~{queryEstimate} queries • Retries + mirrors active</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV STEP: Upload */}
      {step === "upload" && source === "csv" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload CSV
            </CardTitle>
            <CardDescription>
              Upload a CSV file with address data. Required columns: full_address, city, state.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" asChild>
                  <span>Choose CSV File</span>
                </Button>
              </label>
              <p className="text-sm text-muted-foreground mt-3">
                Supports: smoke shops, delis, convenience stores, grocery, hookah lounges
              </p>
            </div>
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSource(null);
                  setStep("source");
                }}
              >
                Back to Sources
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV STEP: Map columns */}
      {step === "map" && source === "csv" && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns — {fileName}</CardTitle>
            <CardDescription>
              Map your CSV columns to territory address fields. {rawData.length} rows detected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_FIELDS.map((field) => (
                <div key={field} className="space-y-1">
                  <label className="text-sm font-medium text-foreground">{FIELD_LABELS[field]}</label>
                  <Select
                    value={mapping[field] || "__none__"}
                    onValueChange={(val) =>
                      setMapping((prev) => ({ ...prev, [field]: val === "__none__" ? undefined : val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!isMappingValid}>
                Preview ({mappedRecords.length} valid rows)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV STEP: Preview */}
      {step === "preview" && source === "csv" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <CardDescription>
              {mappedRecords.length} valid rows ready. All imported as discovery_status = 'unknown'.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>ZIP</TableHead>
                    <TableHead>Lat/Lng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRecords.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">{row.full_address}</TableCell>
                      <TableCell>{row.city}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell>{row.zip || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.latitude && row.longitude
                          ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {mappedRecords.length > 50 && (
              <p className="text-sm text-muted-foreground mt-2">Showing first 50 of {mappedRecords.length} rows.</p>
            )}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={() => csvIngestMutation.mutate()} disabled={csvIngestMutation.isPending}>
                {csvIngestMutation.isPending ? "Importing…" : `Import ${mappedRecords.length} Addresses`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP: Result */}
      {step === "result" && apiResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {apiResults.warning ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> Ingestion Warning
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Ingestion Complete
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{apiResults.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Found</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-emerald-500">{apiResults.inserted || 0}</p>
                <p className="text-sm text-muted-foreground">New Saved</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-500">{apiResults.enriched || 0}</p>
                <p className="text-sm text-muted-foreground">Phones Added</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{apiResults.duplicates || apiResults.skipped || 0}</p>
                <p className="text-sm text-muted-foreground">Already Complete</p>
              </div>
            </div>

            {/* Per-neighborhood breakdown */}
            {apiResults.neighborhoods && (apiResults.neighborhoods as NeighborhoodResult[]).length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Neighborhood Breakdown</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Neighborhood</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Found</TableHead>
                        <TableHead className="text-right">Inserted</TableHead>
                        <TableHead className="text-right">Skipped</TableHead>
                        <TableHead className="text-right">Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(apiResults.neighborhoods as NeighborhoodResult[]).map((n: NeighborhoodResult, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{n.neighborhood}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                n.status === "success"
                                  ? "default"
                                  : n.status === "partial"
                                    ? "secondary"
                                    : "destructive"
                              }
                              title={n.error || undefined}
                              className="cursor-help"
                            >
                              {n.status === "success" ? "✓ success" : n.status === "partial" ? "⚠ partial" : "✗ failed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{n.total}</TableCell>
                          <TableCell className="text-right text-emerald-500">{n.inserted}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{n.skipped}</TableCell>
                          <TableCell className="text-right">
                            {n.error && (
                              <span
                                className="text-xs text-destructive truncate max-w-[200px] inline-block"
                                title={n.error}
                              >
                                {n.error}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {apiResults.warning && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-400">{apiResults.warning}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can retry just the failed neighborhoods — already-imported data is safe.
                  </p>
                </div>
              </div>
            )}
            {!apiResults.warning && (
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  All imported addresses are set to <Badge variant="outline">unknown</Badge> status. Use Scout, Call,
                  and Visit consoles to classify them.
                </p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={resetAll}>Import More Data</Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    toast({ title: "Enriching...", description: "Fetching missing phone numbers from Google..." });
                    const { data, error } = await supabase.functions.invoke('ingestion-enrich-phones', { body: {} });
                    if (error) throw error;
                    toast({
                      title: "Enrich Complete",
                      description: data.message || `${data.enriched} phones added`,
                    });
                  } catch (e: any) {
                    toast({ title: "Enrich Failed", description: e.message, variant: "destructive" });
                  }
                }}
              >
                📞 Enrich Missing Phones
              </Button>
              {failedNeighborhoods.length > 0 && (
                <Button variant="destructive" onClick={retryFailed}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry {failedNeighborhoods.length} Failed
                </Button>
              )}
              {partialNeighborhoods.length > 0 && (
                <Button
                  variant="outline"
                  className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                  onClick={retryPartial}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry {partialNeighborhoods.length} Partial
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
