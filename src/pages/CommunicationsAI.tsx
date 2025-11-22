import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Brain, Phone, MessageSquare, Mail, AlertTriangle, 
  TrendingUp, Search, Zap, CheckCircle, XCircle,
  Clock, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CommunicationTimelineCRM } from '@/components/crm/CommunicationTimelineCRM';

const CommunicationsAI = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  // Fetch AI communication queue
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['ai-communication-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_communication_queue')
        .select(`
          *,
          crm_contacts(name, phone, email),
          stores(name, location_city, location_state),
          profiles!ai_communication_queue_actioned_by_fkey(name),
          influencers(name, username),
          wholesale_hubs(name, city, state)
        `)
        .eq('status', 'pending')
        .order('urgency', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Run AI Analyzer
  const analyzerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-communication-analyzer');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`AI Analysis Complete: ${data.priorityQueue?.length || 0} priority items found`);
      queryClient.invalidateQueries({ queryKey: ['ai-communication-queue'] });
    },
    onError: (error: any) => {
      toast.error('AI Analysis failed: ' + error.message);
    },
  });

  // Mark item as actioned
  const actionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'actioned' | 'skipped' }) => {
      const { error } = await supabase
        .from('ai_communication_queue')
        .update({ 
          status, 
          actioned_at: new Date().toISOString(),
          actioned_by: (await supabase.auth.getUser()).data.user?.id 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Queue item updated');
      queryClient.invalidateQueries({ queryKey: ['ai-communication-queue'] });
    },
  });

  const filteredQueue = queueData?.filter((item) => {
    const matchesSearch = searchTerm === '' || 
      item.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getEntityName(item)?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = entityFilter === 'all' || item.entity_type === entityFilter;
    
    return matchesSearch && matchesFilter;
  });

  function getEntityName(item: any): string {
    switch (item.entity_type) {
      case 'contact':
        return item.crm_contacts?.name || 'Contact';
      case 'store':
        return item.stores?.name || 'Store';
      case 'driver':
      case 'ambassador':
        return item.profiles?.name || 'Person';
      case 'influencer':
        return item.influencers?.name || 'Influencer';
      case 'wholesaler':
        return item.wholesale_hubs?.name || 'Wholesaler';
      default:
        return 'Unknown';
    }
  }

  function getUrgencyColor(urgency: number): string {
    if (urgency >= 80) return 'text-red-500';
    if (urgency >= 60) return 'text-orange-500';
    if (urgency >= 40) return 'text-yellow-500';
    return 'text-green-500';
  }

  function getUrgencyBadge(urgency: number) {
    if (urgency >= 80) return <Badge variant="destructive">Critical</Badge>;
    if (urgency >= 60) return <Badge className="bg-orange-500">High</Badge>;
    if (urgency >= 40) return <Badge className="bg-yellow-500">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              AI Communication Command Center
            </h1>
            <p className="text-muted-foreground">
              AI-powered priority queue, relationship intelligence, and automated messaging
            </p>
          </div>
          <Button
            onClick={() => analyzerMutation.mutate()}
            disabled={analyzerMutation.isPending}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {analyzerMutation.isPending ? 'Analyzing...' : 'Run AI Analysis'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold">
                  {filteredQueue?.filter(q => q.urgency >= 80).length || 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold">
                  {filteredQueue?.filter(q => q.urgency >= 60 && q.urgency < 80).length || 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Queue</p>
                <p className="text-2xl font-bold">{filteredQueue?.length || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Actioned Today</p>
                <p className="text-2xl font-bold">
                  {queueData?.filter(q => q.status === 'actioned' && 
                    new Date(q.actioned_at || '').toDateString() === new Date().toDateString()
                  ).length || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="store">Stores</SelectItem>
                <SelectItem value="contact">Contacts</SelectItem>
                <SelectItem value="driver">Drivers</SelectItem>
                <SelectItem value="influencer">Influencers</SelectItem>
                <SelectItem value="wholesaler">Wholesalers</SelectItem>
                <SelectItem value="ambassador">Ambassadors</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Priority Queue */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Priority Queue
            </h2>
            
            {queueLoading ? (
              <Card className="p-8 text-center">
                <div className="inline-block h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </Card>
            ) : filteredQueue && filteredQueue.length > 0 ? (
              filteredQueue.map((item) => (
                <Card 
                  key={item.id} 
                  className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                    selectedEntity?.id === item.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedEntity(item)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{getEntityName(item)}</h3>
                        <Badge variant="outline" className="capitalize">{item.entity_type}</Badge>
                        {getUrgencyBadge(item.urgency)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.reason}</p>
                      <p className="text-sm font-medium text-primary mb-3">
                        💡 {item.suggested_action}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/communication/calls?entity=${item.entity_id}`);
                        }}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/communication/texts?entity=${item.entity_id}`);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/communication/email?entity=${item.entity_id}`);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          actionMutation.mutate({ id: item.id, status: 'actioned' });
                        }}
                      >
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          actionMutation.mutate({ id: item.id, status: 'skipped' });
                        }}
                      >
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">No priority items. Queue is clear!</p>
              </Card>
            )}
          </div>

          {/* AI Summary Panel */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {selectedEntity ? 'AI Insights' : 'Select Entity'}
            </h2>
            
            {selectedEntity ? (
              <Card className="p-4">
                <Tabs defaultValue="summary">
                  <TabsList className="w-full">
                    <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
                    <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary" className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Entity Details</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        <strong>Name:</strong> {getEntityName(selectedEntity)}
                      </p>
                      <p className="text-sm text-muted-foreground mb-1">
                        <strong>Type:</strong> <span className="capitalize">{selectedEntity.entity_type}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Urgency:</strong>{' '}
                        <span className={getUrgencyColor(selectedEntity.urgency)}>
                          {selectedEntity.urgency}/100
                        </span>
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">AI Analysis</h3>
                      <p className="text-sm text-muted-foreground mb-2">{selectedEntity.reason}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Recommended Action</h3>
                      <p className="text-sm text-primary">{selectedEntity.suggested_action}</p>
                    </div>

                    <div className="pt-4 space-y-2 border-t">
                      <Button 
                        className="w-full" 
                        onClick={() => navigate(`/communication/calls?entity=${selectedEntity.entity_id}`)}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Call
                      </Button>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => navigate(`/communication/texts?entity=${selectedEntity.entity_id}`)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Text
                      </Button>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => navigate(`/communication/email?entity=${selectedEntity.entity_id}`)}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="timeline">
                    <div className="max-h-[600px] overflow-y-auto">
                      <CommunicationTimelineCRM
                        contactId={selectedEntity.entity_type === 'contact' ? selectedEntity.entity_id : undefined}
                        storeId={selectedEntity.entity_type === 'store' ? selectedEntity.entity_id : undefined}
                        driverId={selectedEntity.entity_type === 'driver' ? selectedEntity.entity_id : undefined}
                        influencerId={selectedEntity.entity_type === 'influencer' ? selectedEntity.entity_id : undefined}
                        wholesalerId={selectedEntity.entity_type === 'wholesaler' ? selectedEntity.entity_id : undefined}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Click on a queue item to view AI insights and communication history
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CommunicationsAI;