import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Store, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  Package,
  Users
} from 'lucide-react';

interface Stats {
  activeStores: number;
  totalStores: number;
  totalProducts: number;
  activeRoutes: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    activeStores: 0,
    totalStores: 0,
    totalProducts: 0,
    activeRoutes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [storesRes, productsRes, routesRes] = await Promise.all([
          supabase.from('stores').select('id, status', { count: 'exact' }),
          supabase.from('products').select('id', { count: 'exact' }),
          supabase.from('routes').select('id', { count: 'exact' })
        ]);

        const activeStores = storesRes.data?.filter(s => s.status === 'active').length || 0;
        
        setStats({
          activeStores,
          totalStores: storesRes.count || 0,
          totalProducts: productsRes.count || 0,
          activeRoutes: routesRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Active Stores',
      value: stats.activeStores,
      total: stats.totalStores,
      icon: Store,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Active Routes',
      value: stats.activeRoutes,
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Revenue (Est)',
      value: '$0',
      icon: DollarSign,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Command Center</h2>
        <p className="text-muted-foreground">
          Real-time operations dashboard for GasMask Universe
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card
            key={stat.title}
            className="glass-card border-border/50 hover-lift hover-glow"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bgColor} p-2 rounded-lg`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
                {stat.total !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    of {stat.total} total
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No stores require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent activity
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
