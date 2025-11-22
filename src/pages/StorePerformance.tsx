import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Award, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const StorePerformance = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);

  const { data: stores, isLoading, refetch } = useQuery({
    queryKey: ['store-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('status', 'active')
        .order('performance_score', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: snapshots } = useQuery({
    queryKey: ['performance-snapshots-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_performance_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  const runEngine = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('store-performance-engine');
      
      if (error) throw error;
      
      toast({
        title: 'Performance Analysis Complete',
        description: `Analyzed ${data?.processed || 0} stores`,
      });
      
      refetch();
    } catch (error) {
      console.error('Engine error:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getTierBadge = (tier: string) => {
    const variants: Record<string, any> = {
      'Platinum': 'default',
      'Gold': 'secondary',
      'Silver': 'outline',
      'Standard': 'outline',
      'At-Risk': 'destructive',
    };
    return <Badge variant={variants[tier] || 'outline'}>{tier}</Badge>;
  };

  const getTierCount = (tier: string) => {
    return stores?.filter(s => s.performance_tier === tier).length || 0;
  };

  const topPerformers = stores?.slice(0, 10) || [];
  const atRiskStores = stores?.filter(s => s.performance_tier === 'At-Risk').slice(0, 10) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Store Performance Engine</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered analytics and intelligence for all active stores
          </p>
        </div>
        <Button onClick={runEngine} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Analysis...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Performance Engine
            </>
          )}
        </Button>
      </div>

      {/* Tier Breakdown */}
      <div className="grid gap-4 md:grid-cols-5">
        {['Platinum', 'Gold', 'Silver', 'Standard', 'At-Risk'].map(tier => (
          <Card key={tier} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{tier}</p>
                <p className="text-2xl font-bold">{getTierCount(tier)}</p>
              </div>
              {tier === 'Platinum' && <Award className="h-8 w-8 text-yellow-500" />}
              {tier === 'At-Risk' && <AlertTriangle className="h-8 w-8 text-destructive" />}
            </div>
          </Card>
        ))}
      </div>

      {/* Top Performers */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <h2 className="text-xl font-bold">Top 10 Performers</h2>
        </div>
        <div className="space-y-3">
          {topPerformers.map((store, index) => (
            <div
              key={store.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-secondary/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/stores/${store.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{store.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {store.address_city}, {store.address_state}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Performance Score</p>
                  <p className="font-bold">{store.performance_score}/100</p>
                </div>
                {getTierBadge(store.performance_tier)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* At-Risk Stores */}
      {atRiskStores.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold">At-Risk Stores</h2>
          </div>
          <div className="space-y-3">
            {atRiskStores.map((store) => {
              const snapshot = snapshots?.find(s => s.store_id === store.id);
              return (
                <div
                  key={store.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 hover:bg-destructive/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/stores/${store.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">{store.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {store.address_city}, {store.address_state}
                      </p>
                      {snapshot?.ai_recommendation && (
                        <p className="text-sm text-destructive mt-1">
                          {snapshot.ai_recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Risk Score</p>
                      <p className="font-bold text-destructive">
                        {snapshot?.risk_score || 0}/100
                      </p>
                    </div>
                    {getTierBadge(store.performance_tier)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default StorePerformance;