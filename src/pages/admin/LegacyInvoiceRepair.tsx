import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { LegacyPriceClusterList } from '@/components/legacy-repair/LegacyPriceClusterList';
import { LegacyInvoiceRepairTable } from '@/components/legacy-repair/LegacyInvoiceRepairTable';
import { LegacyRepairProgress } from '@/components/legacy-repair/LegacyRepairProgress';
import { EffectiveTubePreview } from '@/components/legacy-repair/EffectiveTubePreview';

const LegacyInvoiceRepair = () => {
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Legacy Invoice Repair</h1>
        <p className="text-muted-foreground text-sm mt-1">
          One-time tube attribution tool for historical invoices
        </p>
      </div>

      <Alert variant="destructive" className="border-yellow-500 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-yellow-200">
          <strong>⚠️ Legacy Invoice Repair Tool</strong> — This tool does NOT change invoice totals, payments, or inventory.
          It only records historically accurate tube counts for reporting.
        </AlertDescription>
      </Alert>

      <LegacyRepairProgress />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <LegacyPriceClusterList
            selectedPrice={selectedPrice}
            onSelectPrice={setSelectedPrice}
          />
        </div>
        <div className="lg:col-span-2">
          {selectedPrice !== null ? (
            <LegacyInvoiceRepairTable selectedPrice={selectedPrice} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                Select a price cluster to view invoices
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <EffectiveTubePreview />
    </div>
  );
};

export default LegacyInvoiceRepair;
