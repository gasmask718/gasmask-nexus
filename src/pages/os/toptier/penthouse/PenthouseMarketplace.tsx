import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ShoppingBag, Car, Plane, Sparkles, ToggleLeft, ToggleRight, Edit, Trash2 } from 'lucide-react';

export default function PenthouseMarketplace() {
  const queryClient = useQueryClient();

  const { data: experiences = [] } = useQuery({
    queryKey: ['ph-experiences'],
    queryFn: () => fetchTopTierData('tt_experiences', { select: '*', order: 'created_at.desc' }),
  });

  const { data: jets = [] } = useQuery({
    queryKey: ['ph-jets'],
    queryFn: () => fetchTopTierData('tt_private_jets', { select: '*', order: 'created_at.desc' }),
  });

  const { data: charters = [] } = useQuery({
    queryKey: ['ph-charters'],
    queryFn: () => fetchTopTierData('tt_charter_requests', { select: '*', order: 'created_at.desc' }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ table, id, currentStatus }: { table: string; id: string; currentStatus: string }) =>
      patchTopTierData(table, { id: `eq.${id}` }, { status: currentStatus === 'active' ? 'inactive' : 'active', updated_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      toast.success('Status toggled');
    },
  });

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400',
      available: 'bg-emerald-500/20 text-emerald-400',
      inactive: 'bg-white/10 text-white/40',
      pending: 'bg-amber-500/20 text-amber-400',
      approved: 'bg-emerald-500/20 text-emerald-400',
      rejected: 'bg-red-500/20 text-red-400',
    };
    return <Badge className={`text-[10px] ${colors[s] || 'bg-white/10 text-white/40'}`}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Marketplace Control</h1>
        <p className="text-white/40 text-sm mt-1">Manage all listings, vehicles, and services</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Experiences</p>
              <p className="text-2xl font-bold text-[#C9A84C] mt-1">{experiences.length}</p>
            </div>
            <Sparkles className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Private Jets</p>
              <p className="text-2xl font-bold text-[#C9A84C] mt-1">{jets.length}</p>
            </div>
            <Plane className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Charter Requests</p>
              <p className="text-2xl font-bold text-[#C9A84C] mt-1">{charters.length}</p>
            </div>
            <Car className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="experiences" className="space-y-4">
        <TabsList className="bg-[#111] border border-white/5">
          <TabsTrigger value="experiences" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Experiences</TabsTrigger>
          <TabsTrigger value="jets" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Private Jets</TabsTrigger>
          <TabsTrigger value="charters" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Charter Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="experiences">
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Title</TableHead>
                    <TableHead className="text-white/40">Category</TableHead>
                    <TableHead className="text-white/40">Price</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Partner</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experiences.map((e: any) => (
                    <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm">{e.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{e.category}</Badge></TableCell>
                      <TableCell className="text-[#C9A84C] text-sm">{e.price ? `$${Number(e.price).toLocaleString()}` : 'Free'}</TableCell>
                      <TableCell>{statusBadge(e.status || 'active')}</TableCell>
                      <TableCell className="text-white/50 text-sm">{e.partner_name || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-white/40" onClick={() => toggleStatus.mutate({ table: 'tt_experiences', id: e.id, currentStatus: e.status || 'active' })}>
                            {e.status === 'active' ? <ToggleRight className="h-3 w-3 text-emerald-400" /> : <ToggleLeft className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {experiences.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8">No experiences found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jets">
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Aircraft</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jets.map((j: any) => (
                    <TableRow key={j.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm">{j.aircraft_type || j.id}</TableCell>
                      <TableCell>{statusBadge(j.status || 'available')}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-white/40"><Edit className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jets.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-white/30 py-8">No jets found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charters">
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Customer</TableHead>
                    <TableHead className="text-white/40">Route</TableHead>
                    <TableHead className="text-white/40">Date</TableHead>
                    <TableHead className="text-white/40">Passengers</TableHead>
                    <TableHead className="text-white/40">Price</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charters.map((c: any) => (
                    <TableRow key={c.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm">{c.customer_name}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.departure_location} → {c.arrival_location}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.departure_date}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.passenger_count}</TableCell>
                      <TableCell className="text-[#C9A84C] text-sm">{c.final_price || c.quoted_price ? `$${Number(c.final_price || c.quoted_price).toLocaleString()}` : '—'}</TableCell>
                      <TableCell>{statusBadge(c.status || 'pending')}</TableCell>
                    </TableRow>
                  ))}
                  {charters.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8">No charter requests</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
