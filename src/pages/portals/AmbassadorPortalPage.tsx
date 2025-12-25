/**
 * Ambassador Portal - Lead acquisition & referral management
 * Routes: /portals/ambassador/*
 */
import { useState } from 'react';
import { 
  Users, Store, Package, DollarSign, 
  Link as LinkIcon, Copy, Share2, Download, QrCode,
  Plus, TrendingUp
} from 'lucide-react';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { CommandCenterKPI } from '@/components/portal/CommandCenterKPI';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { HudCard } from '@/components/portal/HudCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useResolvedData } from '@/hooks/useResolvedData';
import { SimulationBadge } from '@/contexts/SimulationModeContext';
import { useToast } from '@/hooks/use-toast';

const SIMULATION_LEADS = [
  { id: 'l1', name: 'John\'s Deli', contact: 'John Smith', phone: '555-0101', status: 'new', addedAt: '2024-01-15' },
  { id: 'l2', name: 'Quick Stop Market', contact: 'Maria Garcia', phone: '555-0102', status: 'contacted', addedAt: '2024-01-14' },
  { id: 'l3', name: 'Corner Smoke Shop', contact: 'Ahmed Hassan', phone: '555-0103', status: 'interested', addedAt: '2024-01-13' },
  { id: 'l4', name: 'Express Mart', contact: 'Sarah Lee', phone: '555-0104', status: 'signed', addedAt: '2024-01-12' },
];

const SIMULATION_STORES_SIGNED = [
  { id: 's1', name: 'Express Mart', signedAt: '2024-01-12', firstOrderAt: '2024-01-15', totalOrders: 3, commission: 45 },
  { id: 's2', name: 'City Convenience', signedAt: '2024-01-08', firstOrderAt: '2024-01-10', totalOrders: 5, commission: 75 },
  { id: 's3', name: 'Brooklyn Bodega', signedAt: '2024-01-05', firstOrderAt: '2024-01-06', totalOrders: 8, commission: 120 },
];

const SIMULATION_COMMISSIONS = [
  { id: 'c1', store: 'Brooklyn Bodega', orderId: 'ORD-456', amount: 15, status: 'paid', date: '2024-01-14' },
  { id: 'c2', store: 'City Convenience', orderId: 'ORD-455', amount: 15, status: 'paid', date: '2024-01-13' },
  { id: 'c3', store: 'Express Mart', orderId: 'ORD-454', amount: 15, status: 'pending', date: '2024-01-12' },
];

function AmbassadorPortalContent() {
  const { toast } = useToast();
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const referralCode = 'AMB-JOHN-2024';
  const referralLink = `https://dynasty.com/ref/${referralCode}`;

  const { data: leads, isSimulated: leadsSimulated } = useResolvedData([], SIMULATION_LEADS);
  const { data: storesSigned, isSimulated: storesSimulated } = useResolvedData([], SIMULATION_STORES_SIGNED);
  const { data: commissions } = useResolvedData([], SIMULATION_COMMISSIONS);

  const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
  const pendingCommission = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);

  const handleKpiClick = (kpi: string) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
  };

  return (
    <EnhancedPortalLayout 
      title="Ambassador Portal" 
      subtitle="Lead acquisition & commissions"
      portalIcon={<Users className="h-4 w-4 text-primary-foreground" />}
    >
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <CommandCenterKPI
            label="Leads Added"
            value={leads.length}
            icon={Users}
            variant="cyan"
            isActive={selectedKpi === 'leads'}
            isSimulated={leadsSimulated}
            onClick={() => handleKpiClick('leads')}
          />
          <CommandCenterKPI
            label="Stores Signed"
            value={storesSigned.length}
            icon={Store}
            variant="green"
            isActive={selectedKpi === 'stores'}
            isSimulated={storesSimulated}
            onClick={() => handleKpiClick('stores')}
          />
          <CommandCenterKPI
            label="Boxes Ordered"
            value={storesSigned.reduce((sum, s) => sum + s.totalOrders, 0)}
            icon={Package}
            variant="amber"
            isSimulated={storesSimulated}
          />
          <CommandCenterKPI
            label="Revenue Generated"
            value={`$${storesSigned.reduce((sum, s) => sum + s.totalOrders * 50, 0)}`}
            icon={TrendingUp}
            variant="purple"
            isSimulated={storesSimulated}
          />
          <CommandCenterKPI
            label="Commission Earned"
            value={`$${totalCommission}`}
            icon={DollarSign}
            trend={`$${pendingCommission} pending`}
            variant="green"
            isActive={selectedKpi === 'commissions'}
            isSimulated={storesSimulated}
            onClick={() => handleKpiClick('commissions')}
          />
        </div>

        {/* Referral Card */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Your Referral Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={() => copyToClipboard(referralLink, 'Referral link')}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Code: {referralCode}</p>
                <p className="text-sm text-muted-foreground">15% commission on all referred orders</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <QrCode className="h-4 w-4 mr-1" />
                  QR Code
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Materials
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Details */}
        {selectedKpi && (
          <Card className="border-primary/20 bg-card/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedKpi === 'leads' && 'My Leads'}
                  {selectedKpi === 'stores' && 'Signed Stores'}
                  {selectedKpi === 'commissions' && 'Commission History'}
                  {leadsSimulated && <SimulationBadge />}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedKpi(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedKpi === 'leads' && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>{lead.contact}</TableCell>
                        <TableCell>
                          <Badge variant={lead.status === 'signed' ? 'default' : 'secondary'}>
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{lead.addedAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {selectedKpi === 'stores' && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Signed</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storesSigned.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell className="font-medium">{store.name}</TableCell>
                        <TableCell>{store.signedAt}</TableCell>
                        <TableCell>{store.totalOrders}</TableCell>
                        <TableCell className="text-hud-green">${store.commission}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {selectedKpi === 'commissions' && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.store}</TableCell>
                        <TableCell>{c.orderId}</TableCell>
                        <TableCell className="text-hud-green">${c.amount}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>
                            {c.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <Button className="h-auto py-4 flex-col gap-2">
            <Plus className="h-5 w-5" />
            <span>Add New Lead</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Store className="h-5 w-5" />
            <span>View Pipeline</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Package className="h-5 w-5" />
            <span>Inventory</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Download className="h-5 w-5" />
            <span>Training</span>
          </Button>
        </div>
      </div>
    </EnhancedPortalLayout>
  );
}

export default function AmbassadorPortalPage() {
  return (
    <PortalRBACGate allowedRoles={['ambassador']} portalName="Ambassador Portal">
      <AmbassadorPortalContent />
    </PortalRBACGate>
  );
}
