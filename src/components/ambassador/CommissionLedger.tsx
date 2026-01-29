import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Filter, Store, Package, Users, UserPlus } from "lucide-react";
import { ExportButton } from "@/components/crud/ExportButton";
import type { CommissionEvent, CommissionCategory, CommissionStatus } from "@/hooks/useAmbassadorCommissions";

interface CommissionLedgerProps {
  events: CommissionEvent[];
  category?: CommissionCategory;
  onBack?: () => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  ambassadorName?: string;
}

const categoryIcons: Record<CommissionCategory, typeof Store> = {
  store: Store,
  wholesaler: Package,
  influencer: Users,
  ambassador: UserPlus,
};

const categoryLabels: Record<CommissionCategory, string> = {
  store: 'Store',
  wholesaler: 'Wholesaler',
  influencer: 'Influencer',
  ambassador: 'Ambassador Override',
};

const statusColors: Record<CommissionStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function CommissionLedger({ 
  events, 
  category, 
  onBack, 
  isLoading,
  isReadOnly,
  ambassadorName,
}: CommissionLedgerProps) {
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | 'all'>('all');

  const filteredEvents = statusFilter === 'all' 
    ? events 
    : events.filter(e => e.status === statusFilter);

  const totalAmount = filteredEvents.reduce((sum, e) => sum + e.commission_amount, 0);

  const exportColumns = [
    { key: 'created_at', label: 'Date' },
    { key: 'category', label: 'Category' },
    { key: 'source_entity_name', label: 'Source' },
    { key: 'trigger_type', label: 'Event' },
    { key: 'gross_amount', label: 'Gross Amount' },
    { key: 'commission_rate', label: 'Rate' },
    { key: 'commission_amount', label: 'Commission' },
    { key: 'status', label: 'Status' },
    { key: 'reference_id', label: 'Reference' },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <CardTitle>
              {category ? `${categoryLabels[category]} Commissions` : 'All Commissions'}
            </CardTitle>
            {isReadOnly && ambassadorName && (
              <p className="text-sm text-muted-foreground mt-1">
                Viewing data for {ambassadorName}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CommissionStatus | 'all')}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          
          <ExportButton 
            data={filteredEvents as unknown as Record<string, unknown>[]}
            filename={`commissions-${category || 'all'}`}
            columns={exportColumns}
          />
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary */}
        <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {filteredEvents.length} transactions
          </span>
          <span className="text-lg font-bold text-green-400">
            Total: ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No commission transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!category && <TableHead>Category</TableHead>}
                  <TableHead>Source</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => {
                  const Icon = categoryIcons[event.category];
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(event.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      {!category && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{categoryLabels[event.category]}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {event.source_entity_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {event.trigger_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${event.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {(event.commission_rate * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-400">
                        ${event.commission_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[event.status]}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.reference_id || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
