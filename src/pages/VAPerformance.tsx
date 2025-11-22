import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Calendar, FileText, TrendingUp, Award } from 'lucide-react';

const VAPerformance = () => {
  const { data: vas } = useQuery({
    queryKey: ['vas-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vas')
        .select('*')
        .order('tier', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: recentMetrics } = useQuery({
    queryKey: ['va-recent-metrics'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('va_performance_metrics')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const getTierColor = (tier: number) => {
    if (tier >= 5) return 'bg-purple-500';
    if (tier >= 4) return 'bg-blue-500';
    if (tier >= 3) return 'bg-green-500';
    if (tier >= 2) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getVAMetrics = (vaId: string) => {
    const metrics = recentMetrics?.filter(m => m.va_id === vaId) || [];
    return {
      callAttempts: metrics.reduce((sum, m) => sum + (m.call_attempts || 0), 0),
      contactsMade: metrics.reduce((sum, m) => sum + (m.contacts_made || 0), 0),
      conversations: metrics.reduce((sum, m) => sum + (m.conversations || 0), 0),
      appointments: metrics.reduce((sum, m) => sum + (m.appointments_set || 0), 0),
      contracts: metrics.reduce((sum, m) => sum + (m.contracts_signed || 0), 0),
    };
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">VA Performance Dashboard</h1>
          <p className="text-muted-foreground">Track performance metrics across your virtual assistant team</p>
        </div>

        <div className="grid gap-6">
          {vas?.map(va => {
            const metrics = getVAMetrics(va.id);
            const contactRate = metrics.callAttempts > 0 
              ? Math.round((metrics.contactsMade / metrics.callAttempts) * 100) 
              : 0;

            return (
              <Card key={va.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {va.name}
                        <Badge className={getTierColor(va.tier)}>
                          Tier {va.tier}
                        </Badge>
                        {va.tier >= 4 && <Award className="h-5 w-5 text-yellow-500" />}
                      </CardTitle>
                      <CardDescription>{va.email}</CardDescription>
                    </div>
                    <Badge variant={va.status === 'active' ? 'default' : 'secondary'}>
                      {va.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        Call Attempts
                      </div>
                      <div className="text-2xl font-bold">{metrics.callAttempts}</div>
                      <div className="text-xs text-muted-foreground">
                        {contactRate}% contact rate
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        Conversations
                      </div>
                      <div className="text-2xl font-bold">{metrics.conversations}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Appointments
                      </div>
                      <div className="text-2xl font-bold">{metrics.appointments}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        Contracts
                      </div>
                      <div className="text-2xl font-bold">{metrics.contracts}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Success Rate
                      </div>
                      <div className="text-2xl font-bold">{Math.round(va.success_rate)}%</div>
                      <div className="text-xs text-muted-foreground">
                        Score: {va.skill_score}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default VAPerformance;
