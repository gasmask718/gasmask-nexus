import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, CheckCircle, XCircle, Star as StarIcon, Eye } from 'lucide-react';
import { toast } from 'sonner';

const sendApprovalSms = async (phone: string, message: string) => {
  try {
    await supabase.functions.invoke('send-approval-sms', {
      body: { to: phone, message }
    });
  } catch (err) {
    console.error('SMS notification failed (non-blocking):', err);
  }
};

export default function UTStaffManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');

  const { data: staff = [] } = useQuery({
    queryKey: ['admin-staff-ut'],
    queryFn: async () => {
      const { data } = await supabase.from('staff_members_ut').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const updateStaff = useMutation({
    mutationFn: async ({ id, updates, contactPhone }: { id: string; updates: Record<string, any>; contactPhone?: string }) => {
      await supabase.from('staff_members_ut').update(updates).eq('id', id);
      // Send SMS on approval (non-blocking)
      if (updates.status === 'verified' && contactPhone) {
        sendApprovalSms(
          contactPhone,
          '🎉 Congratulations! Your staff profile has been approved on Unforgettable Times. Log in to complete your profile and start receiving bookings!'
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-ut'] });
      toast.success('Staff member updated');
    }
  });

  const filtered = staff.filter((s: any) => {
    const matchSearch = !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchState = stateFilter === 'all' || s.state === stateFilter;
    return matchSearch && matchStatus && matchState;
  });

  const states = [...new Set(staff.map((s: any) => s.state).filter(Boolean))].sort();
  const pendingCount = staff.filter((s: any) => s.status === 'pending').length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-pink-400" /> Staff Management</h1>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-amber-500 text-amber-400">{pendingCount} Pending</Badge>
          <Button size="sm" onClick={() => {
            staff.filter((s: any) => s.status === 'pending').forEach((s: any) => updateStaff.mutate({ id: s.id, updates: { status: 'verified' }, contactPhone: s.contact_phone }));
          }}>Approve All Pending</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="featured">Featured</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
        <Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All States</SelectItem>{states.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>City</TableHead>
                <TableHead>State</TableHead><TableHead>Status</TableHead><TableHead>Rating</TableHead>
                <TableHead>Views</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.role_category || '—'}</TableCell>
                  <TableCell>{s.city || '—'}</TableCell>
                  <TableCell>{s.state || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      s.status === 'verified' ? 'border-emerald-500 text-emerald-400' :
                      s.status === 'featured' ? 'border-pink-500 text-pink-400' :
                      s.status === 'suspended' ? 'border-red-500 text-red-400' :
                      'border-amber-500 text-amber-400'
                    }>{s.status}</Badge>
                  </TableCell>
                  <TableCell><span className="flex items-center gap-1"><StarIcon className="h-3 w-3 text-amber-400" />{Number(s.rating_avg || 0).toFixed(1)}</span></TableCell>
                  <TableCell><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{s.views_count}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {s.status !== 'verified' && <Button size="sm" variant="outline" className="text-emerald-400" onClick={() => updateStaff.mutate({ id: s.id, updates: { status: 'verified' }, contactPhone: s.contact_phone })}><CheckCircle className="h-3 w-3" /></Button>}
                      {s.status !== 'featured' && <Button size="sm" variant="outline" className="text-pink-400" onClick={() => updateStaff.mutate({ id: s.id, updates: { status: 'featured', is_featured: true } })}><StarIcon className="h-3 w-3" /></Button>}
                      {s.status !== 'suspended' && <Button size="sm" variant="outline" className="text-red-400" onClick={() => updateStaff.mutate({ id: s.id, updates: { status: 'suspended' } })}><XCircle className="h-3 w-3" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No staff found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
