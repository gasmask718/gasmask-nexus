import { FileText } from 'lucide-react';

export default function REContracts() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6" style={{ color: '#3B6D11' }} />
        <div>
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-sm text-muted-foreground">Wholesale assignment agreements & purchase contracts</p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Contract management workspace coming online. Templates, e-sign, and deal-linked storage will surface here.
      </div>
    </div>
  );
}
