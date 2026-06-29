import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Globe, DollarSign, Loader2, CreditCard, Shield, Settings, TrendingUp } from 'lucide-react';
import { BuilderAssignControl } from '@/components/brandaro/BuilderAssignControl';

interface Client {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  package_chosen: string | null;
  client_status: string;
  maintenance_status: string | null;
  monthly_revenue: number | null;
  created_at: string;
  assigned_builder: string | null;
}


interface Subscription {
  id: string;
  client_id: string;
  service_type: string;
  monthly_fee: number;
  status: string;
  started_at: string | null;
}

export default function ClientPortalPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: c }, { data: s }] = await Promise.all([
      (supabase as any).from('brandaro_clients').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('brandaro_subscriptions').select('*').order('created_at', { ascending: false }),
    ]);
    setClients(c || []);
    setSubscriptions(s || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const activeClients = clients.filter(c => c.client_status === 'active');
  const totalMRR = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + s.monthly_fee, 0);
  const maintenanceClients = clients.filter(c => c.maintenance_status === 'active');

  const clientSubs = (clientId: string) => subscriptions.filter(s => s.client_id === clientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Client Portal & Revenue</h1>
        <p className="text-muted-foreground">Manage active clients, subscriptions, and recurring revenue</p>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Clients', value: activeClients.length, icon: Users },
          { label: 'Monthly Recurring', value: `$${totalMRR.toLocaleString()}`, icon: DollarSign },
          { label: 'Maintenance Clients', value: maintenanceClients.length, icon: Shield },
          { label: 'Total Clients', value: clients.length, icon: Globe },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : clients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No clients yet. Close a sale to create your first client.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Maintenance</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead>Since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map(client => {
                      const subs = clientSubs(client.id);
                      const mrr = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + s.monthly_fee, 0);
                      return (
                        <TableRow key={client.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedClient(client)}>
                          <TableCell className="font-medium">{client.business_name}</TableCell>
                          <TableCell>{client.owner_name || '—'}</TableCell>
                          <TableCell><Badge variant="outline">{client.package_chosen || '—'}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={client.client_status === 'active' ? 'default' : 'secondary'}>
                              {client.client_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={client.maintenance_status === 'active' ? 'default' : 'outline'}>
                              {client.maintenance_status || 'none'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">${mrr}/mo</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(client.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardContent className="pt-4">
              {subscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No subscriptions yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Monthly Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map(sub => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium capitalize">{sub.service_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="font-semibold">${sub.monthly_fee}/mo</TableCell>
                        <TableCell>
                          <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'past_due' ? 'destructive' : 'secondary'}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
