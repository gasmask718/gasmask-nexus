import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Loader2, CheckCircle2, XCircle, Clock, Globe, MapPin, RotateCcw, Zap,
} from 'lucide-react';
import { toast } from 'sonner';

const STATE_CITIES: Record<string, string[]> = {
  NY: ["Brooklyn","Bronx","Queens","Staten Island","Manhattan","Yonkers","Buffalo","Rochester","Syracuse","Albany"],
  NJ: ["Newark","Jersey City","Paterson","Elizabeth","Edison","Woodbridge","Lakewood","Toms River","Hamilton","Trenton"],
  FL: ["Miami","Orlando","Tampa","Jacksonville","Fort Lauderdale","Hialeah","Tallahassee","Cape Coral","St Petersburg","Port St Lucie"],
  TX: ["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Laredo"],
  GA: ["Atlanta","Augusta","Columbus","Macon","Savannah","Athens","Sandy Springs","Roswell","Albany","Johns Creek"],
  CA: ["Los Angeles","San Diego","San Jose","San Francisco","Fresno","Sacramento","Long Beach","Oakland","Bakersfield","Anaheim"],
  PA: ["Philadelphia","Pittsburgh","Allentown","Reading","Erie","Bethlehem","Lancaster","Harrisburg","Scranton","York"],
  IL: ["Chicago","Aurora","Naperville","Joliet","Rockford","Springfield","Elgin","Peoria","Champaign","Waukegan"],
  CT: ["Bridgeport","New Haven","Hartford","Stamford","Waterbury","Norwalk","Danbury","New Britain","Bristol","Meriden"],
  MA: ["Boston","Worcester","Springfield","Lowell","Cambridge","New Bedford","Brockton","Quincy","Lynn","Fall River"],
};

const INDUSTRY_PRESETS = [
  { emoji: "🧹", label: "Cleaning Service", esLabel: "Limpieza", value: "cleaning service" },
  { emoji: "📦", label: "Moving Company", esLabel: "Mudanzas", value: "moving company" },
  { emoji: "🎨", label: "Painting", esLabel: "Pintor", value: "painting contractor" },
  { emoji: "🌿", label: "Landscaping", esLabel: "Jardinería", value: "landscaping" },
  { emoji: "🔧", label: "Handyman", esLabel: "Mantenimiento", value: "handyman" },
  { emoji: "🚗", label: "Auto Detailing", esLabel: "Detallado", value: "auto detailing" },
  { emoji: "🗑️", label: "Junk Removal", esLabel: "Desecho", value: "junk removal" },
  { emoji: "💦", label: "Pressure Washing", esLabel: "Lavado", value: "pressure washing" },
  { emoji: "🔧", label: "Plumber", esLabel: "Plomero", value: "plumber" },
  { emoji: "⚡", label: "Electrician", esLabel: "Electricista", value: "electrician" },
  { emoji: "❄️", label: "HVAC", esLabel: "HVAC", value: "HVAC" },
  { emoji: "🍽️", label: "Restaurant", esLabel: "Restaurante", value: "restaurant" },
];

const SPANISH_COUNTRIES = [
  { label: "🇩🇴 Rep. Dominicana", value: "DR", cities: ["Santo Domingo","Santiago","La Romana","San Pedro de Macorís","Puerto Plata","Higüey","La Vega","Barahona","Moca","Bonao"] },
  { label: "🇲🇽 México", value: "Mexico", cities: ["Ciudad de México","Guadalajara","Monterrey","Puebla","Cancún","Tijuana","Mérida","León","Querétaro","Toluca"] },
  { label: "🇨🇴 Colombia", value: "Colombia", cities: ["Bogotá","Medellín","Cali","Barranquilla","Cartagena","Bucaramanga","Pereira","Santa Marta","Manizales","Ibagué"] },
  { label: "🇵🇷 Puerto Rico", value: "PR", cities: ["San Juan","Bayamón","Carolina","Ponce","Caguas","Guaynabo","Mayagüez","Arecibo","Toa Baja","Fajardo"] },
  { label: "🇺🇸 US Hispanic", value: "US-Hispanic", cities: ["Miami","Los Angeles","Houston","San Antonio","Dallas","Chicago","New York","Phoenix","San Diego","El Paso"] },
];

const SEARCH_STEPS_EN = ["Searching businesses...", "Analyzing results...", "Filtering no website...", "Preparing results..."];
const SEARCH_STEPS_ES = ["Buscando negocios...", "Analizando resultados...", "Filtrando sin sitio web...", "Preparando resultados..."];

