import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle2, MapPin, ArrowRight, Globe, Search, Map, Settings, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type SourceType = 'csv' | 'google_places' | 'yelp' | 'openstreetmap';
type Step = 'source' | 'scope' | 'upload' | 'map' | 'preview' | 'ingesting' | 'result';

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

const REQUIRED_FIELDS = ['full_address', 'city', 'state'] as const;
const OPTIONAL_FIELDS = ['zip', 'latitude', 'longitude', 'address_type', 'notes'] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;

const FIELD_LABELS: Record<string, string> = {
  full_address: 'Full Address *', city: 'City *', state: 'State *',
  zip: 'ZIP Code', latitude: 'Latitude', longitude: 'Longitude', address_type: 'Address Type', notes: 'Notes',
};

const BUSINESS_TYPES = [
  'smoke_shop', 'convenience_store', 'deli', 'grocery', 'hookah_lounge',
  'gas_station', 'liquor_store', 'tobacco_shop', 'vape_shop',
];

const SOURCES: { key: SourceType; label: string; icon: any; description: string; requiresKey: boolean }[] = [
  { key: 'google_places', label: 'Google Places', icon: Search, description: 'Search Google Maps for businesses by type and location', requiresKey: true },
  { key: 'yelp', label: 'Yelp Fusion', icon: Globe, description: 'Search Yelp business listings by category and area', requiresKey: true },
  { key: 'openstreetmap', label: 'OpenStreetMap', icon: Map, description: 'Free Overpass API — shop/amenity tags, no key needed', requiresKey: false },
  { key: 'csv', label: 'CSV Upload', icon: FileSpreadsheet, description: 'Upload a CSV file with address data', requiresKey: false },
];

