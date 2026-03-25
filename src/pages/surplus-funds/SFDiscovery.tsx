import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Upload, Plus, Database } from 'lucide-react';
import * as XLSX from 'xlsx';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function SFDiscovery() {
  const queryClient = useQueryClient();
  const [state, setState] = useState('');
  const [county, setCounty] = useState('');
  const [manualEntries, setManualEntries] = useState<any[]>([]);
  const [importStep, setImportStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<any[]>([]);

  const addLeads = useMutation({
    mutationFn: async (leads: any[]) => {
      const { error } = await supabase.from('surplus_funds_leads').insert(leads);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.length} leads imported`);
      queryClient.invalidateQueries({ queryKey: ['sf-leads'] });
      setCsvRows([]);
      setImportStep(0);
    },
  });

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    setCsvRows(rows);
    setImportStep(2);
    if (fileRef.current) fileRef.current.value = '';
  };

  const doImport = () => {
    const mapped = csvRows.map(r => ({
      first_name: r.first_name || r.FirstName || r['First Name'] || '',
      last_name: r.last_name || r.LastName || r['Last Name'] || '',
      county: r.county || r.County || county || 'Unknown',
      state: r.state || r.State || state || '',
      phone: r.phone || r.Phone || '',
      property_address: r.property_address || r.Address || '',
      foreclosure_date: r.foreclosure_date || null,
      sale_price: r.sale_price ? Number(r.sale_price) : null,
      amount_owed: r.amount_owed ? Number(r.amount_owed) : null,
      surplus_amount: r.surplus_amount ? Number(r.surplus_amount) : null,
      court_case_number: r.court_case_number || r['Case Number'] || '',
      lead_source: 'csv_discovery',
    }));
    addLeads.mutate(mapped);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-500">🔍 Lead Discovery</h1>
        <p className="text-sm text-muted-foreground">Find new surplus funds opportunities from public records</p>
      </div>

      {/* Search Panel */}
      <Card className="border-amber-500/20">
        <CardHeader><CardTitle>Search Public Records</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>County</Label>
              <Input value={county} onChange={e => setCounty(e.target.value)} placeholder="Enter county name" />
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700"><Search className="h-4 w-4 mr-2" />Search</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Tip: Download county surplus lists from your state's clerk of court website, then import below.</p>
        </CardContent>
      </Card>

      {/* Import Wizard */}
      <Card className="border-amber-500/20">
        <CardHeader><CardTitle>Lead Import Wizard</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {importStep === 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'CSV Upload', icon: Upload, action: () => { setImportStep(1); } },
                { label: 'Manual Entry', icon: Plus, action: () => setImportStep(10) },
              ].map(s => (
                <Button key={s.label} variant="outline" className="h-24 flex-col gap-2" onClick={s.action}>
                  <s.icon className="h-6 w-6 text-amber-500" />
                  {s.label}
                </Button>
              ))}
              <Button variant="outline" className="h-24 flex-col gap-2 opacity-50" disabled>
                <Database className="h-6 w-6" />PACER (Coming Soon)
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2 opacity-50" disabled>
                <Database className="h-6 w-6" />PropStream (Coming Soon)
              </Button>
            </div>
          )}

          {importStep === 1 && (
            <div className="space-y-3">
              <p className="text-sm">Upload a CSV with columns: first_name, last_name, county, state, property_address, foreclosure_date, sale_price, amount_owed, surplus_amount, court_case_number</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCSV} />
              <Button variant="outline" onClick={() => setImportStep(0)}>Back</Button>
            </div>
          )}

          {importStep === 2 && csvRows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{csvRows.length} rows found — ready to import</p>
              <div className="overflow-auto max-h-60 border rounded">
                <table className="w-full text-xs">
                  <thead><tr className="border-b">{Object.keys(csvRows[0]).slice(0, 6).map(k => <th key={k} className="p-2 text-left">{k}</th>)}</tr></thead>
                  <tbody>{csvRows.slice(0, 5).map((r, i) => <tr key={i} className="border-b">{Object.values(r).slice(0, 6).map((v: any, j) => <td key={j} className="p-2">{String(v)}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button onClick={doImport} className="bg-amber-600 hover:bg-amber-700" disabled={addLeads.isPending}>{addLeads.isPending ? 'Importing...' : `Import ${csvRows.length} Leads`}</Button>
                <Button variant="outline" onClick={() => { setCsvRows([]); setImportStep(0); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skip Trace Panel */}
      <Card className="border-amber-500/20">
        <CardHeader><CardTitle>Skip Trace</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Find phone numbers for leads that don't have contact info yet.</p>
          <Button variant="outline" className="opacity-60" disabled>
            <Search className="h-4 w-4 mr-2" />Skip Trace Batch (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
