/**
 * CRM Data Management - Entity-Centric
 * View counts, export, import, and backup CRM data by entity type
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint, useAvailableEntityTypes } from '@/hooks/useCRMBlueprint';
import { useCRMEntityCounts, useTotalRecordCount } from '@/hooks/useCRMEntityCounts';
import CRMLayout from './CRMLayout';
import {
  Database, Download, Upload, Clock, FileJson, FileSpreadsheet,
  Settings, ArrowRight, RefreshCw, Building2, BarChart3,
  HardDrive, Loader2, AlertCircle,
} from 'lucide-react';

export default function CRMDataPage() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const { simulationMode } = useSimulationMode();
  const { blueprint, businessName } = useCRMBlueprint(currentBusiness?.slug);
  const entityTypes = useAvailableEntityTypes(currentBusiness?.slug);
  
  const { counts, isLoading: countsLoading, refetch: refetchCounts } = useCRMEntityCounts(
    currentBusiness?.id || null,
    blueprint.enabledEntityTypes
  );
  
  const { total: totalRecords } = useTotalRecordCount(currentBusiness?.id || null);

  // Fetch recent exports
  const { data: recentExports = [] } = useQuery({
    queryKey: ['recent-exports', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data } = await supabase
        .from('crm_exports')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch recent imports
  const { data: recentImports = [] } = useQuery({
    queryKey: ['recent-imports', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data } = await supabase
        .from('crm_imports')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // No business selected
  if (!currentBusiness) {
    return (
      <CRMLayout title="Data Management">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Business Selected</h3>
          <p className="text-muted-foreground mb-6">
            Please select a business to manage CRM data.
          </p>
          <Button onClick={() => navigate('/crm')}>
            Select Business
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout title="Data Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Data Management</h1>
              {simulationMode && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">
              Export, import, and backup {businessName} CRM data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetchCounts()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">
                  {countsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalRecords}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entity Types</p>
                <p className="text-2xl font-bold">{blueprint.enabledEntityTypes.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Download className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exports</p>
                <p className="text-2xl font-bold">{recentExports.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Upload className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Imports</p>
                <p className="text-2xl font-bold">{recentImports.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card 
            className="p-6 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/crm/data/export')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Download className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Export Data</h3>
                <p className="text-sm text-muted-foreground">
                  Download CRM data by entity type
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/crm/data/import')}
          >
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
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/crm/data/backup')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <HardDrive className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Backup & Restore</h3>
                <p className="text-sm text-muted-foreground">
                  Create and restore snapshots
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* Entity Counts by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Records by Entity Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {countsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {entityTypes.map((entity) => (
                  <div
                    key={entity.key}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/crm/${currentBusiness.slug}/${entity.key}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${entity.color}20`, color: entity.color }}
                      >
                        <Database className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{entity.labelPlural}</span>
                    </div>
                    <Badge variant="secondary">
                      {counts[entity.key] || 0}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Tabs defaultValue="exports">
          <TabsList>
            <TabsTrigger value="exports">Recent Exports</TabsTrigger>
            <TabsTrigger value="imports">Recent Imports</TabsTrigger>
          </TabsList>

          <TabsContent value="exports">
            <Card>
              <CardContent className="pt-6">
                {recentExports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No exports yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => navigate('/crm/data/export')}
                    >
                      Create Export
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {recentExports.map((exp: any) => (
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
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imports">
            <Card>
              <CardContent className="pt-6">
                {recentImports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No imports yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => navigate('/crm/data/import')}
                    >
                      Import Data
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {recentImports.map((imp: any) => (
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
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
