// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR DEBT VIEW — Debt Accountability by Ambassador
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  ChevronDown,
  ChevronRight,
  DollarSign, 
  Search, 
  TrendingDown,
  User,
  Users,
} from 'lucide-react';
import { useAmbassadorDebtOverview, useAmbassadorDebtDetail } from '@/hooks/useAmbassadorDebt';
import { formatCurrency } from '@/lib/format';
import type { CollectionRiskTier } from '@/hooks/useCollections';

// ═══════════════════════════════════════════════════════════════════════════════
// RISK TIER COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const riskColors: Record<CollectionRiskTier, string> = {
  low: 'bg-green-500/10 text-green-600',
  medium: 'bg-yellow-500/10 text-yellow-600',
  high: 'bg-orange-500/10 text-orange-600',
  critical: 'bg-red-500/10 text-red-600',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AmbassadorDebtView() {
  const [search, setSearch] = useState('');
  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);
  const { data: overview, isLoading } = useAmbassadorDebtOverview();
  const { data: detail } = useAmbassadorDebtDetail(selectedAmbassadorId || undefined);

  const filteredData = (overview || []).filter(amb => 
    !search || amb.ambassador_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate totals
  const totalOutstanding = (overview || []).reduce((sum, a) => sum + a.total_outstanding, 0);
  const totalOverdue = (overview || []).reduce((sum, a) => sum + a.total_overdue, 0);
  const totalAccounts = (overview || []).reduce((sum, a) => sum + a.accounts_with_balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Debt by Ambassador</h1>
        <p className="text-muted-foreground">Track unpaid accounts assigned to each ambassador</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ambassadors w/ Debt</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overview?.length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Outstanding</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Total Overdue</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-destructive">{formatCurrency(totalOverdue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Accounts w/ Balance</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalAccounts}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search ambassadors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Ambassador Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ambassador</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Broken Promises</TableHead>
                <TableHead>Risk Distribution</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No ambassadors with outstanding debt
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((amb) => (
                  <TableRow key={amb.ambassador_id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{amb.ambassador_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(amb.total_outstanding)}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {formatCurrency(amb.total_overdue)}
                    </TableCell>
                    <TableCell className="text-right">{amb.accounts_with_balance}</TableCell>
                    <TableCell className="text-right">
                      {amb.broken_promises > 0 ? (
                        <Badge variant="destructive">{amb.broken_promises}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(['low', 'medium', 'high', 'critical'] as const).map((tier) => (
                          amb.risk_distribution[tier] > 0 && (
                            <Badge key={tier} variant="outline" className={`text-xs ${riskColors[tier]}`}>
                              {tier[0].toUpperCase()}: {amb.risk_distribution[tier]}
                            </Badge>
                          )
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedAmbassadorId(amb.ambassador_id)}
                      >
                        View
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAmbassadorId} onOpenChange={(open) => !open && setSelectedAmbassadorId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Ambassador Debt Detail</DialogTitle>
            <DialogDescription>
              Accounts assigned to this ambassador with outstanding balances
            </DialogDescription>
          </DialogHeader>
          
          {detail && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Managed Outstanding</p>
                      <p className="text-xl font-bold">{formatCurrency(detail.total_managed_outstanding)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {detail.managed_accounts.length} accounts
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Sourced Outstanding</p>
                      <p className="text-xl font-bold">{formatCurrency(detail.total_sourced_outstanding)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {detail.sourced_accounts.length} accounts
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Requires Follow-up */}
                {detail.requires_followup.length > 0 && (
                  <Card className="border-amber-500/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        Requires Follow-up ({detail.requires_followup.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {detail.requires_followup.slice(0, 5).map((acc) => (
                          <div key={acc.id} className="flex items-center justify-between p-2 bg-amber-500/10 rounded">
                            <span className="font-medium">{acc.entity_name || acc.entity_id}</span>
                            <span className="font-bold">{formatCurrency(acc.total_outstanding)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Managed Accounts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Managed Accounts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.managed_accounts.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No managed accounts</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.managed_accounts.slice(0, 10).map((acc) => (
                          <div key={acc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div>
                              <p className="font-medium">{acc.entity_name || acc.entity_id}</p>
                              <p className="text-xs text-muted-foreground capitalize">{acc.entity_type}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(acc.total_outstanding)}</p>
                              <Badge variant="outline" className={`text-xs ${riskColors[acc.risk_tier]}`}>
                                {acc.risk_tier}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AmbassadorDebtView;
