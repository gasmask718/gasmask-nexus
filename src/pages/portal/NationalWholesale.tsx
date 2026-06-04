import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PortalLayout from '@/components/portal/PortalLayout';
import { Globe, Package, Users, Truck, MapPin } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// T4c: real queries — wholesalers (41) grouped by state as regions, wholesale_hubs, real partner counts.

export default function NationalWholesale() {
  const { data: wholesalers = [] } = useQuery({
    queryKey: ['nw-wholesalers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wholesalers')
        .select('id, name, city, state, status, phone, email, neighborhood, created_at')
        .is('deleted_at', null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: hubs = [] } = useQuery({
    queryKey: ['nw-hubs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wholesale_hubs')
        .select('*');
      if (error) return [];
      return data || [];
    },
  });

  const { data: skuCount = 0 } = useQuery<number>({
    queryKey: ['nw-skus'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('products_all')
        .select('id', { count: 'exact', head: true });
      return (count as number) || 0;
    },
  });

  const byState = (wholesalers as any[]).reduce<Record<string, any[]>>((acc, w: any) => {
    const k = w.state || 'Unknown';
    (acc[k] = acc[k] || []).push(w);
    return acc;
  }, {});
  const regions = Object.entries(byState).sort((a, b) => b[1].length - a[1].length);
  const activePartners = (wholesalers as any[]).filter((w: any) => w.status === 'active').length;

  return (
    <PortalLayout title="National Wholesale Portal">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              National Wholesale Portal
            </h1>
            <p className="text-muted-foreground mt-1">
              Live data: {(wholesalers as any[]).length} wholesalers across {regions.length} states · {hubs.length} hubs
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-1">Enterprise</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={MapPin} label="Active Regions (states)" value={String(regions.length)} sub={`${regions[0]?.[0] || '—'} leads w/ ${regions[0]?.[1].length || 0}`} />
          <StatCard icon={Users} label="Partner Wholesalers" value={String((wholesalers as any[]).length)} sub={`${activePartners} active`} />
          <StatCard icon={Truck} label="Wholesale Hubs" value={String(hubs.length)} sub="Distribution nodes" />
          <StatCard icon={Package} label="SKUs Available" value={skuCount.toLocaleString()} sub="From products_all" />
        </div>

        <Tabs defaultValue="regions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="regions">Regions</TabsTrigger>
            <TabsTrigger value="partners">Partners ({(wholesalers as any[]).length})</TabsTrigger>
            <TabsTrigger value="hubs">Hubs ({hubs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="regions">
            <Card>
              <CardHeader>
                <CardTitle>Regional Distribution</CardTitle>
                <CardDescription>Wholesalers grouped by state</CardDescription>
              </CardHeader>
              <CardContent>
                {regions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wholesalers found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Wholesalers</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regions.map(([state, ws]) => (
                        <TableRow key={state}>
                          <TableCell className="font-medium">{state}</TableCell>
                          <TableCell className="text-right">{ws.length}</TableCell>
                          <TableCell className="text-right">{ws.filter((w: any) => w.status === 'active').length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partners">
            <Card>
              <CardHeader>
                <CardTitle>Wholesale Partners</CardTitle>
                <CardDescription>Live from `wholesalers` table</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(wholesalers as any[]).slice(0, 100).map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell>{w.city || '—'}</TableCell>
                        <TableCell>{w.state || '—'}</TableCell>
                        <TableCell><Badge variant={w.status === 'active' ? 'default' : 'secondary'}>{w.status || 'pending'}</Badge></TableCell>
                        <TableCell>{w.phone || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hubs">
            <Card>
              <CardHeader>
                <CardTitle>Wholesale Hubs</CardTitle>
                <CardDescription>Live from `wholesale_hubs` table</CardDescription>
              </CardHeader>
              <CardContent>
                {hubs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hubs configured.</p>
                ) : (
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(hubs, null, 2)}</pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
