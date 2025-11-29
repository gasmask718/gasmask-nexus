import { ClipboardList, Database, Users, Package, MessageSquare, ArrowRight, Upload, Bot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import PortalLayout from '@/components/portal/PortalLayout';
import { PermissionGate } from '@/components/portal/PermissionGate';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useTranslation } from '@/hooks/useTranslation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function VAPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const vaProfile = profileData?.roleProfile as any;
  const { t } = useTranslation();

  // Fetch pending tasks from AI Workforce
  const { data: pendingTasks } = useQuery({
    queryKey: ['vaTasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_work_tasks')
        .select('*')
        .in('department', ['Global OS', 'Sales / CRM'])
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    }
  });

  const quickLinks = [
    { title: t('va.store_editor'), description: 'Manage store records', icon: Users, path: '/grabba/store-master', permission: 'edit_store' as const },
    { title: t('nav.inventory'), description: 'Check stock levels', icon: Package, path: '/grabba/inventory', permission: 'crm_access' as const },
    { title: t('va.assign_tasks'), description: 'View AI tasks', icon: Bot, path: '/ai/workforce', permission: 'assign_tasks' as const },
    { title: t('nav.orders'), description: 'Message center', icon: MessageSquare, path: '/grabba/communications', permission: 'crm_access' as const },
  ];

  return (
    <PortalLayout title={t('va.title')}>
      <div className="space-y-6">
        {/* VA Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{profileData?.profile?.full_name || 'Virtual Assistant'}</h2>
                <p className="text-muted-foreground">{vaProfile?.label || 'VA'}</p>
                <Badge variant="secondary">{vaProfile?.permissions_bundle || 'standard'} access</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Tasks</CardDescription>
              <CardTitle className="text-3xl">{pendingTasks?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed Today</CardDescription>
              <CardTitle className="text-3xl">12</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Alerts</CardDescription>
              <CardTitle className="text-3xl text-yellow-500">3</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Stores Updated</CardDescription>
              <CardTitle className="text-3xl">47</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Task List */}
        <PermissionGate permission="assign_tasks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Assigned Tasks
                  </CardTitle>
                  <CardDescription>Tasks from the AI workforce system</CardDescription>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/ai/workforce">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pendingTasks && pendingTasks.length > 0 ? (
                <div className="space-y-3">
                  {pendingTasks.map((task: any) => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{task.task_title}</p>
                        <p className="text-sm text-muted-foreground">{task.department}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          task.priority === 'critical' ? 'destructive' :
                          task.priority === 'high' ? 'secondary' : 'outline'
                        }>
                          {task.priority}
                        </Badge>
                        <Button size="sm">Start</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">{t('no_data')}</p>
              )}
            </CardContent>
          </Card>
        </PermissionGate>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>{t('va.crm_dashboard')}</CardTitle>
            <CardDescription>Quick access to common VA tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <PermissionGate key={link.path} permission={link.permission}>
                  <Link to={link.path}>
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:border-primary transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <link.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{link.title}</p>
                          <p className="text-sm text-muted-foreground">{link.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </PermissionGate>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upload Excel & Contact Editor */}
        <div className="grid gap-4 sm:grid-cols-2">
          <PermissionGate permission="upload_docs">
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t('va.upload_excel')}</p>
                  <p className="text-sm text-muted-foreground">Bulk import store data</p>
                </div>
              </CardContent>
            </Card>
          </PermissionGate>
          <PermissionGate permission="edit_contact">
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t('va.contact_editor')}</p>
                  <p className="text-sm text-muted-foreground">Manage contacts & leads</p>
                </div>
              </CardContent>
            </Card>
          </PermissionGate>
        </div>

        {/* Internal Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
            <CardDescription>Instructions and guidelines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">{t('welcome')} to the VA Portal</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check the task queue regularly for new assignments</li>
                <li>Update store records when you receive new information</li>
                <li>Flag any issues or anomalies to the admin team</li>
                <li>Use the AI workforce system for automated task handling</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
