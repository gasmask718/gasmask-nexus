import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Store, FileText } from 'lucide-react';
import { usePipelineLeads } from './shared/usePipelineLeads';
import { PipelineLeadTable } from './shared/PipelineLeadTable';
import { PipelineStats } from './shared/PipelineStats';

export default function GasMaskNewStoresPipeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { leads, isLoading, refetch, uploadCSV, sendToCampaign, stats } = usePipelineLeads('GasMask New Stores', statusFilter === 'all' ? undefined : statusFilter);

  const columns = [
    { key: 'name', label: 'Store Name', render: (l: any) => l.first_name || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address', render: (l: any) => [l.address, l.city, l.state].filter(Boolean).join(', ') || '—' },
    { key: 'last_contact', label: 'Last Contact', render: (l: any) => l.last_called_at ? new Date(l.last_called_at).toLocaleDateString() : 'Never' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6 text-orange-500" /> GasMask New Stores Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">New store prospect outreach — separate from Floor 2 existing store management</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500">Internal</Badge>
          <span className="text-xs text-muted-foreground">Calls as: GasMask Wholesale</span>
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ This pipeline handles NEW store prospect outreach only. Existing store relationship management stays in Grabba Floor 2 Communication Hub.
        </p>
      </div>

      <PipelineStats stats={stats} labels={{ booked: 'Onboarded', interested: 'Interested' }} />

      <PipelineLeadTable
        leads={leads}
        isLoading={isLoading}
        columns={columns}
        onUploadCSV={(file) => uploadCSV(file, (row) => ({
          first_name: row.store_name || row.business_name || row.name || '',
          phone: row.phone || row.phone_number || '',
          address: row.address || '',
          city: row.city || '',
          state: row.state || '',
          zip: row.zip || '',
        }))}
        onSendToCampaign={(ids) => sendToCampaign.mutate(ids)}
        onRefetch={refetch}
        isSending={sendToCampaign.isPending}
        uploadLabel="Upload Store Prospects"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
    </div>
  );
}
