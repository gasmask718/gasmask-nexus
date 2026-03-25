import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Banknote, FileText } from 'lucide-react';
import { usePipelineLeads } from './shared/usePipelineLeads';
import { PipelineLeadTable } from './shared/PipelineLeadTable';
import { PipelineStats } from './shared/PipelineStats';

export default function SurplusFundsPipeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { leads, isLoading, refetch, uploadCSV, sendToCampaign, stats } = usePipelineLeads('Surplus Funds', statusFilter === 'all' ? undefined : statusFilter);

  const columns = [
    { key: 'name', label: 'Name', render: (l: any) => `${l.first_name || ''} ${l.last_name || ''}`.trim() || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'city', label: 'County/City', render: (l: any) => l.city || l.metadata?.county || '—' },
    { key: 'amount', label: 'Amount', render: (l: any) => l.metadata?.amount ? `$${Number(l.metadata.amount).toLocaleString()}` : '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="h-6 w-6 text-green-500" /> Surplus Funds Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">Contact people with unclaimed surplus funds and help them claim their money</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500">Internal</Badge>
          <span className="text-xs text-muted-foreground">Calls as: Dynasty Surplus Recovery</span>
        </div>
      </div>

      {/* Script Preview */}
      <Card className="border-[#0F6E56]/20 bg-[#0F6E56]/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Script Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm italic text-muted-foreground">
            "Hi [name], this is [agent] calling about unclaimed funds that may be owed to you from [county]. Do you have 2 minutes?"
          </p>
        </CardContent>
      </Card>

      <PipelineStats stats={stats} labels={{ booked: 'Consultations' }} />

      <PipelineLeadTable
        leads={leads}
        isLoading={isLoading}
        columns={columns}
        onUploadCSV={(file) => uploadCSV(file, (row) => ({
          first_name: row.first_name || row.firstname || row.name?.split(' ')[0] || '',
          last_name: row.last_name || row.lastname || row.name?.split(' ').slice(1).join(' ') || '',
          phone: row.phone || row.phone_number || '',
          city: row.county || row.city || '',
          state: row.state || '',
          metadata: { amount: row.amount || row.surplus_amount || '', county: row.county || '' },
        }))}
        onSendToCampaign={(ids) => sendToCampaign.mutate(ids)}
        onRefetch={refetch}
        isSending={sendToCampaign.isPending}
        uploadLabel="Upload County Records"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
    </div>
  );
}
