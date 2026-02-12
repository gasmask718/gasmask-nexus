import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNegotiationQueue } from '@/hooks/useSupplierIntelligence';
import { SupplierActionCard } from './SupplierActionCard';
import { Inbox } from 'lucide-react';

interface SupplierActionInboxProps {
  onSelectSupplier: (supplier: string) => void;
}

export function SupplierActionInbox({ onSelectSupplier }: SupplierActionInboxProps) {
  const { data, isLoading } = useNegotiationQueue();

  const immediate = (data || []).filter((d: any) => d.recommended_contact_window === 'immediate');
  const nearTerm = (data || []).filter((d: any) => d.recommended_contact_window === 'near_term');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground text-center">Loading supplier action inbox…</CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">All Clear</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            No suppliers require action today. Monitoring continues automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Supplier Action Inbox</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Who to contact, when, and why</p>
          </div>
          <div className="flex items-center gap-2">
            {immediate.length > 0 && (
              <Badge className="bg-red-100 text-red-800">{immediate.length} Immediate</Badge>
            )}
            {nearTerm.length > 0 && (
              <Badge className="bg-orange-100 text-orange-800">{nearTerm.length} Near Term</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {immediate.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-600 flex items-center gap-2">
              Immediate Action Required
            </h4>
            <div className="space-y-2">
              {immediate.map((item: any, idx: number) => (
                <SupplierActionCard key={idx} item={item} onSelect={onSelectSupplier} />
              ))}
            </div>
          </div>
        )}

        {nearTerm.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-orange-600 flex items-center gap-2">
              Prepare Within 30–60 Days
            </h4>
            <div className="space-y-2">
              {nearTerm.map((item: any, idx: number) => (
                <SupplierActionCard key={idx} item={item} onSelect={onSelectSupplier} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
