import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Phone, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown,
  User,
  Bot,
  DollarSign,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

const STAGES = [
  { key: 'contacted', label: 'Contacted', color: 'bg-gray-500' },
  { key: 'interested', label: 'Interested', color: 'bg-blue-500' },
  { key: 'pricing', label: 'Pricing', color: 'bg-yellow-500' },
  { key: 'confirming', label: 'Confirming', color: 'bg-orange-500' },
  { key: 'scheduled', label: 'Scheduled', color: 'bg-purple-500' },
  { key: 'won', label: 'Won', color: 'bg-green-500' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500' },
];

const riskColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  high: 'bg-red-500/10 text-red-500',
};

export default function DealsPipelinePanel() {
  const [businessFilter, setBusinessFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals-pipeline', businessFilter],
    queryFn: async () => {
      let query = supabase
        .from('deals')
        .select(`
          *,
          store:store_master(id, store_name),
          business:businesses(id, name)
        `)
        .order('updated_at', { ascending: false });
      
      if (businessFilter !== 'all') {
        query = query.eq('business_id', businessFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: businesses } = useQuery({
    queryKey: ['businesses-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name');
      return data || [];
    },
  });

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.key] = deals?.filter(d => d.stage === stage.key) || [];
    return acc;
  }, {} as Record<string, typeof deals>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={businessFilter} onValueChange={setBusinessFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Businesses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Businesses</SelectItem>
            {businesses?.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1 border rounded-lg p-1">
          <Button 
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            Kanban
          </Button>
          <Button 
            variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className="flex-shrink-0 w-72">
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-3 w-3 rounded-full ${stage.color}`} />
              <span className="font-medium">{stage.label}</span>
              <Badge variant="secondary" className="ml-auto">
                {dealsByStage[stage.key]?.length || 0}
              </Badge>
            </div>
            
            <ScrollArea className="h-[600px]">
              <div className="space-y-3 pr-2">
                {dealsByStage[stage.key]?.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
                
                {(!dealsByStage[stage.key] || dealsByStage[stage.key]?.length === 0) && (
                  <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm">
                    No deals
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: any }) {
  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium truncate">{deal.store?.store_name || 'Unknown Store'}</p>
            <p className="text-xs text-muted-foreground">{deal.business?.name}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {deal.channel === 'call' ? (
            <Phone className="h-3 w-3 text-muted-foreground" />
          ) : deal.channel === 'sms' ? (
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
          ) : (
            <>
              <Phone className="h-3 w-3 text-muted-foreground" />
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
            </>
          )}
          <Badge variant="outline" className="text-xs">
            {deal.intent_type?.replace('_', ' ')}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="font-semibold">
              ${Number(deal.expected_value || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            {deal.probability >= 50 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span>{deal.probability}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <Badge className={riskColors[deal.risk_level] || riskColors.medium}>
            {deal.risk_level} risk
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Bot className="h-3 w-3" />
            <span>AI handling</span>
          </div>
        </div>

        {deal.delivery_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{new Date(deal.delivery_date).toLocaleDateString()}</span>
            {deal.delivery_window && (
              <Badge variant="outline" className="text-xs ml-1">
                {deal.delivery_window}
              </Badge>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Updated {formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
