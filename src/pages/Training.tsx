import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, CheckCircle2, Lock, Play, Award } from 'lucide-react';
import { toast } from 'sonner';

const Training = () => {
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<any>(null);

  const { data: modules } = useQuery({
    queryKey: ['training-modules', userRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_modules')
        .select('*')
        .or(`required_for_role.eq.${userRole},required_for_role.is.null`)
        .order('order_index');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: completions } = useQuery({
    queryKey: ['training-completions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('training_completions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: userBadges } = useQuery({
    queryKey: ['user-badges'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_badges')
        .select('*, training_badges(*)')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data;
    },
  });

  const completeModule = useMutation({
    mutationFn: async (moduleId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('training_completions')
        .insert({
          user_id: user.id,
          module_id: moduleId,
          time_spent_minutes: 10, // Placeholder
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-completions'] });
      queryClient.invalidateQueries({ queryKey: ['user-badges'] });
      toast.success('Module completed! XP awarded.');
      setSelectedModule(null);
    },
  });

  const isCompleted = (moduleId: string) => {
    return completions?.some(c => c.module_id === moduleId);
  };

  const completionRate = modules && completions 
    ? (completions.length / modules.length) * 100 
    : 0;

  const categories = [...new Set(modules?.map(m => m.category) || [])];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">GasMask University</h1>
          <p className="text-muted-foreground">Complete training modules to level up your skills</p>
        </div>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Progress</span>
              <Trophy className="h-6 w-6 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Overall Completion</span>
                <span className="text-sm text-muted-foreground">
                  {completions?.length || 0} / {modules?.length || 0} modules
                </span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>

            {/* Badges */}
            {userBadges && userBadges.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Earned Badges</h4>
                <div className="flex flex-wrap gap-2">
                  {userBadges.map((ub: any) => (
                    <Badge key={ub.id} variant="secondary" className="flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {ub.training_badges.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Modules */}
        <Tabs defaultValue={categories[0]} className="space-y-4">
          <TabsList>
            {categories.map(category => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map(category => (
            <TabsContent key={category} value={category} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modules
                  ?.filter(m => m.category === category)
                  .map(module => {
                    const completed = isCompleted(module.id);
                    
                    return (
                      <Card 
                        key={module.id} 
                        className={completed ? 'border-primary/50 bg-primary/5' : ''}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                {module.title}
                                {completed && (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                )}
                                {module.is_required && !completed && (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                )}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {module.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">XP Reward</span>
                              <Badge variant="outline">{module.xp_reward} XP</Badge>
                            </div>
                            
                            {module.is_required && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}

                            {completed ? (
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => setSelectedModule(module)}
                              >
                                Review Module
                              </Button>
                            ) : (
                              <Button 
                                className="w-full"
                                onClick={() => setSelectedModule(module)}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Start Module
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Module Viewer Modal */}
        {selectedModule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto m-4">
              <CardHeader>
                <CardTitle>{selectedModule.title}</CardTitle>
                <CardDescription>{selectedModule.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedModule.video_url && (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Play className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedModule.content || 'Training content will be displayed here.'}
                </div>

                <div className="flex gap-2">
                  {!isCompleted(selectedModule.id) && (
                    <Button
                      onClick={() => completeModule.mutate(selectedModule.id)}
                      disabled={completeModule.isPending}
                    >
                      Complete Module
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setSelectedModule(null)}
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Training;