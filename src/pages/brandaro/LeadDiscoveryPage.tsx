import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Loader2, CheckCircle2, XCircle, Clock, MapPin,
  Play, Pause, Trash2, RotateCcw, Zap, Globe
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── City lists per state ──
const STATE_CITIES: Record<string, string[]> = {
  NY: ["Brooklyn","Bronx","Queens","Staten Island","Manhattan","Yonkers","Buffalo","Rochester","Syracuse","Albany","New Rochelle","Mount Vernon","Schenectady","Utica","White Plains","Hempstead","Troy","Niagara Falls","Binghamton","Freeport"],
  NJ: ["Newark","Jersey City","Paterson","Elizabeth","Edison","Woodbridge","Lakewood","Toms River","Hamilton","Trenton","Clifton","Camden","Brick","Cherry Hill","Passaic","Middletown","Union City","Old Bridge","Gloucester","East Orange"],
  FL: ["Miami","Orlando","Tampa","Jacksonville","Fort Lauderdale","Hialeah","Tallahassee","Cape Coral","St Petersburg","Port St Lucie","Pembroke Pines","Hollywood","Miramar","Gainesville","Coral Springs","Miami Gardens","West Palm Beach","Clearwater","Brandon","Spring Hill"],
  TX: ["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Laredo","Lubbock","Garland","Irving","Amarillo","Grand Prairie","McKinney","Frisco","Brownsville","Pasadena","Mesquite"],
  GA: ["Atlanta","Augusta","Columbus","Macon","Savannah","Athens","Sandy Springs","Roswell","Albany","Johns Creek","Warner Robins","Alpharetta","Marietta","Smyrna","Valdosta","Brookhaven","Dunwoody","Newnan","South Fulton","Gainesville"],
  CA: ["Los Angeles","San Diego","San Jose","San Francisco","Fresno","Sacramento","Long Beach","Oakland","Bakersfield","Anaheim","Santa Ana","Riverside","Stockton","Irvine","Chula Vista","Fremont","San Bernardino","Modesto","Moreno Valley","Fontana"],
  PA: ["Philadelphia","Pittsburgh","Allentown","Reading","Erie","Bethlehem","Lancaster","Harrisburg","Scranton","York","Wilkes-Barre","Chester","Easton","Lebanon","Hazleton","New Castle","Johnstown","McKeesport","Pottstown","Washington"],
  IL: ["Chicago","Aurora","Naperville","Joliet","Rockford","Springfield","Elgin","Peoria","Champaign","Waukegan","Cicero","Bloomington","Arlington Heights","Evanston","Decatur","Schaumburg","Bolingbrook","Palatine","Skokie","Des Plaines"],
  OH: ["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton","Parma","Canton","Youngstown","Lorain","Hamilton","Springfield","Kettering","Elyria","Lakewood","Cuyahoga Falls","Euclid","Middletown","Mansfield","Newark"],
  MD: ["Baltimore","Columbia","Germantown","Silver Spring","Waldorf","Glen Burnie","Ellicott City","Frederick","Dundalk","Rockville","Bethesda","Bowie","Towson","Aspen Hill","Wheaton","Severn","North Bethesda","Catonsville","Hagerstown","Annapolis"],
  CT: ["Bridgeport","New Haven","Hartford","Stamford","Waterbury","Norwalk","Danbury","New Britain","Bristol","Meriden","Milford","West Haven","Middletown","Norwich","Shelton","Torrington","New London","Ansonia","Derby","Groton"],
  MA: ["Boston","Worcester","Springfield","Lowell","Cambridge","New Bedford","Brockton","Quincy","Lynn","Fall River","Newton","Lawrence","Somerville","Framingham","Haverhill","Waltham","Malden","Medford","Taunton","Chicopee"],
};

