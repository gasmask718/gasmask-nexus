import { useModules } from '@/hooks/useModules';
import { useDatabaseDiagnostics } from '@/hooks/useDatabaseDiagnostics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Package, Route, LayoutGrid, Database, AlertTriangle, Download, Cloud } from 'lucide-react';
import { exportToDropbox } from '@/services/dropboxExportService';
import { useDataExport } from '@/hooks/useDataExport';
import { toast } from 'sonner';
import { useState } from 'react';

/**
 * ModuleDiagnostics - Section 6.3 Enhanced Diagnostics
 * Shows modules, routes, sidebar items, table overview, index count, warnings
 */
export function ModuleDiagnostics() {
  const { diagnostics, allModules } = useModules();
  const { data: dbDiagnostics, isLoading: dbLoading } = useDatabaseDiagnostics();
  const { exportAll, isExporting } = useDataExport();
  const [cloudExporting, setCloudExporting] = useState(false);

  const handleCloudExport = async () => {
    setCloudExporting(true);
    const result = await exportToDropbox();
    setCloudExporting(false);
    
    if (result.success) {
      toast.success('Exported to Dropbox successfully');
    } else {
      toast.error(result.error || 'Failed to export to Dropbox');
    }
  };

  const handleExcelExport = async () => {
    await exportAll();
    toast.success('Excel export complete');
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{diagnostics.totalModules}</p>
                <p className="text-sm text-muted-foreground">Modules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{diagnostics.enabledModules}</p>
                <p className="text-sm text-muted-foreground">Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Route className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{diagnostics.totalRoutes}</p>
                <p className="text-sm text-muted-foreground">Routes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{diagnostics.totalSidebarItems}</p>
                <p className="text-sm text-muted-foreground">Sidebar Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-cyan-500" />
              <div>
                <p className="text-2xl font-bold">{dbDiagnostics?.indexes.length ?? '-'}</p>
                <p className="text-sm text-muted-foreground">Indexes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {dbDiagnostics?.warnings && dbDiagnostics.warnings.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Warnings ({dbDiagnostics.warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {dbDiagnostics.warnings.map((warning, i) => (
                <li key={i} className="text-amber-700">{warning}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Backup & Export</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={handleExcelExport} disabled={isExporting} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
          <Button onClick={handleCloudExport} disabled={cloudExporting} variant="outline">
            <Cloud className="h-4 w-4 mr-2" />
            {cloudExporting ? 'Uploading...' : 'Export to Dropbox'}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="indexes">Indexes</TabsTrigger>
        </TabsList>

        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Registered Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diagnostics.moduleList.map((mod) => {
                  const fullModule = allModules.find(m => m.config.id === mod.id);
                  const Icon = fullModule?.config.icon;
                  
                  return (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                        <div>
                          <p className="font-medium">{mod.name}</p>
                          <p className="text-sm text-muted-foreground">{mod.basePath}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{mod.routeCount} routes</Badge>
                        {mod.isEnabled ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                            <XCircle className="h-3 w-3 mr-1" />
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle>Database Tables</CardTitle>
            </CardHeader>
            <CardContent>
              {dbLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {dbDiagnostics?.tables.map((table) => (
                    <div
                      key={table.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <span className="font-mono text-sm">{table.name}</span>
                      <div className="flex gap-2">
                        {table.hasSoftDelete && (
                          <Badge variant="outline" className="text-xs">soft-delete</Badge>
                        )}
                        {table.hasRLS && (
                          <Badge variant="outline" className="text-xs text-emerald-600">RLS</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes">
          <Card>
            <CardHeader>
              <CardTitle>Database Indexes</CardTitle>
            </CardHeader>
            <CardContent>
              {dbLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {dbDiagnostics?.indexes.map((idx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div>
                        <span className="font-mono text-sm">{idx.indexName}</span>
                        <p className="text-xs text-muted-foreground">{idx.tableName} → {idx.columns}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schema Info */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Schema Version: {dbDiagnostics?.schemaVersion ?? '-'}</span>
        <span>Registered at: {diagnostics.registeredAt.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default ModuleDiagnostics;
