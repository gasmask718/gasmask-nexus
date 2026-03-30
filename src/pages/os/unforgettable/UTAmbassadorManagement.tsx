import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Clock, DollarSign, CheckCircle, XCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Ambassador {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  state: string | null;
  referral_code: string;
  status: string;
  tier: string | null;
  commission_rate: number | null;
  total_earnings: number | null;
  total_sales: number | null;
  created_at: string;
}

export default function UTAmbassadorManagement() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchAmbassadors = async () => {
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAmbassadors(data as Ambassador[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAmbassadors();

    const channel = supabase
      .channel('ambassadors-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambassadors' }, () => {
        fetchAmbassadors();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const pendingCount = ambassadors.filter(a => a.status === 'pending').length;
  const activeCount = ambassadors.filter(a => a.status === 'active').length;
  const totalPaid = ambassadors.reduce((sum, a) => sum + (a.total_earnings || 0), 0);

  const handleApprove = async (ambassador: Ambassador) => {
    setApproving(ambassador.id);
    try {
      const { error } = await supabase
        .from('ambassadors')
        .update({ status: 'active' })
        .eq('id', ambassador.id);

      if (error) throw error;

      // Send approval SMS via edge function
      try {
        await supabase.functions.invoke('ambassador-approve-sms', {
          body: {
            phone: ambassador.phone,
            name: ambassador.full_name,
            referral_code: ambassador.referral_code,
          },
        });
      } catch (smsErr) {
        console.warn('SMS send failed, ambassador still approved:', smsErr);
      }

      toast.success(`${ambassador.full_name} approved!`);
      fetchAmbassadors();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setApproving(null);
    }
  };

  const handleSuspend = async (ambassador: Ambassador) => {
    const { error } = await supabase
      .from('ambassadors')
      .update({ status: 'suspended' })
      .eq('id', ambassador.id);
    if (error) { toast.error('Failed to suspend'); return; }
    toast.success(`${ambassador.full_name} suspended`);
    fetchAmbassadors();
  };

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (s === 'pending') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E91E8C' }}>Ambassador Management</h1>
        <p className="text-muted-foreground text-sm">Approve, manage, and track all ambassadors</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Pending Approval</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-amber-400">{pendingCount}</p></CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Active Ambassadors</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-400">{activeCount}</p></CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total Commissions</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-primary">${totalPaid.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">All Ambassadors</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : ambassadors.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No ambassadors yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ambassadors.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.full_name}</TableCell>
                      <TableCell className="text-xs">{a.email}</TableCell>
                      <TableCell>{a.state || '—'}</TableCell>
                      <TableCell className="text-xs">{a.phone || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.tier || 'starter'}</Badge></TableCell>
                      <TableCell>{a.commission_rate || 15}%</TableCell>
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
