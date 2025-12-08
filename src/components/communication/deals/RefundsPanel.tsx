import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Bot,
  User,
  DollarSign,
  MessageSquare
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-500',
  pending_approval: 'bg-orange-500/10 text-orange-500',
  approved: 'bg-green-500/10 text-green-500',
  denied: 'bg-red-500/10 text-red-500',
  resolved: 'bg-gray-500/10 text-gray-500',
};

export default function RefundsPanel() {
  const { data: refundTickets, isLoading } = useQuery({
    queryKey: ['refund-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refund_tickets')
        .select(`
          *,
          store:store_master(store_name),
          business:businesses(name),
          deal:deals(id, expected_value)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    open: refundTickets?.filter(r => r.status === 'open').length || 0,
    pending: refundTickets?.filter(r => r.status === 'pending_approval').length || 0,
    resolved: refundTickets?.filter(r => r.status === 'resolved').length || 0,
    totalAmount: refundTickets?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.open}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refund Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Issues & Refund Tickets</CardTitle>
          <CardDescription>
            All refund requests, credits, and issue resolutions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refundTickets?.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">
                      {ticket.store?.store_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{ticket.business?.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ticket.reason}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${Number(ticket.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {ticket.created_by === 'ai' ? (
                          <Bot className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                        <span className="text-sm capitalize">{ticket.created_by}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[ticket.status] || statusColors.open}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {ticket.status === 'open' || ticket.status === 'pending_approval' ? (
                          <>
                            <Button size="sm" variant="ghost">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {(!refundTickets || refundTickets.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No refund tickets found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
