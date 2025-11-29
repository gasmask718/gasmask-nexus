import { Store, ClipboardCheck, History, MapPin, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useState } from 'react';

// Mock data
const assignedStores = [
  { id: 1, name: 'Smoke King Miami', address: '123 Main St', lastCheck: '3 days ago', status: 'due' },
  { id: 2, name: 'Quick Stop Tobacco', address: '456 Oak Ave', lastCheck: '1 day ago', status: 'ok' },
  { id: 3, name: 'Downtown Smoke Shop', address: '789 Central Blvd', lastCheck: '5 days ago', status: 'overdue' },
];

const checkHistory = [
  { date: '2024-01-15', store: 'Smoke King Miami', shelfCount: 24, notes: 'Low on tubes' },
  { date: '2024-01-14', store: 'Quick Stop Tobacco', shelfCount: 18, notes: 'Well stocked' },
  { date: '2024-01-13', store: 'Vape World', shelfCount: 30, notes: 'New display installed' },
];

export default function BikerPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const bikerProfile = profileData?.roleProfile;
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);

  return (
    <PortalLayout title="Store Checker Portal">
      <div className="space-y-6">
        {/* Status Banner */}
        {bikerProfile?.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Your store checker account is pending approval.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assigned Stores</CardDescription>
              <CardTitle className="text-3xl">{assignedStores.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Checks This Week</CardDescription>
              <CardTitle className="text-3xl">8</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overdue Visits</CardDescription>
              <CardTitle className="text-3xl text-destructive">1</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Today's Assigned Stores */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  Assigned Store Visits
                </CardTitle>
                <CardDescription>Stores you need to check</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignedStores.map((store) => (
                <div key={store.id} className="flex items-center gap-4 p-3 rounded-lg border">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{store.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {store.address}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Last: {store.lastCheck}</p>
                    <Badge variant={
                      store.status === 'overdue' ? 'destructive' : 
                      store.status === 'due' ? 'secondary' : 'outline'
                    }>
                      {store.status}
                    </Badge>
                  </div>
                  <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Check
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Store Check Form</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Shelf Count (Boxes)</Label>
                          <Input type="number" placeholder="e.g. 24" />
                        </div>
                        <div className="space-y-2">
                          <Label>Tubes Count</Label>
                          <Input type="number" placeholder="e.g. 50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Condition</Label>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Good</Badge>
                            <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Needs Restock</Badge>
                            <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Low Stock</Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea placeholder="Any observations..." />
                        </div>
                        <Button className="w-full" onClick={() => setCheckDialogOpen(false)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Submit Check
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Check History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Check History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Shelf Count</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkHistory.map((check, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{check.date}</TableCell>
                    <TableCell>{check.store}</TableCell>
                    <TableCell>{check.shelfCount}</TableCell>
                    <TableCell className="text-muted-foreground">{check.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
