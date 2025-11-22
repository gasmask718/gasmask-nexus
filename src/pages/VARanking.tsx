import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Star } from 'lucide-react';

const VARanking = () => {
  const { data: vas } = useQuery({
    queryKey: ['vas-ranking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vas')
        .select('*')
        .eq('status', 'active')
        .order('skill_score', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const getTierLabel = (tier: number) => {
    const labels = ['Trainee', 'Junior', 'Mid-Level', 'Senior', 'Elite'];
    return labels[tier - 1] || 'Trainee';
  };

  const getTierColor = (tier: number) => {
    if (tier >= 5) return 'bg-purple-500';
    if (tier >= 4) return 'bg-blue-500';
    if (tier >= 3) return 'bg-green-500';
    if (tier >= 2) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">VA Ranking System</h1>
          <p className="text-muted-foreground">Performance-based rankings and tier progression</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total VAs</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vas?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Elite VAs (Tier 5)</CardTitle>
              <Star className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vas?.filter(v => v.tier === 5).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vas && vas.length > 0
                  ? Math.round(vas.reduce((sum, v) => sum + (v.success_rate || 0), 0) / vas.length)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>Ranked by AI skill score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vas?.map((va, index) => (
                <div 
                  key={va.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold w-12 text-center">
                      {getRankIcon(index)}
                    </div>
                    <div>
                      <div className="font-semibold">{va.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {va.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Skill Score</div>
                      <div className="text-xl font-bold">{va.skill_score}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Success Rate</div>
                      <div className="text-xl font-bold">{Math.round(va.success_rate)}%</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Tasks</div>
                      <div className="text-xl font-bold">{va.total_tasks_completed}</div>
                    </div>

                    <Badge className={getTierColor(va.tier)}>
                      Tier {va.tier}: {getTierLabel(va.tier)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tier System</CardTitle>
            <CardDescription>How VAs progress through the ranks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { tier: 5, label: 'Elite', description: 'Top performers with 90+ AI score', color: 'bg-purple-500' },
                { tier: 4, label: 'Senior', description: 'Highly skilled with 75+ AI score', color: 'bg-blue-500' },
                { tier: 3, label: 'Mid-Level', description: 'Competent with 60+ AI score', color: 'bg-green-500' },
                { tier: 2, label: 'Junior', description: 'Developing skills with 40+ AI score', color: 'bg-yellow-500' },
                { tier: 1, label: 'Trainee', description: 'New VAs in training', color: 'bg-gray-500' },
              ].map(tier => (
                <div key={tier.tier} className="flex items-center gap-4 p-3 rounded-lg border">
                  <Badge className={tier.color}>
                    Tier {tier.tier}
                  </Badge>
                  <div className="flex-1">
                    <div className="font-semibold">{tier.label}</div>
                    <div className="text-sm text-muted-foreground">{tier.description}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {vas?.filter(v => v.tier === tier.tier).length || 0} VAs
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default VARanking;
