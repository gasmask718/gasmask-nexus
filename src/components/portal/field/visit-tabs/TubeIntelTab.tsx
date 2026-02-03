import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TubeIntelligenceCard } from '@/components/store/TubeIntelligenceCard';
import { TubeIntelRole } from '@/hooks/useTubeIntelligence';
import { Package } from 'lucide-react';

interface TubeIntelTabProps {
  storeId: string;
  portalType: 'driver' | 'biker' | 'ambassador';
}

export function TubeIntelTab({ storeId, portalType }: TubeIntelTabProps) {
  // Map portal type to TubeIntel role
  const roleMap: Record<string, TubeIntelRole> = {
    driver: 'driver',
    biker: 'biker',
    ambassador: 'ambassador',
  };

  const role = roleMap[portalType] || 'driver';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tube Intelligence
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {role === 'driver' 
              ? 'View tube status for load preparation (read-only)'
              : 'Update operational signals for this store'
            }
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <TubeIntelligenceCard storeId={storeId} role={role} />
        </CardContent>
      </Card>
    </div>
  );
}
