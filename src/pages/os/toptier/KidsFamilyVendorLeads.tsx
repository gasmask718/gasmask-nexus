import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Globe, MapPin, Phone } from 'lucide-react';

export default function KidsFamilyVendorLeads() {
  const [search, setSearch] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['kf-vendor-leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kf_vendor_leads').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = leads.filter((l: any) =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.city?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400',
    contacted: 'bg-amber-500/20 text-amber-400',
    onboarded: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nationwide Expansion — Vendor Leads</h1>
        <p className="text-sm text-white/50">Discovery leads from Google Places & Yelp for vendor acquisition</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length, color: 'text-[#C9A84C]' },
          { label: 'New', value: leads.filter((l: any) => l.status === 'new').length, color: 'text-blue-400' },
          { label: 'Contacted', value: leads.filter((l: any) => l.outreach_status === 'contacted').length, color: 'text-amber-400' },
          { label: 'Onboarded', value: leads.filter((l: any) => l.status === 'onboarded').length, color: 'text-emerald-400' },
        ].map(s => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <p className="text-xs text-white/40">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/30" />
        <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white/5 border-white/10 text-white" />
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50">Vendor</TableHead>
                <TableHead className="text-white/50">Category</TableHead>
                <TableHead className="text-white/50">Location</TableHead>
                <TableHead className="text-white/50">Rating</TableHead>
                <TableHead className="text-white/50">Source</TableHead>
                <TableHead className="text-white/50">Status</TableHead>
                <TableHead className="text-white/50">Outreach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-white/30 py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-white/30 py-8">No leads found</TableCell></TableRow>
              ) : filtered.map((l: any) => (
                <TableRow key={l.id} className="border-white/5 hover:bg-white/5">
                  <TableCell className="text-white font-medium">{l.name}</TableCell>
                  <TableCell className="text-white/60">{l.category || '—'}</TableCell>
                  <TableCell className="text-white/60">{l.city}, {l.state}</TableCell>
                  <TableCell className="text-amber-400">{l.rating ? `${l.rating} ⭐` : '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="border-white/10 text-white/50">{l.source}</Badge></TableCell>
                  <TableCell><Badge className={statusColors[l.status] || 'bg-gray-500/20 text-gray-400'}>{l.status}</Badge></TableCell>
                  <TableCell><Badge className={statusColors[l.outreach_status] || 'bg-gray-500/20 text-gray-400'}>{l.outreach_status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
