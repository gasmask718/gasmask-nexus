import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, Plus, Phone, Search, Send, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'skip_trace_pending', label: 'Skip Trace' },
  { value: 'queued', label: 'Queued' },
  { value: 'interested', label: 'Interested' },
  { value: 'agreement_signed', label: 'Agreement' },
];

const statusColor = (s: string) => {
  const map: Record<string, string> = {
    new: 'bg-gray-500/10 text-gray-400 border-gray-500',
    skip_trace_pending: 'bg-blue-500/10 text-blue-500 border-blue-500',
    phone_found: 'bg-blue-400/10 text-blue-400 border-blue-400',
    queued: 'bg-purple-500/10 text-purple-500 border-purple-500',
    called: 'bg-purple-400/10 text-purple-400 border-purple-400',
    interested: 'bg-teal-500/10 text-teal-500 border-teal-500',
    consultation_booked: 'bg-amber-500/10 text-amber-500 border-amber-500',
    agreement_signed: 'bg-amber-600/10 text-amber-600 border-amber-600',
    referred_to_attorney: 'bg-orange-500/10 text-orange-500 border-orange-500',
    case_filed: 'bg-orange-600/10 text-orange-600 border-orange-600',
    funds_released: 'bg-green-500/10 text-green-500 border-green-500',
    closed: 'bg-green-600/10 text-green-600 border-green-600',
    do_not_contact: 'bg-red-500/10 text-red-500 border-red-500',
  };
  return map[s] ?? 'bg-muted text-muted-foreground';
};

export default function SFLeadPipeline() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailLead, setDetailLead] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['sf-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('surplus_funds_leads')
        .select('*')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const addLead = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('surplus_funds_leads').insert(lead);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sf-leads'] }); toast.success('Lead added'); setAddOpen(false); },
  });

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const mapped = rows.map(r => ({
      first_name: r.first_name || r.FirstName || r['First Name'] || '',
      last_name: r.last_name || r.LastName || r['Last Name'] || '',
      county: r.county || r.County || 'Unknown',
      state: r.state || r.State || '',
      phone: r.phone || r.Phone || '',
      property_address: r.property_address || r.Address || r['Property Address'] || '',
      foreclosure_date: r.foreclosure_date || r['Foreclosure Date'] || null,
      sale_price: r.sale_price ? Number(r.sale_price) : null,
      amount_owed: r.amount_owed ? Number(r.amount_owed) : null,
      surplus_amount: r.surplus_amount ? Number(r.surplus_amount || r['Surplus Amount']) : null,
      court_case_number: r.court_case_number || r['Case Number'] || '',
      lead_source: 'csv_upload',
    }));
    const { error } = await supabase.from('surplus_funds_leads').insert(mapped);
    if (error) { toast.error('Upload failed: ' + error.message); } else {
      toast.success(`${mapped.length} leads imported`);
      queryClient.invalidateQueries({ queryKey: ['sf-leads'] });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const filtered = leads.filter((l: any) => {
    if (tab !== 'all' && l.status !== tab) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return `${l.first_name} ${l.last_name} ${l.county} ${l.state} ${l.court_case_number}`.toLowerCase().includes(s);
    }
    return true;
  });

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(prev => prev.length === filtered.length ? [] : filtered.map((l: any) => l.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-500">Lead Pipeline</h1>
          <p className="text-sm text-muted-foreground">{leads.length} total leads</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCSVUpload} />
          <Button onClick={() => fileRef.current?.click()} className="bg-amber-600 hover:bg-amber-700"><Upload className="h-4 w-4 mr-2" />Upload CSV</Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Add Lead</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Lead Manually</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addLead.mutate({ first_name: fd.get('first_name'), last_name: fd.get('last_name'), county: fd.get('county') || 'Unknown', state: fd.get('state'), phone: fd.get('phone'), surplus_amount: fd.get('surplus_amount') ? Number(fd.get('surplus_amount')) : null, court_case_number: fd.get('court_case_number'), property_address: fd.get('property_address') }); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name</Label><Input name="first_name" /></div>
                  <div><Label>Last Name</Label><Input name="last_name" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>County *</Label><Input name="county" required /></div>
                  <div><Label>State</Label><Input name="state" /></div>
                </div>
                <div><Label>Phone</Label><Input name="phone" /></div>
                <div><Label>Property Address</Label><Input name="property_address" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Surplus Amount</Label><Input name="surplus_amount" type="number" /></div>
                  <div><Label>Case Number</Label><Input name="court_case_number" /></div>
                </div>
                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">Add Lead</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm">{selectedIds.length} leads selected</span>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700"><Send className="h-4 w-4 mr-2" />Send to DC Campaign</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {STATUS_TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 text-left"><Checkbox checked={selectedIds.length === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">County</th>
                      <th className="p-3 text-left">State</th>
                      <th className="p-3 text-left">Surplus</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Last Called</th>
                      <th className="p-3 text-left">Calls</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead: any) => (
                      <tr key={lead.id} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="p-3"><Checkbox checked={selectedIds.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} /></td>
                        <td className="p-3 font-medium">{lead.first_name} {lead.last_name}</td>
                        <td className="p-3">{lead.county}</td>
                        <td className="p-3">{lead.state}</td>
                        <td className="p-3">{lead.surplus_amount ? `$${Number(lead.surplus_amount).toLocaleString()}` : '—'}</td>
                        <td className="p-3"><Badge variant="outline" className={statusColor(lead.status)}>{lead.status?.replace(/_/g, ' ')}</Badge></td>
                        <td className="p-3 text-muted-foreground">{lead.last_called_at ? new Date(lead.last_called_at).toLocaleDateString() : '—'}</td>
                        <td className="p-3">{lead.call_count}</td>
                        <td className="p-3">
                          <Button size="sm" variant="ghost" onClick={() => setDetailLead(lead)}><Eye className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No leads found</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <Sheet open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
        <SheetContent className="w-[450px] overflow-auto">
          <SheetHeader>
            <SheetTitle className="text-amber-500">{detailLead?.first_name} {detailLead?.last_name}</SheetTitle>
          </SheetHeader>
          {detailLead && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">County</span><p className="font-medium">{detailLead.county}</p></div>
                <div><span className="text-muted-foreground">State</span><p className="font-medium">{detailLead.state}</p></div>
                <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{detailLead.phone || '—'}</p></div>
                <div><span className="text-muted-foreground">Surplus</span><p className="font-medium text-amber-500">{detailLead.surplus_amount ? `$${Number(detailLead.surplus_amount).toLocaleString()}` : '—'}</p></div>
                <div><span className="text-muted-foreground">Property</span><p className="font-medium">{detailLead.property_address || '—'}</p></div>
                <div><span className="text-muted-foreground">Case #</span><p className="font-medium">{detailLead.court_case_number || '—'}</p></div>
                <div><span className="text-muted-foreground">Status</span><p><Badge variant="outline" className={statusColor(detailLead.status)}>{detailLead.status?.replace(/_/g, ' ')}</Badge></p></div>
                <div><span className="text-muted-foreground">Calls</span><p className="font-medium">{detailLead.call_count}</p></div>
              </div>
              {detailLead.notes && <div><span className="text-muted-foreground">Notes</span><p>{detailLead.notes}</p></div>}
              {detailLead.status === 'agreement_signed' && (
                <Button className="w-full bg-amber-600 hover:bg-amber-700">Create Case</Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
