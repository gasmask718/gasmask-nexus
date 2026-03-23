import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cloud,
  Download,
  FolderOpen,
  Loader2,
  CheckCircle,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { FLOOR_EXPORT_CONFIGS } from '@/config/floorExportConfig';

interface BackupResult {
  floor: string;
  success: boolean;
  files: number;
  error?: string;
}

interface FloorBackupStatus {
  floorId: string;
  loading: boolean;
  result: { filesUploaded: string[]; totalRecords: number; monthFolder: string } | null;
  error: string | null;
}

export default function BackupControlPage() {
  const [floorStatuses, setFloorStatuses] = useState<Record<string, FloorBackupStatus>>({});
  const [backingUpAll, setBackingUpAll] = useState(false);
  const [allResults, setAllResults] = useState<BackupResult[] | null>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string; createdTime: string }>>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const floorIdMap: Record<string, string> = {
    'grabba-command': 'command',
    'floor-1-crm': 'floor-1',
    'floor-2-communication': 'floor-2',
    'floor-3-inventory': 'floor-3',
    'floor-4-delivery': 'floor-4',
    'floor-5-orders': 'floor-5',
    'floor-6-production': 'floor-6',
    'floor-7-wholesale': 'floor-7',
    'floor-8-ambassadors': 'floor-8',
    'floor-9-ai': 'floor-9',
  };

  async function backupFloor(config: typeof FLOOR_EXPORT_CONFIGS[0]) {
    const edgeFloorId = floorIdMap[config.floorId] || config.floorId;

    setFloorStatuses(prev => ({
      ...prev,
      [config.floorId]: { floorId: config.floorId, loading: true, result: null, error: null },
    }));

    try {
      const { data, error } = await supabase.functions.invoke('gdrive-backup', {
        body: { action: 'backup-floor', floorId: edgeFloorId },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Backup failed');

      setFloorStatuses(prev => ({
        ...prev,
        [config.floorId]: {
          floorId: config.floorId,
          loading: false,
          result: data,
          error: null,
        },
      }));

      toast.success(`${config.name} backed up`, {
        description: `${data.filesUploaded?.length || 0} files → ${data.monthFolder}`,
      });
    } catch (err: any) {
      setFloorStatuses(prev => ({
        ...prev,
        [config.floorId]: { floorId: config.floorId, loading: false, result: null, error: err.message },
      }));
      toast.error(`Backup failed: ${config.name}`, { description: err.message });
    }
  }

  async function backupAll() {
    setBackingUpAll(true);
    setAllResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('gdrive-backup', {
        body: { action: 'backup-all' },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Full backup failed');

      setAllResults(data.results || []);
      const succeeded = (data.results || []).filter((r: BackupResult) => r.success).length;
      toast.success(`Full backup complete`, {
        description: `${succeeded}/${FLOOR_EXPORT_CONFIGS.length} floors backed up → ${data.monthFolder}`,
      });
    } catch (err: any) {
      toast.error('Full backup failed', { description: err.message });
    } finally {
      setBackingUpAll(false);
    }
  }

  async function loadFolders() {
    setLoadingFolders(true);
    try {
      const { data, error } = await supabase.functions.invoke('gdrive-backup', {
        body: { action: 'list-folders' },
      });
      if (error) throw new Error(error.message);
      setFolders(data.folders || []);
    } catch (err: any) {
      toast.error('Failed to load folders', { description: err.message });
    } finally {
      setLoadingFolders(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-7 w-7 text-primary" />
            Google Drive Backup Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Back up all floor data to Google Drive · Organized by month · gasmaskapprovedllc@gmail.com
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadFolders} disabled={loadingFolders}>
            <FolderOpen className={`h-4 w-4 mr-1 ${loadingFolders ? 'animate-spin' : ''}`} />
            View Folders
          </Button>
          <Button onClick={backupAll} disabled={backingUpAll} className="gap-2">
            {backingUpAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
            Backup All Floors
          </Button>
        </div>
      </div>

      {/* Drive Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Connected to Google Drive</p>
              <p className="text-xs text-muted-foreground">gasmaskapprovedllc@gmail.com</p>
            </div>
            <Badge variant="secondary" className="ml-auto text-xs">
              Dynasty OS Backups / [Month Year] / [Floor Name]
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Full backup results */}
      {allResults && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Full Backup Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {allResults.map((r, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border text-xs ${
                    r.success ? 'bg-green-500/10 border-green-500/20' : 'bg-destructive/10 border-destructive/20'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {r.success ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                    )}
                    <span className="font-medium truncate">{r.floor}</span>
                  </div>
                  {r.error && <p className="text-destructive mt-1 truncate">{r.error}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing folders in Drive */}
      {folders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              Monthly Backup Folders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {folders.map((f) => (
                <Badge key={f.id} variant="outline" className="gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {f.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Per-Floor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FLOOR_EXPORT_CONFIGS.map((config) => {
          const status = floorStatuses[config.floorId];
          return (
            <Card key={config.floorId} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-xl">{config.emoji}</span>
                    {config.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {config.tables.length} tables
                  </Badge>
                </div>
                <CardDescription className="text-xs">{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Table list */}
                <div className="flex flex-wrap gap-1">
                  {config.tables.map((t) => (
                    <Badge key={t.table} variant="secondary" className="text-[10px] font-mono">
                      {t.table}
                    </Badge>
                  ))}
                </div>

                {/* Status */}
                {status?.result && (
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs space-y-1">
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle className="h-3 w-3" />
                      Backed up to {status.result.monthFolder}
                    </div>
                    <p className="text-muted-foreground">
                      {status.result.totalRecords?.toLocaleString()} records · {status.result.filesUploaded?.length} files
                    </p>
                  </div>
                )}

                {status?.error && (
                  <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
                    <div className="flex items-center gap-1 text-destructive font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {status.error}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => backupFloor(config)}
                    disabled={status?.loading || backingUpAll}
                  >
                    {status?.loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5" />
                    )}
                    {status?.loading ? 'Backing up...' : 'Backup to Drive'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(config.path, '_blank')}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
