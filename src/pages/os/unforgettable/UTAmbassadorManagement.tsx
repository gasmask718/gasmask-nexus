import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Clock, DollarSign, CheckCircle, XCircle, Search } from 'lucide-react';
import { format } from 'date-fns';

const PINK = '#E91E8C';

// HARD ISOLATION: This page ONLY reads from unforgettable_ambassadors.
// Never reference 'ambassadors' or 'gasmask_ambassadors'.
const TABLE = 'unforgettable_ambassadors' as const;

export default function UTAmbassadorManagement() {
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  const fetchAmbassadors = async () => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAmbassadors(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAmbassadors();
    const channel = supabase
      .channel('ut-ambassadors-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
        fetchAmbassadors();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = ambassadors.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (tierFilter !== 'all' && a.tier !== tierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.full_name || '').toLowerCase().includes(q)
        || (a.email || '').toLowerCase().includes(q)
        || (a.state || '').toLowerCase().includes(q);
    }
    return true;
  });

  const pendingCount = ambassadors.filter(a => a.status === 'pending').length;
  const activeCount = ambassadors.filter(a => a.status === 'active').length;
  const totalPaid = ambassadors.reduce((sum, a) => sum + (a.total_earnings || 0), 0);

  const handleApprove = async (amb: any) => {
    setApproving(amb.id);
    try {
      const { error } = await supabase
        .from(TABLE)
        .update({ status: 'active', approved_at: new Date().toISOString() })
        .eq('id', amb.id);
      if (error) throw error;

      // Send UT-specific approval SMS
      try {
        await supabase.functions.invoke('ambassador-approve-sms', {
          body: {
            phone: amb.phone,
            name: amb.full_name,
            referral_code: amb.referral_code,
            brand: 'unforgettable_times',
          },
        });
      } catch (smsErr) {
        console.warn('SMS send failed, ambassador still approved:', smsErr);
      }

      toast.success(`${amb.full_name} approved!`);
      fetchAmbassadors();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setApproving(null);
    }
  };

  const handleSuspend = async (amb: any) => {
    const { error } = await supabase
      .from(TABLE)
      .update({ status: 'suspended' })
      .eq('id', amb.id);
    if (error) { toast.error('Failed to suspend'); return; }
    toast.success(`${amb.full_name} suspended`);
    fetchAmbassadors();
  };

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (s === 'suspended') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: PINK }}>
          Unforgettable Times — Ambassador Requests
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage onboarding for event promoters, vendors, and referral partners
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" /> Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-amber-400">{pendingCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-green-400" /> Active Ambassadors
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-400">{activeCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total Commissions
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">${totalPaid.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, state..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="rising">Rising Star</SelectItem>
            <SelectItem value="elite">Elite</SelectItem>
            <SelectItem value="legend">Legend</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">All UT Ambassadors</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No ambassadors found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Referral Code</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.full_name}</TableCell>
                      <TableCell className="text-xs">{a.email || '—'}</TableCell>
                      <TableCell className="text-xs">{a.phone || '—'}</TableCell>
                      <TableCell>{a.state || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{a.referral_code}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{a.tier}</Badge></TableCell>
                      <TableCell>{a.commission_rate}%</TableCell>
                      <TableCell><Badge className={statusColor(a.status)}>{a.status}</Badge></TableCell>
                      <TableCell>${(a.total_earnings || 0).toLocaleString()}</TableCell>
                      <TableCell>{a.total_sales || 0}</TableCell>
                      <TableCell className="text-xs">{format(new Date(a.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {a.status === 'pending' && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(a)} disabled={approving === a.id}>
                              <CheckCircle className="h-3 w-3 mr-1" />{approving === a.id ? '...' : 'Approve'}
                            </Button>
                          )}
                          {a.status === 'active' && (
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleSuspend(a)}>
                              <XCircle className="h-3 w-3 mr-1" />Suspend
                            </Button>
                          )}
                          {a.status === 'suspended' && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(a)} disabled={approving === a.id}>
                              <CheckCircle className="h-3 w-3 mr-1" />Reactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
