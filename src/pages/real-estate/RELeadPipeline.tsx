import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Search, Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const STATUS_TABS = ['all','new','skip_trace_pending','phone_found','queued','interested','analyzed','offer_made','under_contract','dead'];

export default function RELeadPipeline() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => { fetchLeads(); }, [tab, stateFilter, scoreFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    let q = supabase.from('re_leads').select('*').order('updated_at', { ascending: false }).limit(200);
    if (tab !== 'all') q = q.eq('status', tab);
    if (stateFilter !== 'all') q = q.eq('state', stateFilter);
    if (scoreFilter !== 'all') q = q.eq('deal_score', scoreFilter);
    const { data } = await q;
    setLeads(data || []);
    setLoading(false);
  };

  const filtered = leads.filter(l =>
    (l.property_address || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.last_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const scoreBadge = (score: string | null) => {
    if (score === 'A') return <Badge style={{ backgroundColor: '#3B6D11' }}>A</Badge>;
    if (score === 'B') return <Badge className="bg-amber-600">B</Badge>;
    if (score === 'C') return <Badge variant="destructive">C</Badge>;
    if (score === 'D') return <Badge variant="outline">D</Badge>;
    return <Badge variant="secondary">—</Badge>;
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
    const mapped = rows.map(r => ({
      first_name: r.first_name || r.FirstName || '',
      last_name: r.last_name || r.LastName || '',
      phone: r.phone || r.Phone || '',
      property_address: r.property_address || r.Address || r.address || '',
      city: r.city || r.City || '',
      state: r.state || r.State || '',
      zip: r.zip || r.Zip || '',
      estimated_value: parseFloat(r.estimated_value || r.Value || '0') || null,
      lead_type: r.lead_type || '',
      lead_source: r.lead_source || 'csv_upload',
    })).filter(r => r.property_address);

    const { error } = await supabase.from('re_leads').insert(mapped);
    if (error) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); }
    else { toast({ title: `${mapped.length} leads uploaded` }); fetchLeads(); }
    e.target.value = '';
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>Lead Pipeline</h1>
          <p className="text-muted-foreground">Distressed seller acquisition leads</p>
        </div>
        <div className="flex gap-2">
          <label>
            <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-2" />Upload CSV</span></Button>
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleCSVUpload} />
          </label>
          <Button variant="outline" onClick={() => {
            const ws = XLSX.utils.json_to_sheet(filtered);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Leads');
            XLSX.writeFile(wb, 'real_estate_leads.xlsx');
          }}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(t => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}
            style={tab === t ? { backgroundColor: '#3B6D11' } : undefined}>
            {t === 'all' ? 'All' : t.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search address, name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {['FL','TX','GA','OH','NC','TN','AZ','IN','MO','MI','PA'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="A">A Deals</SelectItem>
            <SelectItem value="B">B Deals</SelectItem>
            <SelectItem value="C">C Deals</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Leads ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-center py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Property Address</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ARV</TableHead>
                  <TableHead>MAO</TableHead>
                  <TableHead>Asking</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell><Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} /></TableCell>
                    <TableCell className="font-medium">{l.first_name} {l.last_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.property_address}</TableCell>
                    <TableCell>{l.state}</TableCell>
                    <TableCell>${(l.arv || 0).toLocaleString()}</TableCell>
                    <TableCell>${(l.mao || 0).toLocaleString()}</TableCell>
                    <TableCell>${(l.asking_price || 0).toLocaleString()}</TableCell>
                    <TableCell>{scoreBadge(l.deal_score)}</TableCell>
                    <TableCell><Badge variant="outline">{l.status?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell>{l.call_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
