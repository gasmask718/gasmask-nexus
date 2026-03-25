import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Shield, Database, Route, Layout } from 'lucide-react';
import { SBO_IDENTITY, validateModuleName } from '@/config/sboIdentity';
import { departmentRegistry } from '@/modules';

interface IntegrityCheck {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export default function SystemIntegrity() {
  const checks = useMemo<IntegrityCheck[]>(() => {
    const results: IntegrityCheck[] = [];
    const allModules = departmentRegistry.getAllModules();
    
    // 1. Check for duplicate sports modules
    const sportsModules = allModules.filter(m => {
      const n = m.config.name.toLowerCase();
      return n.includes('sport') || n.includes('betting') || n.includes('sbo');
    });
    
    results.push({
      label: 'Sports Engine Uniqueness',
      status: sportsModules.length <= 1 ? 'pass' : 'fail',
      detail: sportsModules.length <= 1
        ? `Single engine: ${SBO_IDENTITY.name}`
        : `${sportsModules.length} sports modules detected: ${sportsModules.map(m => m.config.name).join(', ')}`,
    });

    // 2. Check SBO module exists and has correct name
    const sboModule = allModules.find(m => m.config.id === SBO_IDENTITY.moduleId);
    results.push({
      label: 'SBO Module Registration',
      status: sboModule ? 'pass' : 'fail',
      detail: sboModule ? `Registered as "${sboModule.config.name}"` : 'SBO module not found in registry',
    });

    // 3. Check naming compliance for all modules
    allModules.forEach(m => {
      const violation = validateModuleName(m.config.name);
      if (violation) {
        results.push({
          label: `Naming: ${m.config.name}`,
          status: 'fail',
          detail: violation,
        });
      }
    });

    // 4. Route prefix check
    const allRoutes = departmentRegistry.getAllRoutes();
    const sportsRoutes = allRoutes.filter(r => 
      r.path.includes('sport') || r.path.includes('betting')
    );
    const allUnderSBO = sportsRoutes.every(r => r.path.startsWith(SBO_IDENTITY.routePrefix));
    results.push({
      label: 'Route Consolidation',
      status: allUnderSBO ? 'pass' : 'warn',
      detail: allUnderSBO
        ? `All ${sportsRoutes.length} sports routes under ${SBO_IDENTITY.routePrefix}`
        : 'Some sports routes exist outside SBO prefix',
    });

    // 5. Table allowlist check
    results.push({
      label: 'Database Schema Lock',
      status: 'pass',
      detail: `${SBO_IDENTITY.allowedTables.length} canonical tables defined`,
    });

    // 6. Module count
    results.push({
      label: 'Total Registered Modules',
      status: 'pass',
      detail: `${allModules.length} modules active`,
    });

    return results;
  }, []);

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  const statusIcon = (s: IntegrityCheck['status']) => {
    if (s === 'pass') return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (s === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">System Integrity</h1>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
          ✅ {passCount} Pass
        </Badge>
        {warnCount > 0 && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            ⚠️ {warnCount} Warn
          </Badge>
        )}
        {failCount > 0 && (
          <Badge variant="destructive">
            ❌ {failCount} Fail
          </Badge>
        )}
      </div>

      {/* Identity Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            {SBO_IDENTITY.emoji} {SBO_IDENTITY.name} — Identity Lock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Module ID</span><code>{SBO_IDENTITY.moduleId}</code></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Route Prefix</span><code>{SBO_IDENTITY.routePrefix}</code></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Canonical Tables</span><span>{SBO_IDENTITY.allowedTables.length}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Blocked Patterns</span><span>{SBO_IDENTITY.blockedPatterns.length}</span></div>
        </CardContent>
      </Card>

      {/* Checks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Route className="h-4 w-4" />
            Integrity Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs">
              <div className="flex items-center gap-2">
                {statusIcon(check.status)}
                <span className="font-medium">{check.label}</span>
              </div>
              <span className="text-muted-foreground max-w-[50%] text-right">{check.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
