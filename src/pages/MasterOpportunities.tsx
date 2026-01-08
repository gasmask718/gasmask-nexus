import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Target, 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  User, 
  Clock, 
  Search,
  Filter,
  Store,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface StoreOpportunity {
  id: string;
  store_id: string;
  opportunity_text: string;
  is_completed: boolean;
  source: 'manual' | 'ai_extracted';
  detected_from_note_id: string | null;
  detected_from_interaction_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    store_name: string;
  } | null;
}

type FilterType = 'all' | 'pending' | 'completed';

export default function MasterOpportunities() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'ai_extracted'>('all');

  // Fetch all opportunities from all stores
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['master-opportunities', filter, sourceFilter],
    queryFn: async () => {
      let query = supabase
        .from('store_opportunities')
        .select(`
          *,
          store:store_master(id, store_name)
        `)
        .order('created_at', { ascending: false});

      // Apply completion filter
      if (filter === 'pending') {
        query = query.eq('is_completed', false);
      } else if (filter === 'completed') {
        query = query.eq('is_completed', true);
      }

      // Apply source filter
      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as StoreOpportunity[]) || [];
    },
  });

  // Filter by search query
  const filteredOpportunities = opportunities?.filter((opp) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      opp.opportunity_text.toLowerCase().includes(query) ||
      (opp.store?.store_name || '').toLowerCase().includes(query)
    );
  }) || [];

  // Mutation to toggle completion status
  const toggleCompletion = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const updateData: any = {
        is_completed: !isCompleted,
      };

      if (!isCompleted) {
        // Marking as completed
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id;
      } else {
        // Marking as incomplete
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      const { error } = await supabase
        .from('store_opportunities')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-opportunities'] });
      toast.success('Opportunity updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update opportunity: ' + error.message);
    },
  });

  const handleToggleCompletion = (opportunity: StoreOpportunity) => {
    toggleCompletion.mutate({
      id: opportunity.id,
      isCompleted: opportunity.is_completed,
    });
  };

  const handleViewStore = (storeId: string) => {
    navigate(`/stores/${storeId}`);
  };

  // Statistics
  const totalOpportunities = opportunities?.length || 0;
  const pendingCount = opportunities?.filter((opp) => !opp.is_completed).length || 0;
  const completedCount = opportunities?.filter((opp) => opp.is_completed).length || 0;
  const aiExtractedCount = opportunities?.filter((opp) => opp.source === 'ai_extracted').length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            All Opportunities
          </h1>
          <p className="text-muted-foreground mt-2">
            Master list of all opportunities from every store
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalOpportunities}</p>
              </div>
              <Target className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className="text-2xl font-bold text-orange-500">{pendingCount}</p>
              </div>
              <Circle className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-500">{completedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Detected</p>
                <p className="text-2xl font-bold text-blue-500">{aiExtractedCount}</p>
              </div>
              <Sparkles className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search opportunities or store names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Needs Attention</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="ai_extracted">AI Detected</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities List */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Opportunities ({filteredOpportunities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOpportunities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No opportunities found</p>
              <p className="text-sm mt-1">
                {searchQuery || filter !== 'all' || sourceFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Opportunities will appear here when detected'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOpportunities.map((opportunity) => (
                <OpportunityItem
                  key={opportunity.id}
                  opportunity={opportunity}
                  onToggle={() => handleToggleCompletion(opportunity)}
                  onViewStore={() => handleViewStore(opportunity.store_id)}
                  isToggling={toggleCompletion.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface OpportunityItemProps {
  opportunity: StoreOpportunity;
  onToggle: () => void;
  onViewStore: () => void;
  isToggling: boolean;
}

function OpportunityItem({ opportunity, onToggle, onViewStore, isToggling }: OpportunityItemProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
      <Checkbox
        checked={opportunity.is_completed}
        onCheckedChange={onToggle}
        disabled={isToggling}
        className="mt-1 h-6 w-6 border-2"
      />
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className={`text-base font-medium ${opportunity.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {opportunity.opportunity_text}
            </p>
            {opportunity.store && (
              <div className="flex items-center gap-2 mt-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{opportunity.store.store_name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewStore}
                  className="h-6 px-2 text-xs"
                >
                  View Store
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            variant={opportunity.source === 'ai_extracted' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {opportunity.source === 'ai_extracted' ? (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                AI Detected
              </>
            ) : (
              <>
                <User className="h-3 w-3 mr-1" />
                Manual
              </>
            )}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Created {format(new Date(opportunity.created_at), 'MMM d, yyyy')}</span>
          </div>
          {opportunity.is_completed && opportunity.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Completed {format(new Date(opportunity.completed_at), 'MMM d, yyyy')}</span>
            </div>
          )}
          {!opportunity.is_completed && (
            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
              Needs Attention
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

