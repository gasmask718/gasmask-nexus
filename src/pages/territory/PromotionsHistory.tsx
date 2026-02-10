import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, History, Store, User } from 'lucide-react';
import { format } from 'date-fns';

interface PromotionHistory {
  id: string;
  proposed_store_name: string;
  proposed_contact_name: string | null;
  verification_method: string;
  verified_sells_tobacco: boolean | null;
  verified_sells_grabba: boolean | null;
  status: string;
  requested_at: string;
  verified_at: string | null;
  rejection_reason: string | null;
}

export default function PromotionsHistory() {
  const { data: promotions, isLoading } = useQuery({
    queryKey: ['territory-promotions-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_store_promotions')
        .select('*')
        .in('status', ['approved', 'rejected'])
        .order('verified_at', { ascending: false });
      if (error) throw error;
      return data as PromotionHistory[];
    },
  });

  const approved = promotions?.filter(p => p.status === 'approved') || [];
  const rejected = promotions?.filter(p => p.status === 'rejected') || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Promotion History</h1>
        <p className="text-muted-foreground">Immutable audit trail of all promotion decisions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{approved.length}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{rejected.length}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <History className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{promotions?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Decisions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-cyan-500" />
            All Decisions
          </CardTitle>
          <CardDescription>Read-only. No modifications permitted.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : !promotions?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No promotion decisions yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Decided</TableHead>
                  <TableHead>Rejection Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell>
                      {promo.status === 'approved' ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{promo.proposed_store_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {promo.proposed_contact_name && (
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3" />
                          <span>{promo.proposed_contact_name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{promo.verification_method}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {promo.verified_sells_tobacco && (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Tobacco</Badge>
                        )}
                        {promo.verified_sells_grabba && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">Grabba</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(promo.requested_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {promo.verified_at ? format(new Date(promo.verified_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {promo.rejection_reason || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
