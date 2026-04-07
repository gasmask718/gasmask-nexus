import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, CheckCircle, XCircle, Star, Users, Store, Music } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Party Vendor', 'Entertainer', 'Rental Company', 'Venue', 'Photographer', 'Caterer'];

export default function KidsFamilyVendors() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['kf-vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kf_vendors')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('kf_vendors').update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kf-vendors'] });
      toast.success('Vendor status updated');
    },
  });

  const filtered = vendors.filter((v: any) => {
    const matchSearch = !search || v.name?.toLowerCase().includes(search.toLowerCase()) || v.city?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || v.category === filterCategory;
    return matchSearch && matchCat;
  });

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
    suspended: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendor Management</h1>
          <p className="text-sm text-white/50">Manage party vendors, entertainers, rental companies & venues</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Vendors', value: vendors.length, icon: Users, color: 'text-[#C9A84C]' },
          { label: 'Approved', value: vendors.filter((v: any) => v.status === 'approved').length, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Pending', value: vendors.filter((v: any) => v.status === 'pending').length, icon: Store, color: 'text-amber-400' },
          { label: 'Avg Trust Score', value: vendors.length ? (vendors.reduce((a: number, v: any) => a + (v.trust_score || 0), 0) / vendors.length).toFixed(1) : '0', icon: Star, color: 'text-purple-400' },
        ].map(s => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xs text-white/40">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/30" />
          <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white/5 border-white/10 text-white" />
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={filterCategory === 'all' ? 'default' : 'outline'} onClick={() => setFilterCategory('all')} className={filterCategory === 'all' ? 'bg-[#C9A84C] text-black' : 'border-white/10 text-white/60'}>All</Button>
          {CATEGORIES.map(c => (
            <Button key={c} size="sm" variant={filterCategory === c ? 'default' : 'outline'} onClick={() => setFilterCategory(c)} className={filterCategory === c ? 'bg-[#C9A84C] text-black' : 'border-white/10 text-white/60'}>{c}</Button>
          ))}
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50">Vendor</TableHead>
                <TableHead className="text-white/50">Category</TableHead>
                <TableHead className="text-white/50">Location</TableHead>
                <TableHead className="text-white/50">Rate</TableHead>
                <TableHead className="text-white/50">Trust</TableHead>
                <TableHead className="text-white/50">Status</TableHead>
                <TableHead className="text-white/50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-white/30 py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-white/30 py-8">No vendors found</TableCell></TableRow>
              ) : filtered.map((v: any) => (
                <TableRow key={v.id} className="border-white/5 hover:bg-white/5">
                  <TableCell className="text-white font-medium">{v.name}</TableCell>
                  <TableCell className="text-white/60">{v.category}</TableCell>
                  <TableCell className="text-white/60">{v.city}, {v.state}</TableCell>
                  <TableCell className="text-white/60">${v.base_rate?.toFixed(2) || '—'}</TableCell>
                  <TableCell className="text-[#C9A84C]">{v.trust_score?.toFixed(1) || '0'}</TableCell>
                  <TableCell><Badge className={statusColor[v.status] || 'bg-gray-500/20 text-gray-400'}>{v.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {v.status === 'pending' && (
                        <>
                          <Button size="sm" variant="ghost" className="text-emerald-400 h-7" onClick={() => updateStatus.mutate({ id: v.id, status: 'approved' })}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-400 h-7" onClick={() => updateStatus.mutate({ id: v.id, status: 'rejected' })}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {v.status === 'approved' && (
                        <Button size="sm" variant="ghost" className="text-red-400 h-7" onClick={() => updateStatus.mutate({ id: v.id, status: 'suspended' })}>Suspend</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