const INDUSTRY_PRESETS = [
  { emoji: "🧹", label: "Cleaning Service", value: "cleaning service" },
  { emoji: "📦", label: "Moving Company", value: "moving company" },
  { emoji: "🎨", label: "Painting Contractor", value: "painting contractor" },
  { emoji: "🌿", label: "Landscaping", value: "landscaping" },
  { emoji: "🔧", label: "Handyman", value: "handyman" },
  { emoji: "🚗", label: "Auto Detailing", value: "auto detailing" },
  { emoji: "🧽", label: "Carpet Cleaning", value: "carpet cleaning" },
  { emoji: "🗑️", label: "Junk Removal", value: "junk removal" },
  { emoji: "💦", label: "Pressure Washing", value: "pressure washing" },
  { emoji: "🔧", label: "Plumber", value: "plumber" },
  { emoji: "⚡", label: "Electrician", value: "electrician" },
  { emoji: "❄️", label: "HVAC", value: "HVAC" },
];

const RADIUS_OPTIONS = [
  { label: "10 miles", value: "16093" },
  { label: "25 miles", value: "40234" },
  { label: "50 miles", value: "80467" },
];

function statusBadge(status: string, count?: number) {
  switch (status) {
    case "queued": return <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" />Waiting</Badge>;
    case "running": return <Badge className="text-[10px] bg-amber-500 animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case "completed": return <Badge className="text-[10px] bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Done{count ? ` (${count})` : ''}</Badge>;
    case "failed": return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case "skipped": return <Badge variant="outline" className="text-[10px]">Duplicate skipped</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

export default function LeadDiscoveryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Single search state
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radius, setRadius] = useState("40234");

  // Bulk generator state
  const [bulkIndustry, setBulkIndustry] = useState("");
  const [bulkState, setBulkState] = useState("");
  const [bulkRadius, setBulkRadius] = useState("40234");
  const [previewCities, setPreviewCities] = useState<string[] | null>(null);

  // Queue runner state
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [currentRunItem, setCurrentRunItem] = useState<string | null>(null);
  const pauseRef = useRef(false);

  // ── Queries ──

  const { data: queue, refetch: refetchQueue } = useQuery({
    queryKey: ["brandaro-search-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_search_queue" as any)
        .select("*")
        .order("status", { ascending: true })
        .order("queued_at", { ascending: true })
        .limit(500);
      return (data || []) as any[];
    },
    refetchInterval: isQueueRunning ? 3000 : 15000,
  });

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
    refetchInterval: isQueueRunning ? 3000 : 30000,
  });

  // ── Derived stats ──
  const queuedCount = queue?.filter((q: any) => q.status === "queued").length || 0;
  const completedCount = queue?.filter((q: any) => q.status === "completed").length || 0;
  const totalCount = queue?.length || 0;
  const totalImported = queue?.reduce((sum: number, q: any) => sum + (q.total_imported || 0), 0) || 0;
  const runningItem = queue?.find((q: any) => q.status === "running");

  // ── Generate city queue ──
  const generateQueue = useCallback(async () => {
    if (!bulkIndustry || !bulkState) return;
    const cities = STATE_CITIES[bulkState];
    if (!cities) {
      toast({ title: "State not supported", description: "Select a valid state.", variant: "destructive" });
      return;
    }

    // Check for existing entries
    const { data: existing } = await supabase
      .from("brandaro_search_queue" as any)
      .select("city")
      .eq("industry", bulkIndustry.toLowerCase())
      .eq("state", bulkState)
      .in("status", ["queued", "running", "completed"]);

    const existingCities = new Set((existing || []).map((e: any) => e.city));
    const newCities = cities.filter(c => !existingCities.has(c));

    if (newCities.length === 0) {
      toast({ title: "All cities already queued", description: `All ${cities.length} cities for ${bulkIndustry} in ${bulkState} have been searched or are queued.` });
      return;
    }

    setPreviewCities(newCities);
  }, [bulkIndustry, bulkState, toast]);

  const confirmQueue = useCallback(async () => {
    if (!previewCities || !bulkIndustry || !bulkState) return;

    const rows = previewCities.map(c => ({
      industry: bulkIndustry.toLowerCase(),
      city: c,
      state: bulkState,
      radius_meters: parseInt(bulkRadius),
      status: "queued",
    }));

    const { error } = await supabase.from("brandaro_search_queue" as any).insert(rows as any);
    if (error) {
      toast({ title: "Queue error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "🚀 Queue loaded", description: `${previewCities.length} cities queued for ${bulkIndustry} in ${bulkState}` });
    setPreviewCities(null);
    refetchQueue();
  }, [previewCities, bulkIndustry, bulkState, bulkRadius, toast, refetchQueue]);

  // ── Add single item to queue ──
  const addToQueue = useCallback(async () => {
    if (!industry || !city) return;

    const { error } = await supabase.from("brandaro_search_queue" as any).insert({
      industry: industry.toLowerCase(),
      city,
      state: state || "?",
      radius_meters: parseInt(radius),
      status: "queued",
    } as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already queued", description: `${industry} in ${city} is already in the queue.` });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      return;
    }

    toast({ title: "Added to queue", description: `${industry} in ${city}, ${state}` });
    refetchQueue();
  }, [industry, city, state, radius, toast, refetchQueue]);

  // ── Queue processor ──
  const runQueue = useCallback(async () => {
    setIsQueueRunning(true);
    pauseRef.current = false;

    // Get queued items
    const { data: items } = await supabase
      .from("brandaro_search_queue" as any)
      .select("*")
      .eq("status", "queued")
      .order("queued_at", { ascending: true })
      .limit(10);

    if (!items || items.length === 0) {
      toast({ title: "Queue empty", description: "No queued searches to run." });
      setIsQueueRunning(false);
      return;
    }

    let totalBatchImported = 0;
    let completed = 0;

    for (const item of items as any[]) {
      if (pauseRef.current) {
        toast({ title: "⏸ Queue paused", description: `Completed ${completed} of ${items.length} searches. ${totalBatchImported} leads imported.` });
        break;
      }

      const queueId = item.id;
      setCurrentRunItem(queueId);

      // Mark running
      await supabase.from("brandaro_search_queue" as any).update({ status: "running", started_at: new Date().toISOString() } as any).eq("id", queueId);
      refetchQueue();

      try {
        // Create discovery job
        const { data: job, error: jobErr } = await supabase
          .from("brandaro_discovery_jobs" as any)
          .insert({
            search_query: `${item.industry} in ${item.city}`,
            city: item.city,
            state: item.state,
            industry: item.industry,
            radius_meters: item.radius_meters,
            status: "queued",
          } as any)
          .select()
          .single();

        if (jobErr) throw jobErr;
        const jobId = (job as any).id;

        // Fire edge function
        const { error: fnErr } = await supabase.functions.invoke("brandaro-lead-discovery", {
          body: { job_id: jobId, city: item.city, state: item.state, industry: item.industry, radius_meters: item.radius_meters },
        });

        if (fnErr) throw fnErr;

        // Poll for completion
        let done = false;
        let attempts = 0;
        while (!done && attempts < 60) {
          await new Promise(r => setTimeout(r, 3000));
          const { data: jobData } = await supabase
            .from("brandaro_discovery_jobs" as any)
            .select("*")
            .eq("id", jobId)
            .single();

          const jd = jobData as any;
          if (jd?.status === "completed" || jd?.status === "failed") {
            done = true;
            const imported = jd?.imported_count || 0;
            totalBatchImported += imported;

            await supabase.from("brandaro_search_queue" as any).update({
              status: jd.status === "completed" ? "completed" : "failed",
              job_id: jobId,
              total_imported: imported,
              completed_at: new Date().toISOString(),
              error_message: jd.error_message || null,
            } as any).eq("id", queueId);
          }
          attempts++;
        }

        if (!done) {
          await supabase.from("brandaro_search_queue" as any).update({
            status: "failed", error_message: "Timed out after 3 minutes", completed_at: new Date().toISOString()
          } as any).eq("id", queueId);
        }
      } catch (err: any) {
        await supabase.from("brandaro_search_queue" as any).update({
          status: "failed", error_message: err.message, completed_at: new Date().toISOString()
        } as any).eq("id", queueId);
      }

      completed++;
      refetchQueue();
      queryClient.invalidateQueries({ queryKey: ["brandaro-discovery-jobs"] });
    }

    setIsQueueRunning(false);
    setCurrentRunItem(null);
    refetchQueue();

    const remaining = queuedCount - completed;
    toast({
      title: "✅ Batch complete",
      description: `${completed} searches done — ${totalBatchImported} leads imported.${remaining > 0 ? ` ${remaining} still queued.` : ''}`,
    });
  }, [queuedCount, toast, refetchQueue, queryClient]);

  const pauseQueue = () => { pauseRef.current = true; };

  const clearCompleted = useCallback(async () => {
    await supabase.from("brandaro_search_queue" as any).delete().in("status", ["completed", "failed", "skipped"]);
    refetchQueue();
    toast({ title: "Cleared", description: "Removed completed/failed items." });
  }, [refetchQueue, toast]);

  const retryItem = useCallback(async (id: string) => {
    await supabase.from("brandaro_search_queue" as any).update({ status: "queued", error_message: null, started_at: null, completed_at: null } as any).eq("id", id);
    refetchQueue();
  }, [refetchQueue]);

  // ── Coverage data ──
  const [coverageIndustry, setCoverageIndustry] = useState("");
  const coverageItems = queue?.filter((q: any) =>
    coverageIndustry && q.industry === coverageIndustry.toLowerCase()
  ) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          Lead Discovery
        </h1>
        <p className="text-sm text-muted-foreground">Find businesses without websites using Google Places + AI scoring</p>
      </div>

      <Tabs defaultValue="bulk" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bulk" className="gap-1"><Globe className="h-3.5 w-3.5" /> Bulk Search Queue</TabsTrigger>
          <TabsTrigger value="spanish" className="gap-1">🇪🇸 Spanish Leads</TabsTrigger>
          <TabsTrigger value="single" className="gap-1"><MapPin className="h-3.5 w-3.5" /> Single Search</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><Clock className="h-3.5 w-3.5" /> History</TabsTrigger>
        </TabsList>

        {/* ────── BULK SEARCH TAB ────── */}
        <TabsContent value="bulk" className="space-y-4">
          {/* State Coverage Generator */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> State Coverage Generator
              </CardTitle>
              <CardDescription>Queue an entire state's major cities in one click.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Industry presets */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Industry</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {INDUSTRY_PRESETS.map(p => (
                    <Button
                      key={p.value}
                      variant={bulkIndustry === p.value ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setBulkIndustry(p.value)}
                    >
                      {p.emoji} {p.label}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Or type a custom industry..."
                  value={bulkIndustry}
                  onChange={e => setBulkIndustry(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">State</label>
                  <Select value={bulkState} onValueChange={setBulkState}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATE_CITIES).map(s => (
                        <SelectItem key={s} value={s}>{s} ({STATE_CITIES[s].length} cities)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Radius</label>
                  <Select value={bulkRadius} onValueChange={setBulkRadius}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RADIUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={generateQueue} disabled={!bulkIndustry || !bulkState} className="w-full">
                    Generate City Queue →
                  </Button>
                </div>
              </div>

              {/* Preview */}
              {previewCities && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-4 space-y-3">
                    <p className="text-sm font-medium">
                      This will search <span className="font-bold text-primary">{bulkIndustry}</span> in{" "}
                      <span className="font-bold">{previewCities.length} cities</span> across{" "}
                      <span className="font-bold">{bulkState}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Estimated leads: ~{previewCities.length * 5}–{previewCities.length * 15} leads
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {previewCities.map(c => (
                        <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={confirmQueue} size="sm">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm & Add to Queue
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPreviewCities(null)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Queue Manager */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Queue Manager</CardTitle>
                <div className="flex gap-2">
                  {!isQueueRunning ? (
                    <Button size="sm" onClick={runQueue} disabled={queuedCount === 0}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Run Queue ({queuedCount})
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={pauseQueue}>
                      <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={clearCompleted}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Done
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Progress */}
              {totalCount > 0 && (
                <div className="space-y-1.5">
                  <Progress value={totalCount > 0 ? (completedCount / totalCount) * 100 : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {completedCount} of {totalCount} searches complete — <span className="font-medium text-green-600">{totalImported} leads imported</span>
                  </p>
                </div>
              )}

              {/* Running indicator */}
              {runningItem && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span className="text-xs">Running: <span className="font-medium">{runningItem.industry}</span> in <span className="font-medium">{runningItem.city}, {runningItem.state}</span></span>
                </div>
              )}

              {/* Queue table */}
              {(!queue || queue.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Queue is empty. Generate a state coverage above or add individual searches.</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Industry</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Imported</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queue.map((q: any) => (
                        <TableRow key={q.id} className={q.id === currentRunItem ? "bg-amber-500/5" : ""}>
                          <TableCell className="text-xs font-medium">{q.industry}</TableCell>
                          <TableCell className="text-xs">{q.city}</TableCell>
                          <TableCell className="text-xs">{q.state}</TableCell>
                          <TableCell>{statusBadge(q.status, q.total_imported)}</TableCell>
                          <TableCell className="text-right text-xs font-medium text-green-600">{q.total_imported || 0}</TableCell>
                          <TableCell>
                            {q.status === "failed" && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => retryItem(q.id)}>
                                <RotateCcw className="h-3 w-3 mr-1" /> Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coverage Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Coverage Summary</CardTitle>
              <CardDescription>See which cities have been searched for a given industry.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Type industry to filter (e.g. cleaning service)"
                value={coverageIndustry}
                onChange={e => setCoverageIndustry(e.target.value)}
                className="max-w-sm"
              />
              {coverageIndustry && coverageItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
                  {coverageItems.map((q: any) => (
                    <div key={q.id} className="flex items-center gap-1.5 text-xs py-0.5">
                      {q.status === "completed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : q.status === "queued" ? (
                        <div className="h-3.5 w-3.5 border border-muted-foreground/30 rounded shrink-0" />
                      ) : q.status === "running" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className={q.status === "completed" ? "text-foreground" : "text-muted-foreground"}>
                        {q.city}, {q.state}
                        {q.status === "completed" && ` (${q.total_imported} leads)`}
                        {q.completed_at && ` — ${new Date(q.completed_at).toLocaleDateString()}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : coverageIndustry ? (
                <p className="text-xs text-muted-foreground">No searches found for "{coverageIndustry}"</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── SPANISH LEADS TAB ────── */}
        <TabsContent value="spanish" className="space-y-4">
          <SpanishLeadsPanel />
        </TabsContent>

        {/* ────── SINGLE SEARCH TAB ────── */}
        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Add Search to Queue
              </CardTitle>
              <CardDescription>Search a specific city. Items are added to the queue for batch processing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Industry presets */}
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRY_PRESETS.map(p => (
                  <Button
                    key={p.value}
                    variant={industry === p.value ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setIndustry(p.value)}
                  >
                    {p.emoji} {p.label}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Industry</label>
                  <Input placeholder="e.g. plumber" value={industry} onChange={e => setIndustry(e.target.value)} />
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

              <Button onClick={addToQueue} disabled={!industry || !city}>
                Add to Queue
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── HISTORY TAB ────── */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Search History</CardTitle>
            </CardHeader>
            <CardContent>
              {(!jobs || jobs.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No searches yet.</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
