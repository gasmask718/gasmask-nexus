import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, MapPin, ArrowRight } from 'lucide-react';

type Step = 'upload' | 'map' | 'preview' | 'result';

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
  full_address: 'Full Address *',
  city: 'City *',
  state: 'State *',
  zip: 'ZIP Code',
  latitude: 'Latitude',
  longitude: 'Longitude',
  address_type: 'Address Type',
  notes: 'Notes',
};

export default function TerritoryIngestion() {
  const [step, setStep] = useState<Step>('upload');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [fileName, setFileName] = useState('');

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

      // Auto-map by header name matching
      const autoMap: Partial<ColumnMapping> = {};
      for (const field of ALL_FIELDS) {
        const matchIdx = fileHeaders.findIndex(h =>
          h.toLowerCase().replace(/[_\s-]/g, '') === field.replace(/[_\s-]/g, '')
        );
        if (matchIdx >= 0) {
          autoMap[field] = fileHeaders[matchIdx];
        }
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
      if (headerName) {
        const idx = headers.indexOf(headerName);
        record[field] = idx >= 0 ? (row[idx] || null) : null;
      } else {
        record[field] = null;
      }
    }
    return record;
  }).filter(r => r.full_address && r.city && r.state);

  const ingestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('ingest_territory_addresses', {
        p_addresses: mappedRecords as any,
      });
      if (error) throw error;
      return data as { inserted: number; duplicates: number; total: number };
    },
    onSuccess: (data) => {
      toast({ title: 'Ingestion Complete', description: `${data.inserted} inserted, ${data.duplicates} duplicates skipped.` });
      setStep('result');
    },
    onError: (err: any) => {
      toast({ title: 'Ingestion Failed', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Territory Ingestion</h1>
        <p className="text-muted-foreground">Import addresses into the territory intelligence layer. All records default to unknown status.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'map', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <Badge variant={step === s ? 'default' : 'outline'} className="capitalize">
              {s}
            </Badge>
          </div>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-500" />
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
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" asChild>
                  <span>Choose CSV File</span>
                </Button>
              </label>
              <p className="text-sm text-muted-foreground mt-3">
                Supports: smoke shops, delis, convenience stores, grocery, hookah lounges
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Map columns */}
      {step === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns — {fileName}</CardTitle>
            <CardDescription>
              Map your CSV columns to territory address fields. {rawData.length} rows detected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_FIELDS.map(field => (
                <div key={field} className="space-y-1">
                  <label className="text-sm font-medium text-foreground">{FIELD_LABELS[field]}</label>
                  <Select
                    value={mapping[field] || '__none__'}
                    onValueChange={(val) => setMapping(prev => ({
                      ...prev,
                      [field]: val === '__none__' ? undefined : val,
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip —</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
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

      {/* STEP 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <CardDescription>
              {mappedRecords.length} valid rows ready. All will be imported as discovery_status = 'unknown', discovered_by = 'import'.
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
                      <TableCell>{row.zip || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.latitude && row.longitude
                          ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
                          : '—'}
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
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button
                onClick={() => ingestMutation.mutate()}
                disabled={ingestMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {ingestMutation.isPending ? 'Importing…' : `Import ${mappedRecords.length} Addresses`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Result */}
      {step === 'result' && ingestMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Ingestion Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{ingestMutation.data.total}</p>
                <p className="text-sm text-muted-foreground">Total Processed</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-emerald-500">{ingestMutation.data.inserted}</p>
                <p className="text-sm text-muted-foreground">New Addresses Imported</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{ingestMutation.data.duplicates}</p>
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
              <Button onClick={() => { setStep('upload'); setRawData([]); setHeaders([]); setMapping({}); setFileName(''); }}>
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
