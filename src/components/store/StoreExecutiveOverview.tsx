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
  // Canonical account facts — same row the Account Summary brief is generated from.
  const { data: summary } = useQuery({
    queryKey: ['store-executive-summary', storeMasterId],
    enabled: !!storeMasterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_store_summary')
        .select('owed, contact_name, last_order_date')
        .eq('store_id', storeMasterId)
        .maybeSingle();
      if (error) throw error;
      return data as { owed: number | null; contact_name: string | null; last_order_date: string | null } | null;
    },
  });
  // Terms live on store_master.invoice_payment_method — the exact field the
  // Account Summary "Terms:" line renders. No duplicate/derived state.
  const { data: master } = useQuery({
    queryKey: ['store-executive-terms', storeMasterId],
    enabled: !!storeMasterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('invoice_payment_method')
        .eq('id', storeMasterId)
        .maybeSingle();
      if (error) throw error;
      return data as { invoice_payment_method: string | null } | null;
    },
  });
  const { data: lastContact } = useQuery({
    queryKey: ['store-executive-last-contact', storeMasterId],
    enabled: !!storeMasterId,
    queryFn: async () => {
      const { data, error } = await supabase.from('contact_interactions').select('created_at').eq('store_id', storeMasterId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data?.created_at ?? null;
    },
  });

  // Primary contact rule: the authoritative designated contact on store_master
  // (contact_name), falling back to the legacy mirror passed in by the page.
  // Never guessed from an arbitrary store_contacts row.
  const contactName = summary?.contact_name?.trim() || primaryContact?.trim() || null;
  const terms = master?.invoice_payment_method || paymentTerms || null;

  const facts = [
    ['Primary Contact', contactName || 'Not assigned'],
    ['Last Contact', formatDate(lastContact)],
    ['Last Order', formatDate(lastOrderAt ?? summary?.last_order_date ?? null)],
    ['Outstanding Balance', `$${Number(summary?.owed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Payment Terms', terms ? terms.replace(/_/g, ' ') : 'Not set'],
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