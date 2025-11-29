import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Search, PhoneIncoming, PhoneOutgoing, Clock, Play, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { BrandFilterBar } from '@/components/grabba/BrandFilterBar';
import { GRABBA_BRAND_CONFIG, GrabbaBrand } from '@/config/grabbaBrands';

export default function GrabbaCallCenter() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch call logs filtered by brand
  const { data: callLogs, isLoading } = useQuery({
    queryKey: ['grabba-call-logs', selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(name),
          store:stores(name)
        `)
        .eq('channel', 'call')
        .in('brand', brandsToQuery)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Fetch call center specific logs
  const { data: callCenterLogs } = useQuery({
    queryKey: ['grabba-call-center-logs', selectedBrand],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_center_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const filteredLogs = callLogs?.filter((log: any) => {
    if (!searchQuery) return true;
    const text = searchQuery.toLowerCase();
    return (
      log.summary?.toLowerCase().includes(text) ||
      log.contact?.name?.toLowerCase().includes(text) ||
      log.store?.name?.toLowerCase().includes(text)
    );
  });

  const stats = {
    totalCalls: callLogs?.length || 0,
    inbound: callLogs?.filter((l: any) => l.direction === 'inbound').length || 0,
    outbound: callLogs?.filter((l: any) => l.direction === 'outbound').length || 0,
    missed: callCenterLogs?.filter((l: any) => l.outcome === 'missed').length || 0,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Phone className="h-8 w-8 text-primary" />
              Grabba Call Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Voice communications and call logs for Grabba brands
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="compact"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCalls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <PhoneIncoming className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inbound}</p>
                  <p className="text-xs text-muted-foreground">Inbound</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <PhoneOutgoing className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.outbound}</p>
                  <p className="text-xs text-muted-foreground">Outbound</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.missed}</p>
                  <p className="text-xs text-muted-foreground">Missed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="logs" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="logs">Call Logs</TabsTrigger>
            <TabsTrigger value="dialer">Quick Dialer</TabsTrigger>
            <TabsTrigger value="recordings">Recordings</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            {/* Search */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search calls..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logs List */}
            <div className="space-y-3">
              {isLoading ? (
                <Card className="p-8 text-center text-muted-foreground">Loading call logs...</Card>
              ) : filteredLogs?.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">No calls found</Card>
              ) : (
                filteredLogs?.map((log: any) => {
                  const brandConfig = log.brand ? GRABBA_BRAND_CONFIG[log.brand as GrabbaBrand] : null;
                  return (
                    <Card key={log.id} className="bg-card/50 backdrop-blur border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${log.direction === 'inbound' ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                              {log.direction === 'inbound' ? (
                                <PhoneIncoming className="h-4 w-4 text-green-500" />
                              ) : (
                                <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {log.contact?.name || log.store?.name || 'Unknown'}
                                </span>
                                {brandConfig && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ borderColor: brandConfig.primary, color: brandConfig.primary }}
                                  >
                                    {brandConfig.label}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {log.summary || 'No summary'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="text-sm">
                                {log.created_at ? format(new Date(log.created_at), "MMM d, h:mm a") : ''}
                              </span>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Play className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="dialer">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Quick Dialer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Enter phone number..." className="text-xl h-14 text-center" />
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1','2','3','4','5','6','7','8','9','*','0','#'].map(num => (
                    <Button key={num} variant="outline" className="h-14 text-xl">
                      {num}
                    </Button>
                  ))}
                </div>
                <Button className="w-full gap-2" size="lg">
                  <Phone className="h-5 w-5" />
                  Call
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recordings">
            <Card className="bg-card/50 backdrop-blur border-border/50 p-8 text-center">
              <p className="text-muted-foreground">No recordings available for selected brand filter</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
