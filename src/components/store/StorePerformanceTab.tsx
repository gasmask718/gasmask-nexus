import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, Activity, MessageSquare, Package, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StorePerformanceTabProps {
  storeId: string;
  storeName: string;
}

export const StorePerformanceTab = ({ storeId, storeName }: StorePerformanceTabProps) => {
  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store-performance-data', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ['store-performance-snapshots', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_performance_snapshots')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true })
        .limit(30);
      
      if (error) throw error;
      return data;
    },
  });

  if (storeLoading || snapshotsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const latestSnapshot = snapshots?.[snapshots.length - 1];
  const performanceScore = store?.performance_score || 50;
  const riskScore = latestSnapshot?.risk_score || 0;

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      'Platinum': 'text-yellow-500',
      'Gold': 'text-yellow-600',
      'Silver': 'text-gray-400',
      'Standard': 'text-blue-500',
      'At-Risk': 'text-destructive',
    };
    return colors[tier] || 'text-muted-foreground';
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

  const chartData = snapshots?.map(s => ({
    date: new Date(s.created_at).toLocaleDateString(),
    sales: s.daily_sales,
    visits: s.driver_visit_count,
    communication: s.communication_score,
    performance: s.performance_score,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Performance Tier</p>
              <p className={`text-2xl font-bold ${getTierColor(store?.performance_tier)}`}>
                {store?.performance_tier || 'Standard'}
              </p>
            </div>
            {getTierBadge(store?.performance_tier)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Health Score</p>
              <p className="text-2xl font-bold">{performanceScore}/100</p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Risk Score</p>
              <p className="text-2xl font-bold text-destructive">{riskScore}/100</p>
            </div>
            {riskScore > 50 ? (
              <TrendingDown className="h-8 w-8 text-destructive" />
            ) : (
              <TrendingUp className="h-8 w-8 text-green-500" />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Sales</p>
              <p className="text-2xl font-bold">
                ${latestSnapshot?.monthly_sales || 0}
              </p>
            </div>
            <Package className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* AI Recommendation */}
      {latestSnapshot?.ai_recommendation && (
        <Card className="p-6 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">AI Recommendation</h3>
              <p className="text-sm text-muted-foreground">
                {latestSnapshot.ai_recommendation}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">30-Day Performance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="performance" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Performance Score"
              />
              <Line 
                type="monotone" 
                dataKey="communication" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                name="Communication Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Sell-Through Rate</p>
              <p className="text-xl font-bold">
                {latestSnapshot?.sell_through_rate || 0}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Driver Visits (30d)</p>
              <p className="text-xl font-bold">
                {latestSnapshot?.driver_visit_count || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Communication Score</p>
              <p className="text-xl font-bold">
                {latestSnapshot?.communication_score || 0}/100
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button>
            <Package className="mr-2 h-4 w-4" />
            Send Restock
          </Button>
          <Button variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Schedule Driver Visit
          </Button>
          <Button variant="outline">
            <MessageSquare className="mr-2 h-4 w-4" />
            Send Follow-Up Message
          </Button>
          <Button variant="outline">
            Mark as High Priority
          </Button>
        </div>
      </Card>
    </div>
  );
};