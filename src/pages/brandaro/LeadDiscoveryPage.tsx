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
  Play, Pause, Trash2, RotateCcw, Zap, Globe, Flag
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

const SPANISH_COUNTRIES = [
  { label: "🇩🇴 República Dominicana", value: "DR", cities: ["Santo Domingo","Santiago","La Romana","San Pedro de Macorís","San Cristóbal","Puerto Plata","Higüey","La Vega","Barahona","Moca","Bonao","Azua","San Juan","Nagua","Cotuí","Baní","Mao","Esperanza","Villa Altagracia","Hato Mayor"] },
  { label: "🇲🇽 México", value: "Mexico", cities: ["Ciudad de México","Guadalajara","Monterrey","Puebla","Cancún","Tijuana","Mérida","León","Querétaro","Toluca","Aguascalientes","San Luis Potosí","Hermosillo","Saltillo","Chihuahua","Morelia","Durango","Villahermosa","Tuxtla Gutiérrez","Oaxaca"] },
  { label: "🇨🇴 Colombia", value: "Colombia", cities: ["Bogotá","Medellín","Cali","Barranquilla","Cartagena","Bucaramanga","Pereira","Santa Marta","Manizales","Ibagué","Cúcuta","Villavicencio","Pasto","Montería","Neiva","Armenia","Valledupar","Popayán","Sincelejo","Tunja"] },
  { label: "🇵🇷 Puerto Rico", value: "PR", cities: ["San Juan","Bayamón","Carolina","Ponce","Caguas","Guaynabo","Mayagüez","Arecibo","Toa Baja","Fajardo","Humacao","Aguadilla","Isabela","Manatí","Cayey","Río Grande","Yauco","Vega Baja","Guayama","Hatillo"] },
  { label: "🇺🇸 US Hispanic", value: "US-Hispanic", cities: ["Miami","Los Angeles","Houston","San Antonio","Dallas","Chicago","New York","Phoenix","San Diego","El Paso","San Jose","Austin","Jacksonville","Fort Worth","Denver","Tucson","Albuquerque","Las Vegas","Fresno","Sacramento"] },
];

const SPANISH_INDUSTRIES = [
  { emoji: "🍽️", label: "Restaurante", value: "restaurante" },
  { emoji: "💇", label: "Salón de Belleza", value: "salon de belleza" },
  { emoji: "🔧", label: "Plomero", value: "plomero" },
  { emoji: "🚗", label: "Mecánico", value: "mecanico" },
  { emoji: "🧹", label: "Limpieza", value: "servicio de limpieza" },
  { emoji: "🏗️", label: "Construcción", value: "construccion" },
  { emoji: "🌿", label: "Jardinería", value: "jardineria" },
  { emoji: "⚡", label: "Electricista", value: "electricista" },
  { emoji: "🎨", label: "Pintor", value: "pintor" },
  { emoji: "📦", label: "Mudanzas", value: "mudanzas" },
];

// Dual-language label helper
function DualLabel({ es, en, className = "" }: { es: string; en: string; className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold">{es}</span>
      <span className="text-[10px] text-muted-foreground ml-1.5">({en})</span>
    </span>
  );
}

const SEARCH_STEPS = [
  { es: "Buscando negocios...", en: "Searching businesses..." },
  { es: "Analizando resultados...", en: "Analyzing results..." },
  { es: "Filtrando sin sitio web...", en: "Filtering no website..." },
  { es: "Preparando resultados...", en: "Preparing results..." },
];

function SpanishLeadsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"search" | "existing">("search");
  const [country, setCountry] = useState("all");
  const [searchCountry, setSearchCountry] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchIndustry, setSearchIndustry] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [searchStep, setSearchStep] = useState(0);
  const [searchProgress, setSearchProgress] = useState(0);
  const [lastSearchResult, setLastSearchResult] = useState<{ status: string; imported: number; noWebsite: number; totalFound: number; fetched: number } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { data: spanishLeads = [], isLoading } = useQuery({
    queryKey: ["spanish-leads-discovery", country],
    queryFn: async () => {
      let query = (supabase as any)
        .from("brandaro_leads_master")
        .select("id, business_name, phone, status, region, language, pipeline, intent_score, priority_tier, website, created_at")
        .eq("language", "spanish")
        .eq("pipeline", "spanish")
        .order("intent_score", { ascending: false })
        .limit(100);
      if (country !== "all") query = query.eq("region", country);
      const { data } = await query;
      return data || [];
    },
  });

  const statusLabel: Record<string, string> = {
    new: "Nuevo", contacted: "Contactado", interested: "Interesado",
    closed: "Cerrado", not_interested: "No Interesado",
  };

  const selectedCountryData = SPANISH_COUNTRIES.find(c => c.value === searchCountry);

  const runSingleSearch = async (cityName: string) => {
    const countryLabel = selectedCountryData?.label || searchCountry;
    const stateCode = searchCountry === "US-Hispanic" ? "US" : searchCountry;

    setSearchStep(0); setSearchProgress(10);
    setDebugInfo(`Creating job: ${searchIndustry} in ${cityName}, ${countryLabel}`);

    const { data: job, error: jobErr } = await supabase
      .from("brandaro_discovery_jobs" as any)
      .insert({
        search_query: `${searchIndustry} in ${cityName}, ${countryLabel}`,
        city: cityName,
        state: stateCode,
        industry: searchIndustry,
        radius_meters: 40234,
        status: "queued",
      } as any)
      .select()
      .single();

    if (jobErr) throw jobErr;

    setSearchStep(1); setSearchProgress(30);
    setDebugInfo(`Job created: ${(job as any).id}. Invoking edge function...`);

    const { error: fnErr } = await supabase.functions.invoke("brandaro-lead-discovery", {
      body: {
        job_id: (job as any).id,
        city: cityName,
        state: stateCode,
        industry: searchIndustry,
        radius_meters: 40234,
      },
    });

    if (fnErr) throw fnErr;

    setSearchStep(2); setSearchProgress(50);
    setDebugInfo("Edge function invoked. Polling for results...");

    let attempts = 0;
    while (attempts < 40) {
      await new Promise(r => setTimeout(r, 3000));
      const progressVal = Math.min(50 + (attempts / 40) * 45, 95);
      setSearchProgress(progressVal);
      if (attempts > 10) setSearchStep(3);

      const { data: jobData } = await supabase
        .from("brandaro_discovery_jobs" as any)
        .select("*")
        .eq("id", (job as any).id)
        .single();
        const jd = jobData as any;
        let fetchedCount = 0;

        if (jd?.status === "completed") {
          const { count } = await supabase
            .from("brandaro_leads_master")
            .select("id", { count: "exact", head: true })
            .eq("language", "spanish")
            .eq("source", "brandaro-lead-discovery");
          fetchedCount = count || 0;
        }

        setDebugInfo(`Poll #${attempts + 1}: status=${jd?.status}, found=${jd?.total_found || 0}, imported=${jd?.imported_count || 0}, fetched=${fetchedCount}`);
      if (jd?.status === "completed" || jd?.status === "failed") {
          const result = {
            status: jd.status,
            imported: jd.imported_count || 0,
            noWebsite: jd.no_website_count || 0,
            totalFound: jd.total_found || 0,
            fetched: fetchedCount,
          };
        setSearchProgress(100);
        setLastSearchResult(result);
        // Fetch the newly imported leads for instant display
        if (jd?.status === "completed" && jd.imported_count > 0) {
          const { data: newLeads } = await (supabase as any)
            .from("brandaro_leads_master")
            .select("id, business_name, phone, status, region, language, pipeline, intent_score, priority_tier, website, industry, created_at")
            .eq("language", "spanish")
            .eq("pipeline", "spanish")
            .eq("source", "brandaro-lead-discovery")
            .order("created_at", { ascending: false })
            .limit(jd.imported_count + 5);
          console.log("Fetched Leads:", newLeads?.length, newLeads);
          setSearchResults(newLeads || []);
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
        } else if (jd?.status === "completed" && jd.imported_count === 0) {
          setSearchResults([]);
        }
        return result;
      }
      attempts++;
    }
    const timeoutResult = { status: "timeout", imported: 0, noWebsite: 0, totalFound: 0, fetched: 0 };
    setLastSearchResult(timeoutResult);
    return timeoutResult;
  };

  const handleSingleSearch = async () => {
    if (!searchIndustry || !searchCountry) return;
    const cityToSearch = customCity || searchCity;
    if (!cityToSearch) {
      toast({ title: "Selecciona una ciudad", variant: "destructive" });
      return;
    }
    setIsSearching(true);
    setLastSearchResult(null);
    setSearchResults([]);
    setSearchProgress(0);
    setSearchStep(0);
    try {
      const result = await runSingleSearch(cityToSearch);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["spanish-leads-discovery"] }),
        queryClient.invalidateQueries({ queryKey: ["brandaro-discovery-jobs"] }),
      ]);
      if (result.status === "completed") {
        toast({ title: "✅ Búsqueda completada", description: `${result.imported} leads importados (${result.noWebsite} sin sitio web)` });
      } else {
        toast({ title: "⚠️ Búsqueda falló", description: `Estado: ${result.status}`, variant: "destructive" });
      }
    } catch (err: any) {
      setDebugInfo(`Error: ${err.message}`);
      setLastSearchResult({ status: "error", imported: 0, noWebsite: 0, totalFound: 0, fetched: 0 });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleBulkSearch = async () => {
    if (!searchIndustry || !searchCountry || selectedCities.length === 0) return;
    setIsBulkRunning(true);
    let totalImported = 0;
    let completed = 0;

    for (const city of selectedCities) {
      try {
        const result = await runSingleSearch(city);
        totalImported += result.imported;
        completed++;
        toast({ title: `🔍 ${city}`, description: `${result.imported} leads — ${completed}/${selectedCities.length}` });
      } catch {
        toast({ title: `❌ ${city}`, description: "Error en búsqueda", variant: "destructive" });
      }
    }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["spanish-leads-discovery"] }),
        queryClient.invalidateQueries({ queryKey: ["brandaro-discovery-jobs"] }),
      ]);
    toast({ title: "✅ Búsqueda masiva completada", description: `${totalImported} leads importados de ${completed} ciudades` });
    setIsBulkRunning(false);
    setSelectedCities([]);
  };

  const toggleCity = (city: string) => {
    setSelectedCities(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);
  };

  const selectAllCities = () => {
    if (!selectedCountryData) return;
    setSelectedCities(prev => prev.length === selectedCountryData.cities.length ? [] : [...selectedCountryData.cities]);
  };

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={activeTab === "search" ? "default" : "outline"} onClick={() => setActiveTab("search")}>
          <Search className="h-3.5 w-3.5 mr-1" /> <DualLabel es="Buscar Nuevos Leads" en="Search New Leads" />
        </Button>
        <Button size="sm" variant={activeTab === "existing" ? "default" : "outline"} onClick={() => setActiveTab("existing")}>
          <Flag className="h-3.5 w-3.5 mr-1" /> <DualLabel es="Leads Existentes" en="Existing Leads" /> ({spanishLeads.length})
        </Button>
      </div>

      {activeTab === "search" ? (
        <div className="space-y-4">
          {/* Country Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> <DualLabel es="Buscador de Leads — Mercado Español" en="Lead Finder — Spanish Market" />
              </CardTitle>
              <CardDescription><DualLabel es="Encuentra negocios sin sitio web en países hispanohablantes" en="Find businesses without websites in Spanish-speaking countries" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Country buttons */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium"><DualLabel es="País / Región" en="Country / Region" /></label>
                <div className="flex flex-wrap gap-2">
                  {SPANISH_COUNTRIES.map(c => (
                    <Button
                      key={c.value}
                      size="sm"
                      variant={searchCountry === c.value ? "default" : "outline"}
                      className="text-xs"
                      onClick={() => { setSearchCountry(c.value); setSearchCity(""); setSelectedCities([]); }}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Industry */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium"><DualLabel es="Tipo de Negocio" en="Business Type" /></label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SPANISH_INDUSTRIES.map(p => (
                    <Button
                      key={p.value}
                      variant={searchIndustry === p.value ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSearchIndustry(p.value)}
                    >
                      {p.emoji} {p.label}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="O escribe un tipo de negocio..."
                  value={searchIndustry}
                  onChange={e => setSearchIndustry(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {/* City selection */}
              {searchCountry && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium"><DualLabel es="Ciudad" en="City" /></label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Select value={searchCity} onValueChange={v => { setSearchCity(v); setCustomCity(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecciona una ciudad" /></SelectTrigger>
                        <SelectContent>
                          {selectedCountryData?.cities.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="O escribe una ciudad personalizada..."
                      value={customCity}
                      onChange={e => { setCustomCity(e.target.value); setSearchCity(""); }}
                    />
                  </div>
                </div>
              )}

              {/* Search button */}
              <Button
                onClick={handleSingleSearch}
                disabled={!searchIndustry || !searchCountry || (!searchCity && !customCity) || isSearching}
                className="w-full md:w-auto"
              >
                {isSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {isSearching ? <DualLabel es="Buscando..." en="Searching..." /> : <DualLabel es="Buscar Leads" en="Search Leads" />}
              </Button>

              {/* Loading progress */}
              {isSearching && (
                <div className="space-y-2 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <Progress value={searchProgress} className="h-2" />
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <DualLabel
                      es={SEARCH_STEPS[searchStep]?.es || "Procesando..."}
                      en={SEARCH_STEPS[searchStep]?.en || "Processing..."}
                      className="text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{Math.round(searchProgress)}% completado</p>
                </div>
              )}

              {/* Search result feedback */}
              {lastSearchResult && !isSearching && (
                <div className={`p-4 rounded-lg border ${
                  lastSearchResult.status === "completed" ? "border-primary/30 bg-primary/5" :
                  "border-destructive/30 bg-destructive/5"
                }`}>
                  {lastSearchResult.status === "completed" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">
                            <DualLabel es={`${lastSearchResult.imported} negocios guardados`} en={`${lastSearchResult.imported} businesses saved`} />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lastSearchResult.noWebsite} sin sitio web (no website) • {lastSearchResult.totalFound} detectados
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                        <p className="font-medium text-sm">
                          <DualLabel es={`Detectados: ${lastSearchResult.totalFound}`} en={`Found: ${lastSearchResult.totalFound}`} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <DualLabel es={`Guardados: ${lastSearchResult.imported}`} en={`Saved: ${lastSearchResult.imported}`} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <DualLabel es={`Visibles: ${lastSearchResult.fetched}`} en={`Visible: ${lastSearchResult.fetched}`} />
                        </p>
                      </div>
                      {lastSearchResult.imported === 0 && lastSearchResult.totalFound > 0 && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                          <DualLabel es="Leads encontrados pero no guardados — revisa la lógica de inserción" en="Leads found but not saved — check insertion logic" />
                        </div>
                      )}
                      </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-destructive" />
                        <DualLabel es="No se encontraron resultados" en="No results found" className="font-medium text-sm" />
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>• Intenta una ciudad diferente (Try a different city)</p>
                        <p>• Usa un tipo de negocio más amplio (Use a broader business type)</p>
                        <p>• Quita filtros (Remove filters)</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setLastSearchResult(null); }}>
                        <RotateCcw className="h-3 w-3 mr-1" /> <DualLabel es="Intentar de nuevo" en="Try again" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Debug toggle */}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setShowDebug(!showDebug)}>
                  {showDebug ? "🔧 Ocultar Debug" : "🔧 Modo Debug"}
                </Button>
              </div>
              {showDebug && debugInfo && (
                <pre className="text-[10px] p-2 rounded bg-muted text-muted-foreground font-mono overflow-x-auto">{debugInfo}</pre>
              )}
            </CardContent>
          </Card>

          {/* ── Instant Search Results Table ── */}
          <div ref={resultsRef}>
          {searchResults.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <DualLabel es={`${searchResults.length} Resultados Encontrados`} en={`${searchResults.length} Results Found`} />
                  </CardTitle>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setSearchResults([])}>
                    <XCircle className="h-3 w-3 mr-1" /> Cerrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                      <TableRow>
                        <TableHead><DualLabel es="Negocio" en="Business" /></TableHead>
                        <TableHead><DualLabel es="Teléfono" en="Phone" /></TableHead>
                        <TableHead><DualLabel es="Ciudad" en="City" /></TableHead>
                        <TableHead><DualLabel es="Sitio Web" en="Website" /></TableHead>
                        <TableHead><DualLabel es="Puntuación" en="Score" /></TableHead>
                        <TableHead><DualLabel es="Prioridad" en="Priority" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((lead: any) => {
                        const s = lead.intent_score || 0;
                        const tier = s >= 80
                          ? { label: "🔥 HOT", cls: "bg-destructive text-destructive-foreground" }
                          : s >= 60
                          ? { label: "⚡ WARM", cls: "bg-primary text-primary-foreground" }
                          : { label: "❄️ COLD", cls: "bg-muted text-muted-foreground" };
                        return (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium text-sm">{lead.business_name || "—"}</TableCell>
                            <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{lead.region || "—"}</Badge></TableCell>
                            <TableCell>
                              {lead.website ? (
                                <Badge variant="secondary" className="text-[10px]">✅ Tiene Web</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">❌ SIN WEB</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-semibold">{s}%</TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${tier.cls}`}>{tier.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
          {!isSearching && lastSearchResult && searchResults.length === 0 && lastSearchResult.status === "completed" && (
            <Card className="border-dashed border-muted-foreground/30">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-sm font-medium">No se encontraron resultados nuevos</p>
                <p className="text-xs mt-1">No new results returned — try a different city or industry</p>
              </CardContent>
            </Card>
          )}
          </div>

          {/* Bulk city selector */}
          {searchCountry && selectedCountryData && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> <DualLabel es={`Búsqueda Masiva — ${selectedCountryData.label}`} en="Bulk Search" />
                  </CardTitle>
                  <Button size="sm" variant="outline" className="text-xs" onClick={selectAllCities}>
                    {selectedCities.length === selectedCountryData.cities.length ? "Deseleccionar Todo" : "Seleccionar Todo"}
                  </Button>
                </div>
                <CardDescription><DualLabel es="Selecciona ciudades para búsqueda masiva" en="Select cities for bulk search" /></CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {selectedCountryData.cities.map(city => (
                    <Button
                      key={city}
                      size="sm"
                      variant={selectedCities.includes(city) ? "default" : "outline"}
                      className="text-xs h-7"
                      onClick={() => toggleCity(city)}
                    >
                      {city}
                    </Button>
                  ))}
                </div>

                {selectedCities.length > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-md bg-primary/5 border border-primary/20">
                    <div>
                      <p className="text-sm font-medium">
                        {selectedCities.length} ciudades seleccionadas — <span className="text-primary">{searchIndustry || "sin industria"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Estimado: ~{selectedCities.length * 5}–{selectedCities.length * 15} leads
                      </p>
                    </div>
                    <Button
                      onClick={handleBulkSearch}
                      disabled={!searchIndustry || isBulkRunning}
                      size="sm"
                    >
                      {isBulkRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                      {isBulkRunning ? "Ejecutando..." : `Buscar ${selectedCities.length} Ciudades`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Existing leads view */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-500" /> Leads en Español — Por País
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={country === "all" ? "default" : "outline"} className="text-xs" onClick={() => setCountry("all")}>
                Todos ({spanishLeads.length})
              </Button>
              {SPANISH_COUNTRIES.map((c) => (
                <Button key={c.value} size="sm" variant={country === c.value ? "default" : "outline"} className="text-xs" onClick={() => setCountry(c.value)}>
                  {c.label}
                </Button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : spanishLeads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay leads en español{country !== "all" ? ` en ${country}` : ""}.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Negocio</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Región</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...spanishLeads].sort((a: any, b: any) => (b.intent_score || 0) - (a.intent_score || 0)).map((lead: any) => {
                    const s = lead.intent_score || 0;
                    const tier = s >= 80 ? { label: "🔥 HOT", cls: "bg-amber-500 text-white" }
                      : s >= 60 ? { label: "⚡ WARM", cls: "bg-blue-500 text-white" }
                      : { label: "❄️ COLD", cls: "bg-muted text-muted-foreground" };
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.business_name || "—"}</TableCell>
                        <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{lead.region || "—"}</Badge></TableCell>
                        <TableCell>
                          {lead.website ? (
                            <Badge variant="secondary" className="text-xs">Tiene Web</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">❌ SIN WEB</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{statusLabel[lead.status] || lead.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${tier.cls}`}>{tier.label} ({s}%)</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LeadDiscoveryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Single search state
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radius, setRadius] = useState("40234");

  // Instant search state
  const [isInstantSearching, setIsInstantSearching] = useState(false);
  const [instantResults, setInstantResults] = useState<any[]>([]);
  const [instantSearchStep, setInstantSearchStep] = useState(0);
  const [instantSearchProgress, setInstantSearchProgress] = useState(0);
  const [instantLastResult, setInstantLastResult] = useState<{ status: string; imported: number; noWebsite: number; totalFound: number } | null>(null);
  const [instantDebug, setInstantDebug] = useState("");
  const [showInstantDebug, setShowInstantDebug] = useState(false);
  const instantResultsRef = useRef<HTMLDivElement>(null);

  const handleInstantSearch = async () => {
    if (!industry || !city) return;
    setIsInstantSearching(true);
    setInstantResults([]);
    setInstantLastResult(null);
    setInstantSearchProgress(0);
    setInstantSearchStep(0);
    try {
      setInstantSearchStep(0); setInstantSearchProgress(10);
      setInstantDebug(`Creating job: ${industry} in ${city}, ${state}`);

      const { data: job, error: jobErr } = await supabase
        .from("brandaro_discovery_jobs" as any)
        .insert({
          search_query: `${industry} in ${city}, ${state}`,
          city,
          state: state || "US",
          industry,
          radius_meters: parseInt(radius),
          status: "queued",
        } as any)
        .select()
        .single();

      if (jobErr) throw jobErr;

      setInstantSearchStep(1); setInstantSearchProgress(30);
      setInstantDebug(`Job created: ${(job as any).id}. Invoking edge function...`);

      const { error: fnErr } = await supabase.functions.invoke("brandaro-lead-discovery", {
        body: {
          job_id: (job as any).id,
          city,
          state: state || "US",
          industry,
          radius_meters: parseInt(radius),
        },
      });

      if (fnErr) throw fnErr;

      setInstantSearchStep(2); setInstantSearchProgress(50);
      setInstantDebug("Edge function invoked. Polling for results...");

      let attempts = 0;
      while (attempts < 40) {
        await new Promise(r => setTimeout(r, 3000));
        const progressVal = Math.min(50 + (attempts / 40) * 45, 95);
        setInstantSearchProgress(progressVal);
        if (attempts > 10) setInstantSearchStep(3);

        const { data: jobData } = await supabase
          .from("brandaro_discovery_jobs" as any)
          .select("*")
          .eq("id", (job as any).id)
          .single();
        const jd = jobData as any;

        setInstantDebug(`Poll #${attempts + 1}: status=${jd?.status}, found=${jd?.total_found || 0}, imported=${jd?.imported_count || 0}`);

        if (jd?.status === "completed" || jd?.status === "failed") {
          setInstantSearchProgress(100);
          const result = {
            status: jd.status,
            imported: jd.imported_count || 0,
            noWebsite: jd.no_website_count || 0,
            totalFound: jd.total_found || 0,
          };
          setInstantLastResult(result);

          if (jd?.status === "completed" && jd.imported_count > 0) {
            const { data: newLeads } = await (supabase as any)
              .from("brandaro_leads_master")
              .select("id, business_name, phone, status, region, language, pipeline, intent_score, priority_tier, website, industry, created_at")
              .eq("language", "english")
              .eq("source", "brandaro-lead-discovery")
              .order("created_at", { ascending: false })
              .limit(jd.imported_count + 5);
            console.log("Instant Search Fetched Leads:", newLeads?.length, newLeads);
            setInstantResults(newLeads || []);
            setTimeout(() => instantResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
          } else {
            setInstantResults([]);
          }

          if (result.status === "completed") {
            toast({ title: "✅ Search Complete", description: `${result.imported} leads imported (${result.noWebsite} no website)` });
          } else {
            toast({ title: "⚠️ Search Failed", description: `Status: ${result.status}`, variant: "destructive" });
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["brandaro-discovery-jobs"] }),
          ]);
          break;
        }
        attempts++;
      }

      if (attempts >= 40) {
        setInstantLastResult({ status: "timeout", imported: 0, noWebsite: 0, totalFound: 0 });
        toast({ title: "⏱ Timeout", description: "Search timed out. Check History tab.", variant: "destructive" });
      }
    } catch (err: any) {
      setInstantDebug(`Error: ${err.message}`);
      setInstantLastResult({ status: "error", imported: 0, noWebsite: 0, totalFound: 0 });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsInstantSearching(false);
    }
  };

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

        {/* ────── SINGLE SEARCH TAB (INSTANT) ────── */}
        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Instant Lead Search
              </CardTitle>
              <CardDescription>Search a specific city and see results immediately.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Industry presets */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Industry</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
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
                <Input
                  placeholder="Or type a custom industry..."
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleInstantSearch}
                  disabled={!industry || !city || isInstantSearching}
                >
                  {isInstantSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  {isInstantSearching ? "Searching..." : "Search Now"}
                </Button>
                <Button variant="outline" onClick={addToQueue} disabled={!industry || !city}>
                  <Clock className="h-4 w-4 mr-2" /> Add to Queue
                </Button>
              </div>

              {/* Loading progress */}
              {isInstantSearching && (
                <div className="space-y-2 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <Progress value={instantSearchProgress} className="h-2" />
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-sm">
                      {SEARCH_STEPS[instantSearchStep]?.en || "Processing..."}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{Math.round(instantSearchProgress)}% complete</p>
                </div>
              )}

              {/* Search result feedback */}
              {instantLastResult && !isInstantSearching && (
                <div className={`p-4 rounded-lg border ${
                  instantLastResult.status === "completed" ? "border-primary/30 bg-primary/5" :
                  "border-destructive/30 bg-destructive/5"
                }`}>
                  {instantLastResult.status === "completed" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{instantLastResult.imported} businesses saved</p>
                          <p className="text-xs text-muted-foreground">
                            {instantLastResult.noWebsite} no website • {instantLastResult.totalFound} detected
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-destructive" />
                        <span className="font-medium text-sm">No results found</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>• Try a different city</p>
                        <p>• Use a broader industry type</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setInstantLastResult(null)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Try again
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Debug toggle */}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setShowInstantDebug(!showInstantDebug)}>
                  {showInstantDebug ? "🔧 Hide Debug" : "🔧 Debug Mode"}
                </Button>
              </div>
              {showInstantDebug && instantDebug && (
                <pre className="text-[10px] p-2 rounded bg-muted text-muted-foreground font-mono overflow-x-auto">{instantDebug}</pre>
              )}
            </CardContent>
          </Card>

          {/* ── Instant Search Results Table ── */}
          <div ref={instantResultsRef}>
            {instantResults.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {instantResults.length} Results Found
                    </CardTitle>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setInstantResults([])}>
                      <XCircle className="h-3 w-3 mr-1" /> Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                        <TableRow>
                          <TableHead>Business</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>Lang</TableHead>
                          <TableHead>Website</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {instantResults.map((lead: any) => {
                          const s = lead.intent_score || 0;
                          const tier = s >= 80
                            ? { label: "🔥 HOT", cls: "bg-destructive text-destructive-foreground" }
                            : s >= 60
                            ? { label: "⚡ WARM", cls: "bg-primary text-primary-foreground" }
                            : { label: "❄️ COLD", cls: "bg-muted text-muted-foreground" };
                          return (
                            <TableRow key={lead.id}>
                              <TableCell className="font-medium text-sm">{lead.business_name || "—"}</TableCell>
                              <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{lead.region || "—"}</Badge></TableCell>
                              <TableCell>
                                {lead.website ? (
                                  <Badge variant="secondary" className="text-[10px]">✅ Has Website</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px]">❌ NO WEBSITE</Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm font-semibold">{s}%</TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${tier.cls}`}>{tier.label}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
            {!isInstantSearching && instantLastResult && instantResults.length === 0 && instantLastResult.status === "completed" && (
              <Card className="border-dashed border-muted-foreground/30">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No new results found</p>
                  <p className="text-xs mt-1">Try a different city or industry</p>
                </CardContent>
              </Card>
            )}
          </div>
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
