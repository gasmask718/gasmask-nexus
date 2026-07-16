import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSignature, Loader2 } from 'lucide-react';

type Contract = {
  id: string;
  claimant_name: string;
  claimant_email: string | null;
  claimant_phone: string | null;
  state: string;
  surplus_amount: number | null;
  our_percentage: number | null;
  contract_type: string | null;
  status: string | null;
  signed_at: string | null;
  created_at: string;
};

const statusVariant: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  viewed: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  signed: 'bg-green-500/10 text-green-500 border-green-500/30',
  expired: 'bg-red-500/10 text-red-500 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground',
};

const fmtMoney = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

export default function SFContracts() {
  const { data: contracts = [], isLoading, error } = useQuery({
    queryKey: ['sf-contracts'],
    queryFn: async (): Promise<Contract[]> => {
      const { data, error } = await supabase
        .from('surplus_funds_contracts')
        .select('id, claimant_name, claimant_email, claimant_phone, state, surplus_amount, our_percentage, contract_type, status, signed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Contract[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-primary" /> Contracts
        </h1>
        <p className="text-sm text-muted-foreground">Signed and pending claimant agreements</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Contracts ({contracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading contracts…
            </div>
          ) : error ? (
            <div className="text-sm text-red-500 py-6">Failed to load contracts: {(error as Error).message}</div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No contracts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claimant</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Surplus</TableHead>
                    <TableHead className="text-right">Our %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.claimant_name}</div>
                        <div className="text-xs text-muted-foreground">{c.claimant_email || c.claimant_phone || '—'}</div>
                      </TableCell>
                      <TableCell>{c.state}</TableCell>
                      <TableCell className="capitalize">{(c.contract_type || '—').replace('_', ' ')}</TableCell>
                      <TableCell className="text-right">{fmtMoney(c.surplus_amount)}</TableCell>
                      <TableCell className="text-right">{c.our_percentage != null ? `${c.our_percentage}%` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusVariant[c.status || 'draft'] || ''}>
                          {c.status || 'draft'}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmtDate(c.signed_at)}</TableCell>
                      <TableCell>{fmtDate(c.created_at)}</TableCell>
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
