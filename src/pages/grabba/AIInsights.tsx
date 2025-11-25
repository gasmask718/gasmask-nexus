import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, AlertCircle, Lightbulb, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const brandColors = {
  GasMask: { primary: '#D30000', name: 'GasMask' },
  HotMama: { primary: '#B76E79', name: 'HotMama' },
  GrabbaRUs: { primary: '#FFD400', name: 'Grabba R Us' },
  HotScalati: { primary: '#5A3A2E', name: 'Hot Scalati' }
};

export default function AIInsights() {
  const { data: insights } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_ai_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Insights & Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Cross-brand intelligence and optimization recommendations
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Brain className="w-8 h-8 mb-2 text-primary" />
            <div className="text-2xl font-bold">{insights?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Active Insights</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Target className="w-8 h-8 mb-2 text-green-600" />
            <div className="text-2xl font-bold">24</div>
            <div className="text-sm text-muted-foreground">Opportunities</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <AlertCircle className="w-8 h-8 mb-2 text-orange-600" />
            <div className="text-2xl font-bold">7</div>
            <div className="text-sm text-muted-foreground">Alerts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <TrendingUp className="w-8 h-8 mb-2 text-blue-600" />
            <div className="text-2xl font-bold">$18.2K</div>
            <div className="text-sm text-muted-foreground">Potential Revenue</div>
          </CardContent>
        </Card>
      </div>

      {/* Brand Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(brandColors).map(([brand, config]) => (
              <div
                key={brand}
                className="p-4 rounded-lg border"
                style={{ borderLeft: `4px solid ${config.primary}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{config.name}</h3>
                  <Badge style={{ backgroundColor: config.primary, color: 'white' }}>
                    Active
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Order Value</span>
                    <span className="font-medium">$247</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reorder Rate</span>
                    <span className="font-medium">68%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Growth</span>
                    <span className="font-medium text-green-600">+12%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-600" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <p className="font-medium mb-1">Cross-Brand Bundle Opportunity</p>
                <p className="text-sm text-muted-foreground">
                  15 stores buy GasMask + HotMama. Create a combo deal to increase basket size by 25%.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-green-600 mt-1" />
              <div>
                <p className="font-medium mb-1">Reactivation Campaign</p>
                <p className="text-sm text-muted-foreground">
                  23 stores inactive 30+ days. AI-generated outreach could recover $4.2K in revenue.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-1" />
              <div>
                <p className="font-medium mb-1">Delivery Route Optimization</p>
                <p className="text-sm text-muted-foreground">
                  Brooklyn routes can be consolidated. Save 2.5 hours and $180/week in delivery costs.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <p className="font-medium mb-1">Loyalty Tier Upgrade</p>
                <p className="text-sm text-muted-foreground">
                  8 Gold tier stores qualify for VIP. Offering upgrade could increase retention by 40%.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Insights */}
      {insights && insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent AI-Generated Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.slice(0, 5).map((insight) => (
                <div key={insight.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{insight.insight_type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(insight.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {typeof insight.insight_data === 'string' 
                      ? insight.insight_data 
                      : JSON.stringify(insight.insight_data)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
