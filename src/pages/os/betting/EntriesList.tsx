import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ClipboardList, Plus, Lock, CheckCircle2, XCircle, MinusCircle, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStateCompliance, FORMAT_LABELS, STATE_LABELS, SupportedState, FormatTag } from '@/hooks/useStateCompliance';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function EntriesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentState, platforms } = useStateCompliance();

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    state: '' as SupportedState | '',
    platform: '',
    sport: '',
    status: '' as 'open' | 'settled' | '',
  });

  const [settleModal, setSettleModal] = useState<{
    open: boolean;
    entry: any;
    result: 'W' | 'L' | 'Push' | '';
    profitLoss: string;
  }>({
    open: false,
    entry: null,
    result: '',
    profitLoss: '',
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ['pick-entries', filters],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('pick_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('date', filters.dateTo);
      if (filters.state) query = query.eq('state', filters.state);
      if (filters.platform) query = query.eq('platform', filters.platform);
      if (filters.sport) query = query.eq('sport', filters.sport);
      if (filters.status) query = query.eq('status', filters.status);

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!settleModal.entry || !settleModal.result) return;

      const { error } = await supabase
        .from('pick_entries')
        .update({
          status: 'settled',
          result: settleModal.result,
          profit_loss: parseFloat(settleModal.profitLoss) || 0,
        })
        .eq('id', settleModal.entry.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Entry Settled', description: 'The entry has been locked.' });
      queryClient.invalidateQueries({ queryKey: ['pick-entries'] });
      setSettleModal({ open: false, entry: null, result: '', profitLoss: '' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to settle entry.', variant: 'destructive' });
    },
  });

  const openSettleModal = (entry: any) => {
    // Auto-calculate profit/loss based on result
    let defaultPL = '0';
    if (entry.odds) {
      // American odds calculation
      const odds = entry.odds;
      if (odds > 0) {
        defaultPL = ((entry.stake * odds) / 100).toFixed(2);
      } else {
        defaultPL = ((entry.stake * 100) / Math.abs(odds)).toFixed(2);
      }
    } else if (entry.multiplier) {
      defaultPL = ((entry.stake * entry.multiplier) - entry.stake).toFixed(2);
    }
    
    setSettleModal({
      open: true,
      entry,
      result: '',
      profitLoss: defaultPL,
    });
  };

  const getResultIcon = (result: string | null) => {
    switch (result) {
      case 'W': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'L': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'Push': return <MinusCircle className="h-4 w-4 text-amber-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Entries</h1>
            <p className="text-muted-foreground">Track and settle your pick entries</p>
          </div>
        </div>
        <Link to="/os/sports-betting/entries/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New Entry
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={filters.state} onValueChange={(v) => setFilters(prev => ({ ...prev, state: v as SupportedState }))}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="GA">Georgia</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={filters.platform} onValueChange={(v) => setFilters(prev => ({ ...prev, platform: v }))}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {platforms?.map(p => (
                    <SelectItem key={p.platform_key} value={p.platform_key}>{p.platform_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select value={filters.sport} onValueChange={(v) => setFilters(prev => ({ ...prev, sport: v }))}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="NBA">NBA</SelectItem>
                  <SelectItem value="NFL">NFL</SelectItem>
                  <SelectItem value="MLB">MLB</SelectItem>
                  <SelectItem value="NHL">NHL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v as 'open' | 'settled' }))}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : entries?.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No entries found. Create your first entry.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Player/Team</TableHead>
                  <TableHead className="text-right">Stake</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(new Date(entry.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.state}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{entry.platform}</TableCell>
                    <TableCell>
                      <span className="font-medium">{entry.market}</span>
                      {entry.line_value && <span className="text-muted-foreground ml-1">{entry.line_value}</span>}
                      {entry.side && <span className="text-muted-foreground ml-1 capitalize">({entry.side})</span>}
                    </TableCell>
                    <TableCell>{entry.player || entry.team || '-'}</TableCell>
                    <TableCell className="text-right font-mono">${entry.stake}</TableCell>
                    <TableCell className={`text-right font-mono ${entry.profit_loss > 0 ? 'text-green-600' : entry.profit_loss < 0 ? 'text-red-600' : ''}`}>
                      {entry.profit_loss > 0 ? '+' : ''}{entry.profit_loss !== 0 ? `$${entry.profit_loss}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.status === 'settled' ? (
                          <>
                            {getResultIcon(entry.result)}
                            <Badge variant="secondary">
                              <Lock className="h-3 w-3 mr-1" />
                              Locked
                            </Badge>
                          </>
                        ) : (
                          <Badge>Open</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.status === 'open' && (
                        <Button size="sm" variant="outline" onClick={() => openSettleModal(entry)}>
                          Settle
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settle Modal */}
      <Dialog open={settleModal.open} onOpenChange={(open) => !open && setSettleModal(prev => ({ ...prev, open: false }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Entry</DialogTitle>
            <DialogDescription>
              Mark this entry as settled. This action will lock the entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Result</Label>
              <div className="flex gap-2">
                {(['W', 'L', 'Push'] as const).map((r) => (
                  <Button
                    key={r}
                    variant={settleModal.result === r ? 'default' : 'outline'}
                    onClick={() => {
                      let pl = settleModal.profitLoss;
                      if (r === 'L') pl = `-${Math.abs(settleModal.entry?.stake || 0)}`;
                      else if (r === 'Push') pl = '0';
                      setSettleModal(prev => ({ ...prev, result: r, profitLoss: pl }));
                    }}
                    className={`flex-1 ${r === 'W' ? 'border-green-500' : r === 'L' ? 'border-red-500' : 'border-amber-500'}`}
                  >
                    {r === 'W' && <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />}
                    {r === 'L' && <XCircle className="h-4 w-4 mr-1 text-red-500" />}
                    {r === 'Push' && <MinusCircle className="h-4 w-4 mr-1 text-amber-500" />}
                    {r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Push'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Profit/Loss</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  className="pl-7"
                  value={settleModal.profitLoss}
                  onChange={(e) => setSettleModal(prev => ({ ...prev, profitLoss: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Negative for losses. This field will be locked after settlement.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleModal(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button 
              onClick={() => settleMutation.mutate()} 
              disabled={!settleModal.result || settleMutation.isPending}
            >
              {settleMutation.isPending ? 'Settling...' : 'Settle & Lock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
