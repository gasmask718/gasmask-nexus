import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, FileText } from 'lucide-react';
import { usePipelineLeads } from './shared/usePipelineLeads';
import { PipelineLeadTable } from './shared/PipelineLeadTable';
import { PipelineStats } from './shared/PipelineStats';

export default function RealEstatePipeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { leads, isLoading, refetch, uploadCSV, sendToCampaign, stats } = usePipelineLeads('Dynasty Real Estate', statusFilter === 'all' ? undefined : statusFilter);

  const columns = [
    { key: 'address', label: 'Address', render: (l: any) => l.address || '—' },
    { key: 'name', label: 'Owner', render: (l: any) => `${l.first_name || ''} ${l.last_name || ''}`.trim() || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'value', label: 'Est. Value', render: (l: any) => l.metadata?.estimated_value ? `$${Number(l.metadata.estimated_value).toLocaleString()}` : '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building className="h-6 w-6 text-amber-500" /> Real Estate Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">Wholesale real estate — find distressed sellers, get properties under contract</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500">Internal</Badge>
          <span className="text-xs text-muted-foreground">Calls as: Dynasty Property Group</span>
        </div>
      </div>

      <Card className="border-[#0F6E56]/20 bg-[#0F6E56]/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Script Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm italic text-muted-foreground">
            "Hi [name], I'm calling about your property at [address]. Are you the owner? I'm looking to buy properties in that area..."
          </p>
        </CardContent>
      </Card>

      <PipelineStats stats={stats} labels={{ booked: 'Contracts', interested: 'Interested Sellers' }} />

      <PipelineLeadTable
        leads={leads}
        isLoading={isLoading}
        columns={columns}
        onUploadCSV={(file) => uploadCSV(file, (row) => ({
          first_name: row.first_name || row.owner_first || row.owner?.split(' ')[0] || '',
          last_name: row.last_name || row.owner_last || row.owner?.split(' ').slice(1).join(' ') || '',
          phone: row.phone || row.phone_number || '',
          address: row.address || row.property_address || '',
          city: row.city || '',
          state: row.state || '',
          zip: row.zip || '',
          metadata: { estimated_value: row.value || row.estimated_value || '', arv: row.arv || '' },
        }))}
        onSendToCampaign={(ids) => sendToCampaign.mutate(ids)}
        onRefetch={refetch}
        isSending={sendToCampaign.isPending}
        uploadLabel="Upload Leads"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
    </div>
  );
}
