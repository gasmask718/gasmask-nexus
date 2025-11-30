import { useModules } from '@/hooks/useModules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Package, Route, LayoutGrid } from 'lucide-react';

/**
 * ModuleDiagnostics - Displays diagnostic information about registered modules
 */
export function ModuleDiagnostics() {
  const { diagnostics, allModules } = useModules();

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{diagnostics.totalModules}</p>
                <p className="text-sm text-muted-foreground">Total Modules</p>
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
      </div>

      {/* Module List */}
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

      {/* Registration Info */}
      <p className="text-sm text-muted-foreground text-center">
        Registered at: {diagnostics.registeredAt.toLocaleString()}
      </p>
    </div>
  );
}

export default ModuleDiagnostics;
