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
import { ClipboardList, Plus, Lock, CheckCircle2, XCircle, MinusCircle, Filter, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStateCompliance, FORMAT_LABELS, STATE_LABELS, SupportedState, FormatTag } from '@/hooks/useStateCompliance';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Fantasy pick'em platforms
const FANTASY_PICKEM_PLATFORMS = ['prizepicks', 'underdog', 'betr'];

type SettleModalState = {
  open: boolean;
  entry: any;
  result: 'W' | 'L' | 'Push' | '';
  profitLoss: string;
  actualResultValue: string;
  computedResult: 'W' | 'L' | null;
};

type DetailModalState = {
  open: boolean;
  entry: any;
};

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

  const [settleModal, setSettleModal] = useState<SettleModalState>({
    open: false,
    entry: null,
    result: '',
    profitLoss: '',
    actualResultValue: '',
    computedResult: null,
  });

  const [detailModal, setDetailModal] = useState<DetailModalState>({
    open: false,
    entry: null,
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

  // Check if entry is fantasy pick'em
  const isFantasyPickem = (entry: any) => {
    return entry?.format_tag === 'fantasy_pickem' || 
           FANTASY_PICKEM_PLATFORMS.includes(entry?.platform?.toLowerCase());
  };

  // Compute result for fantasy pick'em based on MORE/LESS logic
  const computeFantasyResult = (selection: string, lineValue: number, actualValue: number): 'W' | 'L' => {
    if (selection === 'MORE') {
      return actualValue > lineValue ? 'W' : 'L';
    } else {
      // LESS
      return actualValue < lineValue ? 'W' : 'L';
    }
  };

  // Calculate profit/loss for fantasy pick'em
  const calculateFantasyPL = (result: 'W' | 'L', stake: number, multiplier: number | null): number => {
    if (result === 'W') {
      return multiplier ? (stake * multiplier) - stake : stake;
    }
    return -stake;
  };

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!settleModal.entry) return;

      const entry = settleModal.entry;
      const isPickem = isFantasyPickem(entry);

      let finalResult: 'W' | 'L' | 'Push';
      let profitLoss: number;
      let actualResultValue: number | null = null;

      if (isPickem) {
        // Fantasy pick'em: use computed result based on actual value
        if (!settleModal.actualResultValue) {
          throw new Error('Actual result value is required for fantasy pick\'em');
        }
        actualResultValue = parseFloat(settleModal.actualResultValue);
        if (isNaN(actualResultValue)) {
          throw new Error('Invalid actual result value');
        }
        if (!entry.line_value || !entry.side) {
          throw new Error('Line value and selection (MORE/LESS) are required');
        }
        
        finalResult = computeFantasyResult(entry.side, entry.line_value, actualResultValue);
        profitLoss = calculateFantasyPL(finalResult, entry.stake, entry.multiplier);
      } else {
        // Sportsbook: use manual result selection
        if (!settleModal.result) {
          throw new Error('Result is required');
        }
        finalResult = settleModal.result;
        profitLoss = parseFloat(settleModal.profitLoss) || 0;
      }

      const { error } = await supabase
        .from('pick_entries')
        .update({
          status: 'settled',
          result: finalResult,
          profit_loss: profitLoss,
          actual_result_value: actualResultValue,
        })
        .eq('id', entry.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Entry Settled', description: 'The entry has been locked.' });
      queryClient.invalidateQueries({ queryKey: ['pick-entries'] });
      setSettleModal({ open: false, entry: null, result: '', profitLoss: '', actualResultValue: '', computedResult: null });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openSettleModal = (entry: any) => {
    const isPickem = isFantasyPickem(entry);
    
    // Auto-calculate profit/loss based on result (for sportsbook)
    let defaultPL = '0';
    if (!isPickem) {
      if (entry.odds) {
        const odds = entry.odds;
        if (odds > 0) {
          defaultPL = ((entry.stake * odds) / 100).toFixed(2);
        } else {
          defaultPL = ((entry.stake * 100) / Math.abs(odds)).toFixed(2);
        }
      } else if (entry.multiplier) {
        defaultPL = ((entry.stake * entry.multiplier) - entry.stake).toFixed(2);
      }
    }
    
    setSettleModal({
      open: true,
      entry,
      result: '',
      profitLoss: defaultPL,
      actualResultValue: '',
      computedResult: null,
    });
  };

  // Handle actual result value change for fantasy pick'em
  const handleActualValueChange = (value: string) => {
    const entry = settleModal.entry;
    let computedResult: 'W' | 'L' | null = null;
    
    if (value && entry?.line_value && entry?.side) {
      const actualVal = parseFloat(value);
      if (!isNaN(actualVal)) {
        computedResult = computeFantasyResult(entry.side, entry.line_value, actualVal);
      }
    }

    // Calculate P/L
    let profitLoss = '0';
    if (computedResult && entry) {
      profitLoss = calculateFantasyPL(computedResult, entry.stake, entry.multiplier).toFixed(2);
    }

    setSettleModal(prev => ({ 
      ...prev, 
      actualResultValue: value, 
      computedResult,
      profitLoss,
    }));
  };

  const getResultIcon = (result: string | null) => {
    switch (result) {
      case 'W': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'L': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'Push': return <MinusCircle className="h-4 w-4 text-amber-500" />;
      default: return null;
    }
  };

  const getSelectionDisplay = (entry: any) => {
    if (entry.side === 'MORE') {
      return <span className="text-green-600 font-medium">▲ MORE</span>;
    }
    if (entry.side === 'LESS') {
      return <span className="text-red-600 font-medium">▼ LESS</span>;
    }
    if (entry.side) {
      return <span className="text-muted-foreground capitalize">({entry.side})</span>;
    }
    return null;
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
                      <span className="ml-1">{getSelectionDisplay(entry)}</span>
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
                            <Badge variant="secondary" className="gap-1">
                              <Lock className="h-3 w-3" />
                              Locked
                            </Badge>
                          </>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">Open</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {entry.status === 'open' && (
                          <Button size="sm" variant="outline" onClick={() => openSettleModal(entry)}>
                            Settle
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setDetailModal({ open: true, entry })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Entry</DialogTitle>
            <DialogDescription>
              {isFantasyPickem(settleModal.entry) 
                ? 'Enter the actual result to automatically calculate the outcome.'
                : 'Mark this entry as settled. This action will lock the entry.'}
            </DialogDescription>
          </DialogHeader>
          
          {settleModal.entry && (
            <div className="space-y-4 py-4">
              {/* Entry Summary */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Player/Team</span>
                  <span className="font-medium">{settleModal.entry.player || settleModal.entry.team || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market</span>
                  <span className="font-medium">{settleModal.entry.market}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line</span>
                  <span className="font-medium">{settleModal.entry.line_value || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selection</span>
                  <span className="font-medium">{getSelectionDisplay(settleModal.entry)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stake</span>
                  <span className="font-medium">${settleModal.entry.stake}</span>
                </div>
              </div>

              {isFantasyPickem(settleModal.entry) ? (
                // Fantasy Pick'em Settlement Flow
                <>
                  {/* Validation Warnings */}
                  {(!settleModal.entry.line_value || !settleModal.entry.side) && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Line value and selection (MORE/LESS) are required for settlement.</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="actualValue">Actual Result Value *</Label>
                    <Input
                      id="actualValue"
                      type="number"
                      step="0.5"
                      placeholder="e.g., 27 (player scored 27 points)"
                      value={settleModal.actualResultValue}
                      onChange={(e) => handleActualValueChange(e.target.value)}
                      disabled={!settleModal.entry.line_value || !settleModal.entry.side}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the final stat value (e.g., total points scored)
                    </p>
                  </div>

                  {/* Computed Result Preview */}
                  {settleModal.computedResult && (
                    <div className={`rounded-lg p-4 text-center ${
                      settleModal.computedResult === 'W' 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                      <div className="flex items-center justify-center gap-2">
                        {settleModal.computedResult === 'W' 
                          ? <CheckCircle2 className="h-6 w-6 text-green-500" />
                          : <XCircle className="h-6 w-6 text-red-500" />
                        }
                        <span className={`text-lg font-bold ${
                          settleModal.computedResult === 'W' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {settleModal.computedResult === 'W' ? 'WIN' : 'LOSS'}
                        </span>
                      </div>
                      <p className="text-sm mt-2 text-muted-foreground">
                        {settleModal.actualResultValue} {settleModal.entry.side === 'MORE' ? '>' : '<'} {settleModal.entry.line_value} = {settleModal.computedResult === 'W' ? 'True' : 'False'}
                      </p>
                      <p className={`text-sm font-mono mt-1 ${
                        parseFloat(settleModal.profitLoss) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        P/L: {parseFloat(settleModal.profitLoss) > 0 ? '+' : ''}${settleModal.profitLoss}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                // Sportsbook Settlement Flow (Manual)
                <>
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
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleModal(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button 
              onClick={() => settleMutation.mutate()} 
              disabled={
                settleMutation.isPending || 
                (isFantasyPickem(settleModal.entry) 
                  ? !settleModal.computedResult 
                  : !settleModal.result)
              }
            >
              <Lock className="h-4 w-4 mr-1" />
              {settleMutation.isPending ? 'Settling...' : 'Settle & Lock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal */}
      <Dialog open={detailModal.open} onOpenChange={(open) => !open && setDetailModal({ open: false, entry: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Entry Details</DialogTitle>
          </DialogHeader>
          
          {detailModal.entry && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{format(new Date(detailModal.entry.date), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">State</span>
                  <Badge variant="outline">{detailModal.entry.state}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="font-medium capitalize">{detailModal.entry.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium">{FORMAT_LABELS[detailModal.entry.format_tag as FormatTag] || detailModal.entry.format_tag}</span>
                </div>
                {detailModal.entry.player && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Player</span>
                    <span className="font-medium">{detailModal.entry.player}</span>
                  </div>
                )}
                {detailModal.entry.team && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team</span>
                    <span className="font-medium">{detailModal.entry.team}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market</span>
                  <span className="font-medium">{detailModal.entry.market}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line</span>
                  <span className="font-medium">{detailModal.entry.line_value || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selection</span>
                  <span className="font-medium">{getSelectionDisplay(detailModal.entry)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stake</span>
                  <span className="font-medium">${detailModal.entry.stake}</span>
                </div>
                {detailModal.entry.multiplier && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Multiplier</span>
                    <span className="font-medium">{detailModal.entry.multiplier}x</span>
                  </div>
                )}
                {detailModal.entry.odds && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Odds</span>
                    <span className="font-medium">{detailModal.entry.odds}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decision Source</span>
                  <Badge variant={detailModal.entry.decision_source === 'AI' ? 'default' : 'secondary'}>
                    {detailModal.entry.decision_source || 'USER'}
                  </Badge>
                </div>
              </div>

              {detailModal.entry.status === 'settled' && (
                <div className={`rounded-lg p-4 ${
                  detailModal.entry.result === 'W' 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : detailModal.entry.result === 'L'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Result</span>
                    <div className="flex items-center gap-2">
                      {getResultIcon(detailModal.entry.result)}
                      <span className={`font-bold ${
                        detailModal.entry.result === 'W' ? 'text-green-600' : 
                        detailModal.entry.result === 'L' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {detailModal.entry.result === 'W' ? 'WIN' : detailModal.entry.result === 'L' ? 'LOSS' : 'PUSH'}
                      </span>
                    </div>
                  </div>
                  {detailModal.entry.actual_result_value !== null && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-muted-foreground">Actual Result</span>
                      <span className="font-medium">{detailModal.entry.actual_result_value}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-muted-foreground">Profit/Loss</span>
                    <span className={`font-mono font-medium ${
                      detailModal.entry.profit_loss > 0 ? 'text-green-600' : 
                      detailModal.entry.profit_loss < 0 ? 'text-red-600' : ''
                    }`}>
                      {detailModal.entry.profit_loss > 0 ? '+' : ''}${detailModal.entry.profit_loss}
                    </span>
                  </div>
                  {detailModal.entry.locked_at && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-muted-foreground">Locked At</span>
                      <span className="text-sm flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        {format(new Date(detailModal.entry.locked_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModal({ open: false, entry: null })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
