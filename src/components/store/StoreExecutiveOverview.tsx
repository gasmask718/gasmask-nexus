import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StoreHealthBadge } from '@/components/delivery/StoreHealthBadge';
import { RelationshipStatusInline } from '@/components/store/RelationshipStatusInline';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';

interface Props {
  storeId: string;
  name: string;
  address: string;
  primaryContact?: string | null;
  phone?: string | null;
  lastOrderAt?: string | null;
  paymentTerms?: string | null;
}

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : 'No activity yet';

export function StoreExecutiveOverview({ storeId, name, address, primaryContact, phone, lastOrderAt, paymentTerms }: Props) {
  const { storeMasterId } = useStoreMasterResolver(storeId);
  const { data: summary } = useQuery({
    queryKey: ['store-executive-summary', storeMasterId],
    enabled: !!storeMasterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('v_store_summary').select('owed').eq('store_id', storeMasterId).maybeSingle();
      if (error) throw error;
      return data as { owed: number | null } | null;
    },
  });
  const { data: lastContact } = useQuery({
    queryKey: ['store-executive-last-contact', storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('contact_interactions').select('interaction_date').eq('store_id', storeId).order('interaction_date', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data?.interaction_date ?? null;
    },
  });

  const facts = [
    ['Primary Contact', primaryContact || 'Not assigned'],
    ['Last Contact', formatDate(lastContact)],
    ['Last Order', formatDate(lastOrderAt)],
    ['Outstanding Balance', `$${Number(summary?.owed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Payment Terms', paymentTerms ? paymentTerms.replaceAll('_', ' ') : 'Not set'],
  ];

  return (
    <section className="border-b border-border/60 pb-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          <p className="text-sm text-muted-foreground">{address || 'Address not available'}</p>
          {phone && <p className="text-sm text-muted-foreground">{phone}</p>}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:min-w-[640px]">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
              <p className="truncate text-sm font-medium capitalize">{value}</p>
            </div>
          ))}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Overall Store Health</p>
            <StoreHealthBadge storeId={storeId} />
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-3">
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Relationship Status</p>
            <RelationshipStatusInline storeId={storeId} />
          </div>
        </div>
      </div>
    </section>
  );
}