import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Hammer, ArrowRight, CheckCircle, Clock, Globe, Rocket } from 'lucide-react';

interface Project {
  id: string;
  client_id: string;
  project_name: string;
  package_tier: string;
  domain: string | null;
  hosting_status: string;
  ssl_status: string;
  build_status: string;
  deadline: string | null;
  launched_at: string | null;
  created_at: string;
}

const BUILD_STAGES = [
  { key: 'onboarding', label: 'Onboarding', icon: '📋' },
  { key: 'content_gathering', label: 'Content', icon: '📝' },
  { key: 'design', label: 'Design', icon: '🎨' },
  { key: 'draft_ready', label: 'Draft', icon: '📐' },
  { key: 'client_review', label: 'Review', icon: '👀' },
  { key: 'revisions', label: 'Revisions', icon: '✏️' },
  { key: 'final_approval', label: 'Approval', icon: '✅' },
  { key: 'launched', label: 'Launched', icon: '🚀' },
  { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
];

export default function ProductionPipelinePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('brandaro_projects').select('*').order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const advanceStage = async (project: Project) => {
    const currentIdx = BUILD_STAGES.findIndex(s => s.key === project.build_status);
    if (currentIdx < 0 || currentIdx >= BUILD_STAGES.length - 1) return;
    const nextStage = BUILD_STAGES[currentIdx + 1].key;
    const update: any = { build_status: nextStage, updated_at: new Date().toISOString() };
    if (nextStage === 'launched') update.launched_at = new Date().toISOString();

    await (supabase as any).from('brandaro_projects').update(update).eq('id', project.id);

    // Auto-create maintenance subscription on launch
    if (nextStage === 'launched') {
      await (supabase as any).from('brandaro_subscriptions').insert({
        client_id: project.client_id,
        project_id: project.id,
        service_type: 'maintenance',
        monthly_fee: 150,
        status: 'active',
        started_at: new Date().toISOString(),
      });

      // Also update client status
      await (supabase as any).from('brandaro_clients').update({
        client_status: 'active',
        maintenance_status: 'active',
      }).eq('id', project.client_id);
    }

    toast.success(`Advanced to ${BUILD_STAGES[currentIdx + 1].label}`);
    fetchProjects();
  };

  const stageCounts = BUILD_STAGES.map(s => ({
    ...s,
    count: projects.filter(p => p.build_status === s.key).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Production Pipeline</h1>
        <p className="text-muted-foreground">Website build projects from onboarding to launch</p>
      </div>

      {/* Pipeline Stages Overview */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {stageCounts.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <Card className={`min-w-[100px] ${s.count > 0 ? 'border-primary/30 bg-primary/5' : ''}`}>
              <CardContent className="p-3 text-center">
                <span className="text-lg">{s.icon}</span>
                <p className="text-xs font-medium mt-1">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.count}</p>
              </CardContent>
            </Card>
            {i < stageCounts.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Projects */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Hammer className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No projects in production. Accept a proposal to start a build.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => {
            const stageIdx = BUILD_STAGES.findIndex(s => s.key === project.build_status);
            const progress = Math.round(((stageIdx + 1) / BUILD_STAGES.length) * 100);
            const isLaunched = project.build_status === 'launched' || project.build_status === 'maintenance';

            return (
              <Card key={project.id} className={isLaunched ? 'border-green-500/30' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.project_name}</CardTitle>
                    <Badge variant={isLaunched ? 'default' : 'secondary'}>{project.package_tier}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{project.domain || 'No domain assigned'}</span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{BUILD_STAGES[stageIdx]?.label}</span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <span className={project.hosting_status === 'active' ? 'text-green-500' : 'text-yellow-500'}>●</span>
                      Host: {project.hosting_status}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <span className={project.ssl_status === 'active' ? 'text-green-500' : 'text-yellow-500'}>●</span>
                      SSL: {project.ssl_status}
                    </Badge>
                  </div>

                  {project.deadline && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Deadline: {new Date(project.deadline).toLocaleDateString()}
                    </div>
                  )}

                  {!isLaunched && (
                    <Button size="sm" className="w-full" onClick={() => advanceStage(project)}>
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Advance to {BUILD_STAGES[stageIdx + 1]?.label}
                    </Button>
                  )}

                  {project.launched_at && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Rocket className="h-3 w-3" />
                      Launched {new Date(project.launched_at).toLocaleDateString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
