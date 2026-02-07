/**
 * Ambassador Purchases Table
 * Reusable table for both portal and admin profile views
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { Package, Clock, CheckCircle, XCircle, DollarSign, Eye, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import type { PurchaseWithItems } from '@/hooks/useAmbassadorPurchases';

interface AmbassadorPurchasesTableProps {
  purchases: PurchaseWithItems[];
  isLoading?: boolean;
  showSource?: boolean;
}

function getStatusBadge(status: string) {
  const config: Record<string, { icon: typeof Clock; className: string; label: string }> = {
    draft: { icon: Clock, className: 'bg-muted text-muted-foreground border-muted', label: 'Draft' },
    submitted: { icon: Clock, className: 'bg-blue-500/10 text-blue-500 border-blue-500/30', label: 'Submitted' },
    paid: { icon: DollarSign, className: 'bg-green-500/10 text-green-500 border-green-500/30', label: 'Paid' },
    fulfilled: { icon: CheckCircle, className: 'bg-primary/10 text-primary border-primary/30', label: 'Fulfilled' },
    cancelled: { icon: XCircle, className: 'bg-red-500/10 text-red-500 border-red-500/30', label: 'Cancelled' },
    refunded: { icon: XCircle, className: 'bg-orange-500/10 text-orange-500 border-orange-500/30', label: 'Refunded' },
  };
  const c = config[status] || config.draft;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={c.className}>
      <Icon className="h-3 w-3 mr-1" />
      {c.label}
    </Badge>
  );
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    ambassador_portal: 'Self-Service',
    admin_backoffice: 'Admin',
    va: 'VA',
    system: 'System',
  };
  return labels[source] || source;
}

export function AmbassadorPurchasesTable({ purchases, isLoading, showSource = false }: AmbassadorPurchasesTableProps) {
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithItems | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!purchases || purchases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-1">No purchases yet</h3>
          <p className="text-sm text-muted-foreground">
            Purchase history will appear here once orders are placed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <ScrollArea className="max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {showSource && <TableHead>Source</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow
                  key={purchase.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedPurchase(purchase)}
                >
                  <TableCell className="text-muted-foreground">
                    {format(new Date(purchase.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{purchase.order_number}</TableCell>
                  <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                  <TableCell>{purchase.items.length}</TableCell>
                  <TableCell className="text-right font-semibold">
                    ${Number(purchase.total).toFixed(2)}
                  </TableCell>
                  {showSource && (
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getSourceLabel(purchase.order_source)}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Order Detail Drawer */}
      <Sheet open={!!selectedPurchase} onOpenChange={() => setSelectedPurchase(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          {selectedPurchase && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{selectedPurchase.order_number}</SheetTitle>
                <SheetDescription>
                  Created {format(new Date(selectedPurchase.created_at), 'MMM d, yyyy h:mm a')}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedPurchase.status)}
                </div>

                {selectedPurchase.paid_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Paid at</span>
                    <span className="text-sm">
                      {format(new Date(selectedPurchase.paid_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                )}

                {selectedPurchase.fulfilled_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fulfilled at</span>
                    <span className="text-sm">
                      {format(new Date(selectedPurchase.fulfilled_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                )}

                <Separator />

                {/* Line Items */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Line Items</h4>
                  <div className="space-y-2">
                    {selectedPurchase.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{item.product_name_snapshot}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × ${Number(item.unit_price_snapshot).toFixed(2)}
                          </p>
                        </div>
                        <span className="font-semibold text-sm">
                          ${Number(item.line_total).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${Number(selectedPurchase.subtotal).toFixed(2)}</span>
                  </div>
                  {Number(selectedPurchase.discount_total) > 0 && (
                    <div className="flex justify-between text-sm text-green-500">
                      <span>Discount</span>
                      <span>-${Number(selectedPurchase.discount_total).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(selectedPurchase.tax) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>${Number(selectedPurchase.tax).toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>${Number(selectedPurchase.total).toFixed(2)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedPurchase.notes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Notes</h4>
                      <p className="text-sm text-muted-foreground">{selectedPurchase.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
