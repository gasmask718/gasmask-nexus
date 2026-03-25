import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, FileText } from 'lucide-react';
import { usePipelineLeads } from './shared/usePipelineLeads';
import { PipelineLeadTable } from './shared/PipelineLeadTable';
import { PipelineStats } from './shared/PipelineStats';

export default function PlayBoxxxPipeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { leads, isLoading, refetch, uploadCSV, sendToCampaign, stats } = usePipelineLeads('PlayBoxxx', statusFilter === 'all' ? undefined : statusFilter);

  const columns = [
    { key: 'name', label: 'Name', render: (l: any) => `${l.first_name || ''} ${l.last_name || ''}`.trim() || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'lead_type', label: 'Specialty', render: (l: any) => l.lead_type || '—' },
    { key: 'last_contact', label: 'Last Contact', render: (l: any) => l.last_called_at ? new Date(l.last_called_at).toLocaleDateString() : 'Never' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Camera className="h-6 w-6 text-purple-500" /> PlayBoxxx Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">Keep in contact with models — check availability, schedule shoots, share opportunities</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500">Internal</Badge>
          <span className="text-xs text-muted-foreground">Calls as: PlayBoxxx Management</span>
        </div>
      </div>

      <PipelineStats stats={stats} labels={{ total: 'Total Models', new: 'New', called: 'Contacted', interested: 'Available', booked: 'Scheduled' }} />

      <PipelineLeadTable
        leads={leads}
        isLoading={isLoading}
        columns={columns}
        onUploadCSV={(file) => uploadCSV(file, (row) => ({
          first_name: row.first_name || row.name?.split(' ')[0] || '',
          last_name: row.last_name || row.name?.split(' ').slice(1).join(' ') || '',
          phone: row.phone || row.phone_number || '',
          email: row.email || '',
          lead_type: row.specialty || row.type || 'model',
        }))}
        onSendToCampaign={(ids) => sendToCampaign.mutate(ids)}
        onRefetch={refetch}
        isSending={sendToCampaign.isPending}
        uploadLabel="Upload Model List"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
    </div>
  );
}
