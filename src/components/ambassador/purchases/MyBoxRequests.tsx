/**
 * MyBoxRequests — ambassador's own box request statuses (pending / approved / declined).
 */
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMyBoxRequests } from '@/hooks/useAmbassadorBoxRequests';

const statusVariant = (s: string) => {
  switch (s) {
    case 'approved': return 'default' as const;
    case 'declined': return 'destructive' as const;
    default: return 'secondary' as const;
  }
};

export function MyBoxRequests() {
  const { data: requests = [], isLoading } = useMyBoxRequests();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          My Box Requests
        </CardTitle>
        <CardDescription className="text-xs">
          Stock you've asked for and where each request stands.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Note / Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  No requests yet — use “Request Boxes” when you need stock.
                </TableCell>
              </TableRow>
            ) : requests.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.product_name}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                  {r.status === 'declined' ? (r.decline_reason || '—') : (r.note || '—')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default MyBoxRequests;
