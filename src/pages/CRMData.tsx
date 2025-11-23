import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Download, Upload, Database, Clock, 
  FileJson, FileSpreadsheet, Settings 
} from 'lucide-react';

const CRMData = () => {
  const navigate = useNavigate();
  const { currentBusiness, loading } = useBusiness();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading data management...</p>
        </div>
      </div>
    );
  }

  // Show message if no business selected
  if (!currentBusiness) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center max-w-md">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Business Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select a business from the switcher to access data management features.
          </p>
        </Card>
      </div>
    );
  }

  const { data: recentExports } = useQuery({
    queryKey: ['recent-exports', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data } = await supabase
        .from('crm_exports')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const { data: recentImports } = useQuery({
    queryKey: ['recent-imports', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data } = await supabase
        .from('crm_imports')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const { data: recentSnapshots } = useQuery({
    queryKey: ['recent-snapshots', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data } = await supabase
        .from('crm_snapshots')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const { data: backupSettings } = useQuery({
    queryKey: ['backup-settings', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return null;
      const { data } = await supabase
        .from('crm_backup_settings')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .single();
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Management</h1>
        <p className="text-muted-foreground mt-1">
          Export, import, backup, and restore your CRM data
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Download className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Export Data</h3>
              <p className="text-sm text-muted-foreground">
                Download your CRM data
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/crm/data/export')}
            className="w-full mt-4"
          >
            Export Now
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Upload className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Import Data</h3>
              <p className="text-sm text-muted-foreground">
                Upload CSV or JSON files
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/crm/data/import')}
            className="w-full mt-4"
          >
            Import Now
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Database className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Backup Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure automated backups
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/crm/data/backup')}
            className="w-full mt-4"
            variant="outline"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </Card>
      </div>

      {/* Backup Status */}
      {backupSettings && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Backup Status</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Auto-Export</p>
              <Badge variant={backupSettings.auto_export_enabled ? 'default' : 'secondary'}>
                {backupSettings.auto_export_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Backup</p>
              <p className="font-medium">
                {backupSettings.last_export_at 
                  ? new Date(backupSettings.last_export_at).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Backup</p>
              <p className="font-medium">
                {backupSettings.auto_export_enabled 
                  ? backupSettings.export_time || 'Not scheduled'
                  : 'Disabled'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Exports */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Exports</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/crm/data/export')}
            >
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {recentExports?.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  {exp.format === 'json' ? (
                    <FileJson className="h-4 w-4" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm capitalize">
                    {exp.export_type} Export
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(exp.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">{exp.status}</Badge>
              </div>
            ))}
            {(!recentExports || recentExports.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No exports yet
              </p>
            )}
          </div>
        </Card>

        {/* Recent Imports */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Imports</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/crm/data/import')}
            >
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {recentImports?.map((imp) => (
              <div
                key={imp.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Upload className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{imp.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(imp.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">{imp.status}</Badge>
              </div>
            ))}
            {(!recentImports || recentImports.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No imports yet
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Snapshots */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Snapshots</h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/crm/data/backup')}
          >
            View All
          </Button>
        </div>
        <div className="space-y-3">
          {recentSnapshots?.map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex items-center gap-3 p-3 rounded-lg border"
            >
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm capitalize">
                  {snapshot.snapshot_type} Snapshot
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(snapshot.created_at).toLocaleString()}
                </p>
              </div>
              <Button variant="outline" size="sm">
                Restore
              </Button>
            </div>
          ))}
          {(!recentSnapshots || recentSnapshots.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No snapshots yet
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CRMData;
