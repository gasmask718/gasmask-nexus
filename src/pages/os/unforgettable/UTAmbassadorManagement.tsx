import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function UTAmbassadorManagement() {
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchAmbassadors = async () => {
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (!error && data) setAmbassadors(data);
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

  const pendingCount = ambassadors.filter(a => !a.is_active).length;
  const activeCount = ambassadors.filter(a => a.is_active).length;
  const totalPaid = ambassadors.reduce((sum, a) => sum + (a.total_earnings || 0), 0);

  const handleApprove = async (ambassador: any) => {
    setApproving(ambassador.id);
    try {
      const { error } = await supabase
        .from('ambassadors')
        .update({ is_active: true })
        .eq('id', ambassador.id);
      if (error) throw error;

      // Send approval SMS
      try {
        await supabase.functions.invoke('ambassador-approve-sms', {
          body: {
            phone: ambassador.phone_primary,
            name: ambassador.name,
            referral_code: ambassador.referral_code || ambassador.tracking_code,
          },
        });
      } catch (smsErr) {
        console.warn('SMS failed, ambassador still approved:', smsErr);
      }

      toast.success(`${ambassador.name || 'Ambassador'} approved!`);
      fetchAmbassadors();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setApproving(null);
    }
  };

  const handleSuspend = async (ambassador: any) => {
    const { error } = await supabase
      .from('ambassadors')
      .update({ is_active: false })
      .eq('id', ambassador.id);
    if (error) { toast.error('Failed to suspend'); return; }
    toast.success(`${ambassador.name || 'Ambassador'} suspended`);
    fetchAmbassadors();
  };

  const statusLabel = (a: any) => a.is_active ? 'active' : 'pending';
  const statusColor = (a: any) => {
    if (a.is_active) return 'bg-green-500/20 text-green-400 border-green-500/30';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E91E8C' }}>Ambassador Management</h1>
        <p className="text-sm text-muted-foreground">Approve, manage, and track all ambassadors</p>
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
          <CardContent><p className="text-3xl font-bold text-primary">${totalPaid.toLocaleString()}</p></CardContent>
        </Card>
      </div>

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
                    <TableHead>Phone</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Ref Code</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ambassadors.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name || '—'}</TableCell>
                      <TableCell className="text-xs">{a.phone_primary || '—'}</TableCell>
                      <TableCell>{a.state || '—'}</TableCell>
                      <TableCell>{a.city || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.tier}</Badge></TableCell>
                      <TableCell><Badge className={statusColor(a)}>{statusLabel(a)}</Badge></TableCell>
                      <TableCell>${(a.total_earnings || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-mono">{a.referral_code || a.tracking_code}</TableCell>
                      <TableCell className="text-xs">{format(new Date(a.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!a.is_active && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(a)} disabled={approving === a.id}>
                              <CheckCircle className="h-3 w-3 mr-1" />{approving === a.id ? '...' : 'Approve'}
                            </Button>
                          )}
                          {a.is_active && (
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