export default function TerritoryIngestion() {
  const [source, setSource] = useState<SourceType | null>(null);
  const [step, setStep] = useState<Step>('source');

  // CSV state
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [fileName, setFileName] = useState('');

  // API scope state
  const [scopeCity, setScopeCity] = useState('');
  const [scopeState, setScopeState] = useState('');
  const [scopeCountry, setScopeCountry] = useState('US');
  const [scopeTypes, setScopeTypes] = useState<string[]>(['smoke_shop', 'convenience_store']);
  const [apiProgress, setApiProgress] = useState(0);
  const [apiResults, setApiResults] = useState<any>(null);

  const resetAll = () => {
    setSource(null); setStep('source');
    setRawData([]); setHeaders([]); setMapping({}); setFileName('');
    setScopeCity(''); setScopeState(''); setScopeTypes(['smoke_shop', 'convenience_store']);
    setApiProgress(0); setApiResults(null);
  };

  const handleSourceSelect = (s: SourceType) => {
    setSource(s);
    setStep(s === 'csv' ? 'upload' : 'scope');
  };

  // CSV handling
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').map(line =>
        line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      ).filter(line => line.some(cell => cell.length > 0));
      if (lines.length < 2) {
        toast({ title: 'Invalid File', description: 'CSV must have a header row and at least one data row.', variant: 'destructive' });
        return;
      }
      const fileHeaders = lines[0];
      setHeaders(fileHeaders);
      setRawData(lines.slice(1));
      const autoMap: Partial<ColumnMapping> = {};
      for (const field of ALL_FIELDS) {
        const matchIdx = fileHeaders.findIndex(h => h.toLowerCase().replace(/[_\s-]/g, '') === field.replace(/[_\s-]/g, ''));
        if (matchIdx >= 0) autoMap[field] = fileHeaders[matchIdx];
      }
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(file);
  }, []);

  const isMappingValid = REQUIRED_FIELDS.every(f => mapping[f]);

  const mappedRecords = rawData.map(row => {
    const record: Record<string, string | null> = {};
    for (const field of ALL_FIELDS) {
      const headerName = mapping[field];
      if (headerName) { const idx = headers.indexOf(headerName); record[field] = idx >= 0 ? (row[idx] || null) : null; }
      else record[field] = null;
    }
    return record;
  }).filter(r => r.full_address && r.city && r.state);

  const csvIngestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('ingest_territory_addresses', { p_addresses: mappedRecords as any });
      if (error) throw error;
      return data as { inserted: number; duplicates: number; total: number };
    },
    onSuccess: (data) => {
      toast({ title: 'Ingestion Complete', description: `${data.inserted} inserted, ${data.duplicates} duplicates skipped.` });
      setApiResults(data);
      setStep('result');
    },
    onError: (err: any) => toast({ title: 'Ingestion Failed', description: err.message, variant: 'destructive' }),
  });

  // API ingestion
  const apiIngestMutation = useMutation({
    mutationFn: async () => {
      setStep('ingesting');
      setApiProgress(10);
      const functionName = source === 'google_places' ? 'ingest-google-places'
        : source === 'yelp' ? 'ingest-yelp'
        : 'ingest-openstreetmap';

      setApiProgress(30);
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { city: scopeCity, state: scopeState, country: scopeCountry, business_types: scopeTypes },
      });
      setApiProgress(90);
      if (error) throw error;
      setApiProgress(100);
      return data;
    },
    onSuccess: (data) => {
      setApiResults(data);
      setStep('result');
      if (data?.warning) {
        toast({ title: 'Ingestion Warning', description: data.warning, variant: 'destructive' });
      } else {
        toast({ title: 'Ingestion Complete', description: `${data?.inserted ?? 0} new addresses imported.` });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Ingestion Failed', description: err.message, variant: 'destructive' });
      setStep('scope');
    },
  });

  const stepLabels = source === 'csv'
    ? ['source', 'upload', 'map', 'preview', 'result']
    : ['source', 'scope', 'ingesting', 'result'];

  const toggleType = (t: string) => {
    setScopeTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Territory Ingestion</h1>
          <p className="text-muted-foreground">Discover and import addresses into the territory intelligence layer.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {stepLabels.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <Badge variant={step === s ? 'default' : 'outline'} className="capitalize">{s}</Badge>
          </div>
        ))}
      </div>

      {/* STEP: Source Selection */}
      {step === 'source' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SOURCES.map(s => (
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
                      <Badge variant="outline" className="mt-2 text-xs">Requires API Key</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* STEP: Scope (API sources) */}
      {step === 'scope' && source && source !== 'csv' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Define Search Scope — {SOURCES.find(s => s.key === source)?.label}
            </CardTitle>
            <CardDescription>Specify the geographic area and business types to search for.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>City *</Label>
                <Input value={scopeCity} onChange={e => setScopeCity(e.target.value)} placeholder="e.g. New York" />
              </div>
              <div className="space-y-1">
                <Label>State *</Label>
                <Input value={scopeState} onChange={e => setScopeState(e.target.value)} placeholder="e.g. NY" />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={scopeCountry} onChange={e => setScopeCountry(e.target.value)} placeholder="US" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Business Types</Label>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map(t => (
                  <Badge
                    key={t}
                    variant={scopeTypes.includes(t) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleType(t)}
                  >
                    {t.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => { setSource(null); setStep('source'); }}>Back</Button>
              <Button
                onClick={() => apiIngestMutation.mutate()}
                disabled={!scopeCity || !scopeState || scopeTypes.length === 0}
              >
                Start Ingestion
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP: Ingesting (API progress) */}
      {step === 'ingesting' && (
        <Card>
          <CardContent className="py-12">
            <div className="max-w-md mx-auto space-y-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="font-medium">Ingesting from {SOURCES.find(s => s.key === source)?.label}…</p>
              <Progress value={apiProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Searching {scopeCity}, {scopeState} for {scopeTypes.length} business types</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV STEP: Upload */}
      {step === 'upload' && source === 'csv' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-cyan-500" />Upload CSV</CardTitle>
            <CardDescription>Upload a CSV file with address data. Required columns: full_address, city, state.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" asChild><span>Choose CSV File</span></Button>
              </label>
              <p className="text-sm text-muted-foreground mt-3">Supports: smoke shops, delis, convenience stores, grocery, hookah lounges</p>
            </div>
            <div className="pt-4">
              <Button variant="outline" onClick={() => { setSource(null); setStep('source'); }}>Back to Sources</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV STEP: Map columns */}
      {step === 'map' && source === 'csv' && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns — {fileName}</CardTitle>
            <CardDescription>Map your CSV columns to territory address fields. {rawData.length} rows detected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_FIELDS.map(field => (
                <div key={field} className="space-y-1">
                  <label className="text-sm font-medium text-foreground">{FIELD_LABELS[field]}</label>
                  <Select
                    value={mapping[field] || '__none__'}
                    onValueChange={(val) => setMapping(prev => ({ ...prev, [field]: val === '__none__' ? undefined : val }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => setStep('preview')} disabled={!isMappingValid}>
                Preview ({mappedRecords.length} valid rows)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV STEP: Preview */}
      {step === 'preview' && source === 'csv' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <CardDescription>{mappedRecords.length} valid rows ready. All imported as discovery_status = 'unknown'.</CardDescription>
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
                      <TableCell>{row.zip || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.latitude && row.longitude ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {mappedRecords.length > 50 && <p className="text-sm text-muted-foreground mt-2">Showing first 50 of {mappedRecords.length} rows.</p>}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button onClick={() => csvIngestMutation.mutate()} disabled={csvIngestMutation.isPending} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                {csvIngestMutation.isPending ? 'Importing…' : `Import ${mappedRecords.length} Addresses`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP: Result */}
      {step === 'result' && apiResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {apiResults.warning ? (
                <><AlertTriangle className="h-5 w-5 text-amber-500" /> Ingestion Warning</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Ingestion Complete</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{apiResults.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Processed</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-emerald-500">{apiResults.inserted || 0}</p>
                <p className="text-sm text-muted-foreground">New Addresses</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{apiResults.duplicates || apiResults.skipped || 0}</p>
                <p className="text-sm text-muted-foreground">Duplicates Skipped</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 p-3 bg-muted/30 rounded-md">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                All imported addresses are set to <Badge variant="outline">unknown</Badge> status. Use Scout, Call, and Visit consoles to classify them.
              </p>
            </div>
            <div className="pt-4">
              <Button onClick={resetAll}>Import More Data</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
