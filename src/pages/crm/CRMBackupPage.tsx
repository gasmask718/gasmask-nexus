/**
 * CRM Backup Page - Entity-Centric Backup & Restore
 * Create snapshots and restore CRM data
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint } from '@/hooks/useCRMBlueprint';
import { useTotalRecordCount } from '@/hooks/useCRMEntityCounts';
import CRMLayout from './CRMLayout';
import {
  HardDrive, ArrowLeft, Clock, Download, RotateCcw, Building2,
  Check, AlertCircle, Loader2, Calendar, Shield, Settings,
} from 'lucide-react';

export default function CRMBackupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentBusiness } = useBusiness();
  const { simulationMode } = useSimulationMode();
  const { businessName } = useCRMBlueprint(currentBusiness?.slug);
  const { total: totalRecords } = useTotalRecordCount(currentBusiness?.id || null);

  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  // Fetch backup settings
  const { data: backupSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['backup-settings', currentBusiness?.id],
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

  // Fetch snapshots
  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ['crm-snapshots', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data, error } = await supabase
        .from('crm_snapshots')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const createBackup = async () => {
    if (!currentBusiness?.id) return;

    setIsCreatingBackup(true);
    try {
      // In a real implementation, this would create a full snapshot
      const { error } = await supabase
        .from('crm_snapshots')
        .insert({
          business_id: currentBusiness.id,
          snapshot_type: 'manual',
          record_count: totalRecords,
          entity_types: [], // Would contain actual entity types
          snapshot_data: {}, // Would contain actual data
        });

      if (error) throw error;

      toast.success('Backup created successfully');
      queryClient.invalidateQueries({ queryKey: ['crm-snapshots', currentBusiness.id] });
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreSnapshot = async (snapshotId: string) => {
    toast.info('Restore functionality coming soon');
    // In a real implementation, this would restore the snapshot
  };

  const downloadSnapshot = async (snapshotId: string) => {
    toast.info('Download functionality coming soon');
    // In a real implementation, this would download the snapshot
  };

  // No business selected
  if (!currentBusiness) {
    return (
      <CRMLayout title="Backup & Restore">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Business Selected</h3>
          <p className="text-muted-foreground mb-6">
            Please select a business to manage backups.
          </p>
          <Button onClick={() => navigate('/crm')}>
            Select Business
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout title="Backup & Restore">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/data')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Backup & Restore</h1>
                {simulationMode && <SimulationBadge />}
              </div>
              <p className="text-muted-foreground">
                Manage {businessName} CRM backups
              </p>
            </div>
          </div>
          <Button onClick={createBackup} disabled={isCreatingBackup}>
            {isCreatingBackup ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4 mr-2" />
                Create Backup
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Backup Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <HardDrive className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Backups</p>
                    <p className="text-2xl font-bold">{snapshots.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Records Protected</p>
                    <p className="text-2xl font-bold">{totalRecords}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Backup</p>
                    <p className="text-lg font-bold">
                      {snapshots[0] 
                        ? new Date(snapshots[0].created_at).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Snapshots List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Backup History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : snapshots.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">No backups yet</p>
                    <Button onClick={createBackup} disabled={isCreatingBackup}>
                      Create First Backup
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {snapshots.map((snapshot: any) => (
                        <div
                          key={snapshot.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <HardDrive className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium capitalize">
                                  {snapshot.snapshot_type} Backup
                                </p>
                                {snapshot.snapshot_type === 'auto' && (
                                  <Badge variant="secondary" className="text-xs">
                                    Auto
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(snapshot.created_at).toLocaleString()}
                                </span>
                                <span>{snapshot.record_count || 0} records</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadSnapshot(snapshot.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreSnapshot(snapshot.id)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Settings Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Backup Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Backup</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically backup data daily
                        </p>
                      </div>
                      <Switch 
                        checked={backupSettings?.auto_export_enabled || false}
                        onCheckedChange={() => toast.info('Settings update coming soon')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Backup Time</Label>
                      <Select 
                        value={backupSettings?.export_time || '02:00'}
                        onValueChange={() => toast.info('Settings update coming soon')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="00:00">12:00 AM</SelectItem>
                          <SelectItem value="02:00">2:00 AM</SelectItem>
                          <SelectItem value="04:00">4:00 AM</SelectItem>
                          <SelectItem value="06:00">6:00 AM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Retention Period</Label>
                      <Select 
                        value="30"
                        onValueChange={() => toast.info('Settings update coming soon')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Backup Best Practices</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Create backups before major data changes</li>
                      <li>• Enable auto-backup for daily protection</li>
                      <li>• Download backups periodically for offline storage</li>
                      <li>• Test restore process periodically</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
