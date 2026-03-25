import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, FileText } from 'lucide-react';
import { usePipelineLeads } from './shared/usePipelineLeads';
import { PipelineLeadTable } from './shared/PipelineLeadTable';
import { PipelineStats } from './shared/PipelineStats';

export default function BrightSunPipeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { leads, isLoading, refetch, uploadCSV, sendToCampaign, stats } = usePipelineLeads('BrightSun Energy', statusFilter === 'all' ? undefined : statusFilter);

  const columns = [
    { key: 'name', label: 'Name', render: (l: any) => `${l.first_name || ''} ${l.last_name || ''}`.trim() || '—' },
    { key: 'address', label: 'Address', render: (l: any) => l.address || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'utility', label: 'Utility Est.', render: (l: any) => l.metadata?.utility_bill ? `$${l.metadata.utility_bill}/mo` : '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sun className="h-6 w-6 text-yellow-500" /> BrightSun Energy Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">Solar energy — qualify homeowners and book consultations</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500">Internal</Badge>
          <span className="text-xs text-muted-foreground">Calls as: BrightSun Energy</span>
        </div>
      </div>

      <Card className="border-[#0F6E56]/20 bg-[#0F6E56]/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Script Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm italic text-muted-foreground">
            "Hi [name], this is [agent] from BrightSun Energy. Are you the homeowner? I'm calling about a program that could eliminate your electric bill — do you have 2 minutes?"
          </p>
        </CardContent>
      </Card>

      {/* Qualification Criteria */}
      <Card className="border-yellow-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Qualification Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            {['Homeowner ✓', 'Electric $100+/mo', 'Owns (not rents)', 'Roof age < 15yr', 'Minimal shading'].map(c => (
              <Badge key={c} variant="outline" className="justify-center py-1">{c}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <PipelineStats stats={stats} labels={{ booked: 'Consultations', interested: 'Qualified' }} />

      <PipelineLeadTable
        leads={leads}
        isLoading={isLoading}
        columns={columns}
        onUploadCSV={(file) => uploadCSV(file, (row) => ({
          first_name: row.first_name || row.name?.split(' ')[0] || '',
          last_name: row.last_name || row.name?.split(' ').slice(1).join(' ') || '',
          phone: row.phone || row.phone_number || '',
          address: row.address || '',
          city: row.city || '',
          state: row.state || '',
          zip: row.zip || '',
          metadata: { utility_bill: row.utility_bill || row.electric_bill || '' },
        }))}
        onSendToCampaign={(ids) => sendToCampaign.mutate(ids)}
        onRefetch={refetch}
        isSending={sendToCampaign.isPending}
        uploadLabel="Upload Homeowner Leads"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
    </div>
  );
}
