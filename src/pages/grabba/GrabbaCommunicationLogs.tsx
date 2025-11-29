import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Phone, Mail, Search, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { BrandFilterBar } from '@/components/grabba/BrandFilterBar';
import { GRABBA_BRAND_CONFIG, GrabbaBrand } from '@/config/grabbaBrands';

export default function GrabbaCommunicationLogs() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  // Fetch all communication logs filtered by brand
  const { data: logs, isLoading } = useQuery({
    queryKey: ['grabba-all-communication-logs', selectedBrand, channelFilter],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      let query = supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(name),
          store:stores(name)
        `)
        .in('brand', brandsToQuery)
        .order('created_at', { ascending: false })
        .limit(200);

      if (channelFilter !== 'all') {
        query = query.eq('channel', channelFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  const filteredLogs = logs?.filter((log: any) => {
    let matches = true;
    
    if (searchQuery) {
      const text = searchQuery.toLowerCase();
      matches = (
        log.summary?.toLowerCase().includes(text) ||
        log.full_message?.toLowerCase().includes(text) ||
        log.contact?.name?.toLowerCase().includes(text) ||
        log.store?.name?.toLowerCase().includes(text)
      );
    }

    if (directionFilter !== 'all') {
      matches = matches && log.direction === directionFilter;
    }

    return matches;
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/40"><CheckCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/40"><XCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> {status || 'pending'}</Badge>;
    }
  };

  const stats = {
    total: logs?.length || 0,
    sms: logs?.filter((l: any) => l.channel === 'sms').length || 0,
    calls: logs?.filter((l: any) => l.channel === 'call').length || 0,
    emails: logs?.filter((l: any) => l.channel === 'email').length || 0,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              Grabba Communication Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete history of all communications for Grabba brands
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
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Logs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sms}</p>
                  <p className="text-xs text-muted-foreground">SMS</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.calls}</p>
                  <p className="text-xs text-muted-foreground">Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.emails}</p>
                  <p className="text-xs text-muted-foreground">Emails</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>

              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Timeline */}
        <div className="space-y-3">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading logs...</Card>
          ) : filteredLogs?.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No communication logs found</Card>
          ) : (
            filteredLogs?.map((log: any) => {
              const brandConfig = log.brand ? GRABBA_BRAND_CONFIG[log.brand as GrabbaBrand] : null;
              return (
                <Card key={log.id} className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          log.channel === 'sms' ? 'bg-green-500/20' :
                          log.channel === 'call' ? 'bg-blue-500/20' :
                          'bg-purple-500/20'
                        }`}>
                          {getChannelIcon(log.channel)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {log.contact?.name || log.store?.name || 'Unknown'}
                            </span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {log.channel}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {log.direction}
                            </Badge>
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
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {log.summary || log.full_message || 'No content'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {getStatusBadge(log.delivery_status)}
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {log.created_at ? format(new Date(log.created_at), "MMM d, h:mm a") : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
