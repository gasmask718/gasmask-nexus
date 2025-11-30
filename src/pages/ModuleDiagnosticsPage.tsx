import { ModuleDiagnostics } from '@/components/modules';

export default function ModuleDiagnosticsPage() {
  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Module Diagnostics</h1>
        <p className="text-muted-foreground mt-1">Dynasty OS Modular Architecture Status</p>
      </div>
      <ModuleDiagnostics />
    </div>
  );
}