function statusBadge(status: string) {
  switch (status) {
    case "queued": return <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" />Waiting</Badge>;
    case "running": return <Badge className="text-[10px] bg-amber-500 animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case "completed": return <Badge className="text-[10px] bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
    case "failed": return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

export function VALeadDiscovery() {
  const { t, language } = useVASession();
  const queryClient = useQueryClient();
  const isSpanish = language === 'es';
  const searchSteps = isSpanish ? SEARCH_STEPS_ES : SEARCH_STEPS_EN;

  const [mode, setMode] = useState<'english' | 'spanish'>(isSpanish ? 'spanish' : 'english');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState(0);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lastResult, setLastResult] = useState<{ status: string; imported: number; totalFound: number } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const pipeline = mode === 'spanish' ? 'spanish' : 'english';
  const { data: existingLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['va-discovery-leads', pipeline],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_leads_master')
        .select('id, business_name, phone, status, region, language, pipeline, intent_score, priority_tier, website, industry, created_at')
        .eq('pipeline', pipeline)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['va-discovery-jobs'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_discovery_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const selectedCountry = SPANISH_COUNTRIES.find(c => c.value === country);

  const runSearch = async () => {
    const searchCity = customCity || city;
    if (!industry || !searchCity) {
      toast.error(t('va.discovery.missingFields'));
      return;
    }

    const searchState = mode === 'spanish'
      ? (country === 'US-Hispanic' ? 'US' : country)
      : (state || 'US');

    setIsSearching(true);
    setSearchResults([]);
    setLastResult(null);
    setSearchProgress(10);
    setSearchStep(0);

    try {
      const { data: job, error: jobErr } = await (supabase as any)
        .from('brandaro_discovery_jobs')
        .insert({
          search_query: `${industry} in ${searchCity}, ${searchState}`,
          city: searchCity,
          state: searchState,
          industry,
          radius_meters: 40234,
          status: 'queued',
        })
        .select()
        .single();

      if (jobErr) throw jobErr;

      setSearchStep(1);
      setSearchProgress(30);

      const { error: fnErr } = await supabase.functions.invoke('brandaro-lead-discovery', {
        body: {
          job_id: job.id,
          city: searchCity,
          state: searchState,
          industry,
          radius_meters: 40234,
        },
      });

      if (fnErr) throw fnErr;

      setSearchStep(2);
      setSearchProgress(50);

      let attempts = 0;
      while (attempts < 40) {
        await new Promise(r => setTimeout(r, 3000));
        setSearchProgress(Math.min(50 + (attempts / 40) * 45, 95));
        if (attempts > 10) setSearchStep(3);

        const { data: jobData } = await (supabase as any)
          .from('brandaro_discovery_jobs')
          .select('*')
          .eq('id', job.id)
          .single();

        if (jobData?.status === 'completed' || jobData?.status === 'failed') {
          setSearchProgress(100);
          setLastResult({
            status: jobData.status,
            imported: jobData.imported_count || 0,
            totalFound: jobData.total_found || 0,
          });

          if (jobData.status === 'completed' && jobData.imported_count > 0) {
            const { data: newLeads } = await (supabase as any)
              .from('brandaro_leads_master')
              .select('id, business_name, phone, status, region, language, pipeline, intent_score, priority_tier, website, industry, created_at')
              .eq('source', 'brandaro-lead-discovery')
              .order('created_at', { ascending: false })
              .limit(jobData.imported_count + 5);
            setSearchResults(newLeads || []);
            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
          }

          await queryClient.invalidateQueries({ queryKey: ['va-discovery-leads'] });
          await queryClient.invalidateQueries({ queryKey: ['va-discovery-jobs'] });
          await queryClient.invalidateQueries({ queryKey: ['va-leads'] });

          if (jobData.status === 'completed') {
            toast.success(`${t('va.discovery.searchComplete')}: ${jobData.imported_count} ${t('va.discovery.leadsImported')}`);
          } else {
            toast.error(t('va.discovery.searchFailed'));
          }
          break;
        }
        attempts++;
      }

      if (attempts >= 40) {
        setLastResult({ status: 'timeout', imported: 0, totalFound: 0 });
        toast.error(t('va.discovery.searchTimeout'));
      }
    } catch (err: any) {
      toast.error(err.message || t('va.discovery.searchFailed'));
      setLastResult({ status: 'error', imported: 0, totalFound: 0 });
    } finally {
      setIsSearching(false);
    }
  };

  const scoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-red-500/20 text-red-400 text-[10px]">🔥 HOT</Badge>;
    if (score >= 60) return <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">⚡ WARM</Badge>;
    return <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">❄️ COLD</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Search className="h-5 w-5 text-cyan-400" />
          {t('va.discovery.title')}
        </h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'english' ? 'default' : 'outline'}
            className="text-xs"
            onClick={() => setMode('english')}
          >
            🇺🇸 English
          </Button>
          <Button
            size="sm"
            variant={mode === 'spanish' ? 'default' : 'outline'}
            className="text-xs"
            onClick={() => setMode('spanish')}
          >
            🇪🇸 Español
          </Button>
        </div>
      </div>

      <Tabs defaultValue="search">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="search" className="text-xs">{t('va.discovery.searchNew')}</TabsTrigger>
          <TabsTrigger value="existing" className="text-xs">{t('va.discovery.existingLeads')} ({existingLeads.length})</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">{t('va.discovery.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-cyan-400" />
                {mode === 'spanish' ? t('va.discovery.spanishMarket') : t('va.discovery.englishMarket')}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {t('va.discovery.findBusinesses')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'spanish' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">{t('va.discovery.country')}</label>
                  <div className="flex flex-wrap gap-2">
                    {SPANISH_COUNTRIES.map(c => (
                      <Button
                        key={c.value}
                        size="sm"
                        variant={country === c.value ? 'default' : 'outline'}
                        className="text-xs border-slate-600"
                        onClick={() => { setCountry(c.value); setCity(''); }}
                      >
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'english' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">{t('va.discovery.state')}</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(STATE_CITIES).map(s => (
                      <Button
                        key={s}
                        size="sm"
                        variant={state === s ? 'default' : 'outline'}
                        className="text-xs border-slate-600"
                        onClick={() => { setState(s); setCity(''); }}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">{t('va.discovery.industry')}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {INDUSTRY_PRESETS.map(p => (
                    <Button
                      key={p.value}
                      variant={industry === p.value ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 border-slate-600"
                      onClick={() => setIndustry(p.value)}
                    >
                      {p.emoji} {isSpanish ? p.esLabel : p.label}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder={t('va.discovery.customIndustry')}
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="max-w-sm bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {(mode === 'english' ? state : country) && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">{t('va.discovery.city')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select value={city} onValueChange={v => { setCity(v); setCustomCity(''); }}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder={t('va.discovery.selectCity')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(mode === 'english'
                          ? STATE_CITIES[state] || []
                          : selectedCountry?.cities || []
                        ).map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={t('va.discovery.customCity')}
                      value={customCity}
                      onChange={e => { setCustomCity(e.target.value); setCity(''); }}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={runSearch}
                disabled={!industry || (!city && !customCity) || isSearching}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {isSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {isSearching ? t('va.discovery.searching') : t('va.discovery.searchLeads')}
              </Button>

              {isSearching && (
                <div className="space-y-2 p-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                  <Progress value={searchProgress} className="h-2" />
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                    <span className="text-sm text-slate-300">{searchSteps[searchStep] || 'Processing...'}</span>
                  </div>
                  <p className="text-xs text-slate-500">{Math.round(searchProgress)}%</p>
                </div>
              )}

              {lastResult && !isSearching && (
                <div className={`p-4 rounded-lg border ${
                  lastResult.status === 'completed'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                }`}>
                  {lastResult.status === 'completed' ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <div>
                        <p className="font-medium text-sm text-white">
                          {lastResult.imported} {t('va.discovery.leadsImported')}
                        </p>
                        <p className="text-xs text-slate-400">{lastResult.totalFound} {t('va.discovery.detected')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-400" />
                        <span className="font-medium text-sm text-white">{t('va.discovery.noResults')}</span>
                      </div>
                      <Button size="sm" variant="outline" className="border-slate-600" onClick={() => setLastResult(null)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> {t('va.discovery.tryAgain')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {searchResults.length > 0 && (
            <Card ref={resultsRef} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  {t('va.discovery.newResults')} ({searchResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">{t('va.leads.name')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.leads.phone')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.discovery.industry')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.discovery.score')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((lead: any) => (
                        <TableRow key={lead.id} className="border-slate-700/50 text-white">
                          <TableCell className="font-medium text-sm">{lead.business_name}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-300">{lead.phone || '—'}</TableCell>
                          <TableCell className="text-xs text-slate-400">{lead.industry || '—'}</TableCell>
                          <TableCell>{scoreBadge(lead.intent_score || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="existing">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">
                {t('va.discovery.existingLeads')} — {mode === 'spanish' ? '🇪🇸 Spanish' : '🇺🇸 English'} ({existingLeads.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>
              ) : existingLeads.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('va.discovery.noLeadsYet')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">{t('va.leads.name')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.leads.phone')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.discovery.industry')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.discovery.score')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.leads.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingLeads.map((lead: any) => (
                        <TableRow key={lead.id} className="border-slate-700/50 text-white">
                          <TableCell className="font-medium text-sm">{lead.business_name}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-300">{lead.phone || '—'}</TableCell>
                          <TableCell className="text-xs text-slate-400">{lead.industry || '—'}</TableCell>
                          <TableCell>{scoreBadge(lead.intent_score || 0)}</TableCell>
                          <TableCell>
                            <Badge className="text-[10px] bg-slate-600 text-slate-300">{lead.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">{t('va.discovery.history')}</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('va.discovery.noSearchesYet')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">{t('va.discovery.industry')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.discovery.city')}</TableHead>
                        <TableHead className="text-slate-400">{t('va.leads.status')}</TableHead>
                        <TableHead className="text-slate-400 text-right">{t('va.discovery.found')}</TableHead>
                        <TableHead className="text-slate-400 text-right">{t('va.discovery.imported')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job: any) => (
                        <TableRow key={job.id} className="border-slate-700/50 text-white">
                          <TableCell className="text-xs font-medium">{job.industry}</TableCell>
                          <TableCell className="text-xs">{job.city}{job.state ? `, ${job.state}` : ''}</TableCell>
                          <TableCell>{statusBadge(job.status)}</TableCell>
                          <TableCell className="text-right text-xs">{job.total_found}</TableCell>
                          <TableCell className="text-right text-xs font-medium text-emerald-400">{job.imported_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
