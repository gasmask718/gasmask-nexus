import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCw, Plus, Eye } from 'lucide-react';

export default function KidsFamilyExperiences() {
  const [search, setSearch] = useState('');

  const { data: experiences = [], isLoading, refetch } = useQuery({
    queryKey: ['kf-experiences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experiences_master')
        .select('*')
        .or('category.ilike.%kids%,category.ilike.%family%,category.ilike.%party%,tags.cs.{kids,family}')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = experiences.filter((e: any) =>
    !search || e.title?.toLowerCase().includes(search.toLowerCase()) || e.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kids & Family Experiences</h1>
          <p className="text-sm text-white/50">Control panel for all kids & family inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-white/10 text-white/70">
            <RefreshCw className="h-4 w-4 mr-1" /> Sync
          </Button>
          <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80">
            <Plus className="h-4 w-4 mr-1" /> Add Experience
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Experiences', value: experiences.length, color: 'text-[#C9A84C]' },
          { label: 'API Sourced', value: experiences.filter((e: any) => e.supplier_type === 'viator').length, color: 'text-blue-400' },
          { label: 'Internal', value: experiences.filter((e: any) => e.supplier_type === 'internal').length, color: 'text-emerald-400' },
          { label: 'Active', value: experiences.filter((e: any) => e.is_active).length, color: 'text-purple-400' },
        ].map(stat => (
          <Card key={stat.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <p className="text-xs text-white/40">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/30" />
        <Input
          placeholder="Search experiences..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white"
        />
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50">Title</TableHead>
                <TableHead className="text-white/50">Source</TableHead>
                <TableHead className="text-white/50">City</TableHead>
                <TableHead className="text-white/50">Price</TableHead>
                <TableHead className="text-white/50">Display Price</TableHead>
                <TableHead className="text-white/50">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8">No experiences found</TableCell></TableRow>
              ) : filtered.map((exp: any) => (
                <TableRow key={exp.id} className="border-white/5 hover:bg-white/5">
                  <TableCell className="text-white font-medium">{exp.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={exp.supplier_type === 'viator' ? 'border-blue-500/30 text-blue-400' : 'border-emerald-500/30 text-emerald-400'}>
                      {exp.supplier_type || 'internal'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/60">{exp.city || '—'}</TableCell>
                  <TableCell className="text-white/60">${exp.price?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="text-[#C9A84C] font-medium">${exp.display_price?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>
                    <Badge className={exp.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {exp.is_active ? 'Active' : 'Inactive'}
                    </Badge>
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
