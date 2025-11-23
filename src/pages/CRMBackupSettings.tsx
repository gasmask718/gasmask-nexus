import { useState, useEffect } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Save, Database, Clock, CheckCircle2, 
  XCircle, Shield, Calendar 
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const CRMBackupSettings = () => {
  const { currentBusiness } = useBusiness();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    auto_export_enabled: false,
    export_frequency: 'daily',
    export_time: '01:00',
    storage_provider: 'local',
  });
  const [isSaving, setIsSaving] = useState(false);

  const { data: backupSettings, refetch } = useQuery({
    queryKey: ['crm-backup-settings', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return null;
      
      const { data, error } = await supabase
        .from('crm_backup_settings')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  const { data: snapshots } = useQuery({
    queryKey: ['crm-snapshots', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('crm_snapshots')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  useEffect(() => {
    if (backupSettings) {
      setSettings({
        auto_export_enabled: backupSettings.auto_export_enabled || false,
        export_frequency: backupSettings.export_frequency || 'daily',
        export_time: backupSettings.export_time || '01:00',
        storage_provider: backupSettings.storage_provider || 'local',
      });
    }
  }, [backupSettings]);

  const handleSave = async () => {
    if (!currentBusiness?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('crm_backup_settings')
        .upsert({
          business_id: currentBusiness.id,
          ...settings,
        });

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Backup settings updated successfully',
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Failed to save settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!currentBusiness?.id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all CRM data
      const [contacts, logs] = await Promise.all([
        supabase.from('crm_contacts').select('*').eq('business_id', currentBusiness.id),
        supabase.from('communication_logs').select('*').eq('business_id', currentBusiness.id),
      ]);

      const snapshotData = {
        contacts: contacts.data || [],
        communication_logs: logs.data || [],
      };

      const recordCounts = {
        contacts: contacts.data?.length || 0,
        communication_logs: logs.data?.length || 0,
      };

      const { error } = await supabase
        .from('crm_snapshots')
        .insert({
          business_id: currentBusiness.id,
          created_by: user.id,
          snapshot_type: 'manual',
          snapshot_data: snapshotData,
          record_counts: recordCounts,
        });

      if (error) throw error;

      toast({
        title: 'Snapshot created',
        description: 'CRM data snapshot saved successfully',
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Failed to create snapshot',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Backup & Recovery</h1>
        <p className="text-muted-foreground mt-1">
          Configure automatic backups and manage data snapshots
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Backup Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Automatic Backup</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Auto-Export</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically export CRM data daily
                </p>
              </div>
              <Switch
                checked={settings.auto_export_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, auto_export_enabled: checked })
                }
              />
            </div>

            {settings.auto_export_enabled && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Frequency</Label>
                  <Select
                    value={settings.export_frequency}
                    onValueChange={(value) =>
                      setSettings({ ...settings, export_frequency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Export Time</Label>
                  <Input
                    type="time"
                    value={settings.export_time}
                    onChange={(e) =>
                      setSettings({ ...settings, export_time: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Storage Provider</Label>
                  <Select
                    value={settings.storage_provider}
                    onValueChange={(value) =>
                      setSettings({ ...settings, storage_provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local Download</SelectItem>
                      <SelectItem value="email">Email Delivery</SelectItem>
                      <SelectItem value="google_drive" disabled>
                        Google Drive (Coming Soon)
                      </SelectItem>
                      <SelectItem value="dropbox" disabled>
                        Dropbox (Coming Soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {backupSettings?.last_export_at && (
              <div className="p-3 rounded-lg bg-secondary/20 border">
                <p className="text-xs text-muted-foreground">Last Export</p>
                <p className="text-sm font-medium">
                  {new Date(backupSettings.last_export_at).toLocaleString()}
                </p>
              </div>
            )}

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </Card>

        {/* Manual Snapshots */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Manual Snapshots</h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create instant backups of your CRM data that you can restore at any time
            </p>

            <Button onClick={handleCreateSnapshot} variant="outline" className="w-full">
              <Database className="mr-2 h-4 w-4" />
              Create Snapshot Now
            </Button>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Recent Snapshots</Label>
              {snapshots?.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {snapshot.snapshot_type} Snapshot
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(snapshot.created_at).toLocaleString()}
                    </p>
                    {snapshot.record_counts && (
                      <p className="text-xs text-muted-foreground">
                        {Object.values(snapshot.record_counts as Record<string, number>).reduce((a: number, b: number) => a + b, 0)} records
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {snapshot.snapshot_type}
                  </Badge>
                </div>
              ))}
              
              {(!snapshots || snapshots.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No snapshots yet
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Backup Status */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Backup Status</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">Auto-Backup</p>
            <div className="flex items-center gap-2">
              {settings.auto_export_enabled ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Enabled</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Disabled</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">Total Snapshots</p>
            <p className="text-2xl font-bold">{snapshots?.length || 0}</p>
          </div>

          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">Next Backup</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {settings.auto_export_enabled ? settings.export_time : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CRMBackupSettings;
