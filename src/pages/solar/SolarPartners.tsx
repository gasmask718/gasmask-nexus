import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Handshake, Plus, MapPin, TrendingUp, Star, Clock, Globe, Phone } from 'lucide-react';

const AMBER = '#E8A317';

export default function SolarPartners() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['solar-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_partners')
        .select('*')
        .order('ranking_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addPartner = useMutation({
    mutationFn: async (partner: any) => {
      const { error } = await supabase.from('solar_partners').insert(partner);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-partners'] });
      toast.success('Partner added');
      setShowAdd(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="h-6 w-6" style={{ color: AMBER }} />
            Floor 7 — Partner Network
          </h1>
          <p className="text-sm text-muted-foreground">Solar installer partners ranked by performance for deal routing</p>
        </div>
        <Button style={{ backgroundColor: AMBER }} onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Partner
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Partners', value: partners.length, icon: Handshake, color: 'text-blue-400' },
          { label: 'Active', value: partners.filter((p: any) => p.status === 'active').length, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Avg Close Rate', value: partners.length ? `${(partners.reduce((s: number, p: any) => s + (Number(p.avg_close_rate) || 0), 0) / partners.length).toFixed(0)}%` : '0%', icon: Star, color: 'text-amber-400' },
          { label: 'States Covered', value: new Set(partners.flatMap((p: any) => p.states_served || [])).size, icon: Globe, color: 'text-purple-400' },
        ].map((m) => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Partners Table */}
      <Card>
        <CardContent className="p-0">
          {partners.length === 0 ? (
            <div className="py-16 text-center">
              <Handshake className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-semibold mb-2">No partners yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Add solar installer partners to start routing qualified deals</p>
              <Button style={{ backgroundColor: AMBER }} onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add First Partner
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>States</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Close Rate</TableHead>
                  <TableHead>Avg Deal</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p: any, i: number) => (
                  <TableRow key={p.id} className={i === 0 ? 'border-l-2' : ''} style={i === 0 ? { borderLeftColor: '#FFD700' } : undefined}>
                    <TableCell>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: i < 3 ? `${AMBER}30` : undefined, color: i < 3 ? AMBER : undefined }}>
                        #{i + 1}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{p.company_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{p.contact_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{p.contact_phone || p.contact_email || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(p.states_served || []).slice(0, 3).map((s: string) => (
                          <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                        ))}
                        {(p.states_served || []).length > 3 && (
                          <Badge variant="outline" className="text-[10px]">+{p.states_served.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium" style={{ color: AMBER }}>{p.commission_percentage}%</TableCell>
                    <TableCell>{p.avg_close_rate}%</TableCell>
                    <TableCell>${Number(p.avg_deal_size || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{p.response_time_hours}h</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.status === 'active' ? 'text-green-400 border-green-400' : 'text-red-400 border-red-400'}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Partner Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Solar Installer Partner</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            addPartner.mutate({
              company_name: fd.get('company_name'),
              contact_name: fd.get('contact_name'),
              contact_email: fd.get('contact_email'),
              contact_phone: fd.get('contact_phone'),
              states_served: (fd.get('states') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
              commission_percentage: Number(fd.get('commission')) || 10,
              avg_close_rate: Number(fd.get('close_rate')) || 0,
              avg_deal_size: Number(fd.get('deal_size')) || 0,
              response_time_hours: Number(fd.get('response_time')) || 24,
            });
          }} className="space-y-4">
            <div><Label>Company Name *</Label><Input name="company_name" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Name</Label><Input name="contact_name" /></div>
              <div><Label>Contact Phone</Label><Input name="contact_phone" /></div>
            </div>
            <div><Label>Contact Email</Label><Input name="contact_email" type="email" /></div>
            <div><Label>States Served (comma-separated)</Label><Input name="states" placeholder="FL, TX, GA, NC" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Commission %</Label><Input name="commission" type="number" defaultValue="10" /></div>
              <div><Label>Avg Close Rate %</Label><Input name="close_rate" type="number" defaultValue="20" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Avg Deal Size ($)</Label><Input name="deal_size" type="number" defaultValue="5000" /></div>
              <div><Label>Response Time (hrs)</Label><Input name="response_time" type="number" defaultValue="24" /></div>
            </div>
            <Button type="submit" className="w-full" style={{ backgroundColor: AMBER }} disabled={addPartner.isPending}>
              {addPartner.isPending ? 'Saving...' : 'Add Partner'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
