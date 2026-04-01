
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, DollarSign, Package, Mail } from 'lucide-react';

export default function UTShopDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🛍️ Shop Dashboard</h1>
        <p className="text-muted-foreground">Shopify store performance at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><DollarSign className="mx-auto h-6 w-6 text-green-500 mb-1" /><p className="text-2xl font-bold">$0</p><p className="text-xs text-muted-foreground">Revenue Today</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><ShoppingBag className="mx-auto h-6 w-6 text-blue-500 mb-1" /><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Orders Today</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Package className="mx-auto h-6 w-6 text-purple-500 mb-1" /><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Total Products</p></CardContent></Card>
      </div>

      <Card className="border-amber-500/30">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground text-sm">Connect your Shopify Storefront API to see live order data here.</p>
          <p className="text-xs text-muted-foreground mt-2">Store: unforgettable-times-usa.myshopify.com</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Order #</TableHead><TableHead>Customer</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No orders loaded — connect Shopify API</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
