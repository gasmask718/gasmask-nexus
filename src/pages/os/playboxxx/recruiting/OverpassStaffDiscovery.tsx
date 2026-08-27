/**
 * Overpass Staff Discovery — live scraper console.
 * Phase: discovery only. Results are displayed, never persisted.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Loader2, Play, Plus, Pencil, Trash2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EmptyState } from './shared';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NA = 'Not available';

interface OsmCategory { id: string; key: string; value: string }
interface OsmResult {
  type: string;
  id: number;
  name: string | null;
  category: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  website: string | null;
  tags: Record<string, string>;
}

function buildQuery(areaId: string, categories: OsmCategory[]) {
  const lines = categories
    .filter((c) => c.key.trim() && c.value.trim())
    .map((c) => `  nwr["${c.key.trim()}"="${c.value.trim()}"](area.searchArea);`)
    .join('\n');
  return `[out:json][timeout:60];\narea(id:${areaId})->.searchArea;\n(\n${lines}\n);\nout center tags;`;
}

async function copy(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export default function OverpassStaffDiscovery() {
  const [location, setLocation] = useState('Miami, Florida');
  const [areaId, setAreaId] = useState('3601216769');
  const [categories, setCategories] = useState<OsmCategory[]>([
    { id: 'cat-1', key: 'beauty', value: 'nails' },
  ]);

  const [editing, setEditing] = useState<OsmCategory | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catKey, setCatKey] = useState('');
  const [catValue, setCatValue] = useState('');

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OsmResult[] | null>(null);
  const [runMeta, setRunMeta] = useState<{ ms: number; location: string; categories: string; status: string } | null>(null);
  const [selected, setSelected] = useState<OsmResult | null>(null);

  const query = useMemo(() => buildQuery(areaId, categories), [areaId, categories]);
  const payload = useMemo(() => `data=${encodeURIComponent(query)}`, [query]);
  const headers = useMemo(
    () => ({
      Accept: '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    }),
    [],
  );
  const httpRequest = useMemo(
    () =>
      [
        `POST ${OVERPASS_URL}`,
        ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
        '',
        payload,
      ].join('\n'),
    [headers, payload],
  );
  const categoryLabel = categories.map((c) => `${c.key}=${c.value}`).join(', ') || '—';

  const openAdd = () => { setEditing(null); setCatKey(''); setCatValue(''); setCatOpen(true); };
  const openEdit = (c: OsmCategory) => { setEditing(c); setCatKey(c.key); setCatValue(c.value); setCatOpen(true); };
  const saveCategory = () => {
    const k = catKey.trim(); const v = catValue.trim();
    if (!k || !v) { toast.error('Both key and value are required'); return; }
    if (editing) {
      setCategories((prev) => prev.map((c) => (c.id === editing.id ? { ...c, key: k, value: v } : c)));
    } else {
      setCategories((prev) => [...prev, { id: `cat-${Date.now()}`, key: k, value: v }]);
    }
    setCatOpen(false);
  };
  const removeCategory = (id: string) => setCategories((prev) => prev.filter((c) => c.id !== id));

  const runScraper = async () => {
    if (categories.length === 0) { toast.error('Add at least one category first'); return; }
    setRunning(true); setError(null); setResults(null); setRunMeta(null);
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Overpass API error ${res.status}: ${text.slice(0, 300) || res.statusText}`);
      }
      const json = await res.json();
      const elements: any[] = Array.isArray(json?.elements) ? json.elements : [];
      const parsed: OsmResult[] = elements.map((el) => {
        const tags: Record<string, string> = el.tags || {};
        const matched = categories.find((c) => tags[c.key] === c.value);
        const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
        return {
          type: el.type,
          id: el.id,
          name: tags.name || null,
          category: matched ? `${matched.key}=${matched.value}` : '—',
          address: street || null,
          city: tags['addr:city'] || null,
          lat: el.lat ?? el.center?.lat ?? null,
          lon: el.lon ?? el.center?.lon ?? null,
          phone: tags.phone || tags['contact:phone'] || null,
          website: tags.website || tags['contact:website'] || null,
          tags,
        };
      });
      const ms = performance.now() - started;
      setResults(parsed);
      setRunMeta({ ms, location, categories: categoryLabel, status: 'Completed' });
      if (parsed.length === 0) toast.info('No results found for the selected location and categories.');
      else toast.success('Search completed successfully.');
    } catch (e: any) {
      const msg =
        e?.name === 'AbortError'
          ? 'Overpass request timed out.'
          : e instanceof TypeError
            ? 'Network error — could not reach the Overpass API.'
            : e?.message || 'Unexpected error running the Overpass request.';
      setError(msg);
      setRunMeta({ ms: performance.now() - started, location, categories: categoryLabel, status: 'Failed' });
      toast.error(msg);
    } finally {
      clearTimeout(timer);
      setRunning(false);
    }
  };

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );

  const CodeBlock = ({ text }: { text: string }) => (
    <pre className="rounded-md bg-muted/60 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
      {text}
    </pre>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            Overpass Staff Discovery
            <Badge variant="outline" className="border-primary/40 text-primary">Live</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Discovery only — results are displayed and never saved to the CRM.
          </p>
        </div>
        <Button onClick={runScraper} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          {running ? 'Running Overpass Staff Discovery...' : 'Run Overpass Staff Discovery'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <Accordion type="multiple" defaultValue={['info', 'config', 'categories']} className="w-full">
          <AccordionItem value="info">
            <AccordionTrigger className="text-sm">Scraper Information</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Scraper" value="Overpass Staff Discovery" />
                <Field label="Purpose" value="Discover local staff and service businesses using OpenStreetMap data." />
                <Field label="Data Source" value="Overpass API / OpenStreetMap" />
                <Field label="Location" value={location} />
                <Field label="Area ID" value={areaId} />
                <Field label="Current Category" value={categoryLabel} />
                <Field label="Output" value="OSM discovery results" />
                <Field label="Persistence" value="Not enabled" />
              </div>
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Results are currently displayed only and are not saved to the CRM.
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="config">
            <AccordionTrigger className="text-sm">Search Configuration</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ov-location">Location</Label>
                  <Input id="ov-location" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ov-area">Area ID</Label>
                  <Input id="ov-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <p className="text-sm pt-2">Overpass / OpenStreetMap</p>
                </div>
                <div className="space-y-2">
                  <Label>Categories</Label>
                  <p className="text-sm pt-2">{categoryLabel}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="categories">
            <AccordionTrigger className="text-sm">Categories</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center gap-1 rounded-md border px-2 py-1">
                    <span className="text-sm font-mono">{c.key} = {c.value}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(c)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCategory(c.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={openAdd}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="query">
            <AccordionTrigger className="text-sm">Generated Overpass Query</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <CodeBlock text={query} />
              <Button variant="outline" size="sm" onClick={() => copy('Query', query)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy Query
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payload">
            <AccordionTrigger className="text-sm">Encoded Payload</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <CodeBlock text={payload} />
              <Button variant="outline" size="sm" onClick={() => copy('Payload', payload)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy Payload
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="http">
            <AccordionTrigger className="text-sm">Full HTTP Request</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <CodeBlock text={httpRequest} />
              <Button variant="outline" size="sm" onClick={() => copy('HTTP request', httpRequest)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy HTTP Request
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Execution status */}
        {running && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-sm">Running Overpass Staff Discovery...</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-destructive/30 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {!running && !error && results && runMeta && (
          <>
            <Alert className="border-primary/30 bg-primary/10">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {results.length > 0 ? 'Scraper Completed Successfully' : 'No Results Found'}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Field label="Total Results" value={String(results.length)} />
              <Field label="Location" value={runMeta.location} />
              <Field label="Categories" value={runMeta.categories} />
              <Field label="Execution Time" value={`${(runMeta.ms / 1000).toFixed(1)} seconds`} />
              <Field label="Request Status" value={runMeta.status} />
            </div>

            {results.length === 0 ? (
              <EmptyState
                title="No Results Found"
                description={`No results found for ${runMeta.location} with categories ${runMeta.categories}.`}
              />
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Scraper Output</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OSM Type</TableHead>
                        <TableHead>OSM ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Latitude</TableHead>
                        <TableHead>Longitude</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Website</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r) => (
                        <TableRow
                          key={`${r.type}-${r.id}`}
                          className="cursor-pointer"
                          onClick={() => setSelected(r)}
                        >
                          <TableCell>{r.type}</TableCell>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell className="font-medium">{r.name || NA}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell className="text-muted-foreground">{r.address || NA}</TableCell>
                          <TableCell>{r.city || NA}</TableCell>
                          <TableCell>{r.lat ?? NA}</TableCell>
                          <TableCell>{r.lon ?? NA}</TableCell>
                          <TableCell>{r.phone || NA}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{r.website || NA}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </CardContent>

      {/* Category add/edit modal */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>OpenStreetMap tag used to build the Overpass query.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-key">Key</Label>
              <Input id="cat-key" placeholder="shop" value={catKey} onChange={(e) => setCatKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-value">Value</Label>
              <Input id="cat-value" placeholder="hairdresser" value={catValue} onChange={(e) => setCatValue(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {catKey.trim() || 'key'} = {catValue.trim() || 'value'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory}>{editing ? 'Save Changes' : 'Add Category'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selected?.name || NA}</DialogTitle>
            <DialogDescription>OpenStreetMap record returned by this run.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <Field label="OSM Type" value={selected.type} />
              <Field label="OSM ID" value={String(selected.id)} />
              <Field label="Category" value={selected.category} />
              <Field label="Address" value={selected.address || NA} />
              <Field label="City" value={selected.city || NA} />
              <Field label="Latitude" value={selected.lat != null ? String(selected.lat) : NA} />
              <Field label="Longitude" value={selected.lon != null ? String(selected.lon) : NA} />
              <Field label="Phone" value={selected.phone || NA} />
              <Field label="Website" value={selected.website || NA} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
