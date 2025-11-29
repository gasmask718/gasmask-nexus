import { MapPin, Package, DollarSign, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PortalLayout from '@/components/portal/PortalLayout';
import { PermissionGate } from '@/components/portal/PermissionGate';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useTranslation } from '@/hooks/useTranslation';

// Mock data - would connect to real routes/deliveries tables
const todayStops = [
  { id: 1, store: 'Smoke King Miami', address: '123 Main St, Miami FL', eta: '10:00 AM', status: 'pending' },
  { id: 2, store: 'Quick Stop Tobacco', address: '456 Oak Ave, Miami FL', eta: '10:45 AM', status: 'pending' },
  { id: 3, store: 'Downtown Smoke Shop', address: '789 Central Blvd, Miami FL', eta: '11:30 AM', status: 'pending' },
];

const recentDeliveries = [
  { date: '2024-01-15', store: 'Smoke King Miami', status: 'delivered', amount: '$450' },
  { date: '2024-01-14', store: 'Quick Stop Tobacco', status: 'delivered', amount: '$320' },
  { date: '2024-01-14', store: 'Vape World', status: 'partial', amount: '$180' },
];

export default function DriverPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const driverProfile = profileData?.roleProfile;
  const { t } = useTranslation();

  return (
    <PortalLayout title={t('driver.title')}>
      <div className="space-y-6">
        {/* Status Banner */}
        {driverProfile?.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Your driver account is pending approval. You'll be notified once approved.
            </p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('driver.todays_route')}</CardDescription>
              <CardTitle className="text-3xl">{todayStops.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                In Progress
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('driver.deliveries')}</CardDescription>
              <CardTitle className="text-3xl">12</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">+3 from last week</span>
            </CardContent>
          </Card>
          <PermissionGate permission="view_driver_earnings">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t('driver.earnings')}</CardDescription>
                <CardTitle className="text-3xl">$485</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-muted-foreground">This pay period</span>
              </CardContent>
            </Card>
          </PermissionGate>
        </div>

        {/* Today's Route */}
        <PermissionGate permission="view_routes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    {t('driver.todays_route')}
                  </CardTitle>
                  <CardDescription>{t('driver.assigned_stores')}</CardDescription>
                </div>
                <Button size="sm">
                  Start Navigation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayStops.map((stop, idx) => (
                  <div key={stop.id} className="flex items-center gap-4 p-3 rounded-lg border">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{stop.store}</p>
                      <p className="text-sm text-muted-foreground">{stop.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{stop.eta}</p>
                      <Badge variant={stop.status === 'pending' ? 'outline' : 'secondary'}>
                        {stop.status}
                      </Badge>
                    </div>
                    <PermissionGate permission="update_store_status">
                      <Button variant="outline" size="sm">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </PermissionGate>

        {/* Recent Deliveries */}
        <PermissionGate permission="view_routes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {t('driver.deliveries')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDeliveries.map((delivery, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{delivery.date}</TableCell>
                      <TableCell>{delivery.store}</TableCell>
                      <TableCell>
                        <Badge variant={delivery.status === 'delivered' ? 'default' : 'secondary'}>
                          {delivery.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{delivery.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </PermissionGate>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <PermissionGate permission="view_driver_earnings">
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t('driver.earnings')}</p>
                  <p className="text-sm text-muted-foreground">Check your pay history</p>
                </div>
              </CardContent>
            </Card>
          </PermissionGate>
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t('driver.documents')}</p>
                <p className="text-sm text-muted-foreground">Upload license & insurance</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
