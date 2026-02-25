import { useState, useEffect } from 'react';
import PortalLayout from '@/components/portal/PortalLayout';
import { WorkerTaskTimer } from '@/components/production/WorkerTaskTimer';
import { LaborEfficiencyPanel } from '@/components/production/LaborEfficiencyPanel';
import { useProductionOffices } from '@/hooks/useProductionPortal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function WorkerTaskTimerPage() {
  const { data: offices = [] } = useProductionOffices();
  const [officeId, setOfficeId] = useState('');

  useEffect(() => {
    if (offices.length > 0 && !officeId) setOfficeId(offices[0].id);
  }, [offices, officeId]);

  return (
    <PortalLayout title="⏱ Task Timer">
      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <Select value={officeId} onValueChange={setOfficeId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select office…" />
            </SelectTrigger>
            <SelectContent>
              {offices.filter(o => o.active !== false).map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {officeId && (
        <div className="grid lg:grid-cols-2 gap-4">
          <WorkerTaskTimer officeId={officeId} />
          <LaborEfficiencyPanel officeId={officeId} />
        </div>
      )}
    </PortalLayout>
  );
}
