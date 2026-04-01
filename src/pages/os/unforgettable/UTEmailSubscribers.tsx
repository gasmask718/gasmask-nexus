
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Mail } from 'lucide-react';

export default function UTEmailSubscribers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📧 Email Subscribers</h1>
        <p className="text-muted-foreground">Everyone who gave us their email for 10% off</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Total Subscribers</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">This Week</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">This Month</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Discount Used</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        <Button variant="outline"><Mail className="h-4 w-4 mr-2" />Export to SendGrid</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Subscribers</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Email</TableHead><TableHead>Source</TableHead><TableHead>Discount Code</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No subscribers yet — connect shop popup</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
