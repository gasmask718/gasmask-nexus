/**
 * AmbassadorCatalog — Read-only product reference for field ambassadors.
 *
 * Pulls active products from the `products` table (the cleaned canonical
 * 9-product set) and renders mobile-friendly cards with the 3 pricing
 * tiers (store / wholesale / street) plus units-per-box and brand color.
 *
 * Reuses ProductCatalogCard's brand color palette + pricing pattern so
 * we don't fork two product display systems.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, ImageOff, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useTranslation } from '@/hooks/useTranslation';


const BRAND_COLORS: Record<string, { border: string; tint: string; label: string }> = {
  'fb52b0e6-39b2-4e13-bea9-cd016f51efb0': { border: 'border-red-500/40',    tint: 'bg-red-500/5',    label: 'GasMask' },
  '4b1c1255-b7b1-43ea-9ad9-a257c6582094': { border: 'border-purple-500/40', tint: 'bg-purple-500/5', label: 'Grabba R Us' },
  'f3e8ba65-2b76-4f61-a157-0751acb3e7b2': { border: 'border-pink-500/40',   tint: 'bg-pink-500/5',   label: 'HotMama' },
  'c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe': { border: 'border-orange-500/40', tint: 'bg-orange-500/5', label: 'Hotscolatti' },
};

interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  store_price: number | null;
  wholesale_price: number | null;
  street_price: number | null;
  brand_id: string | null;
  category: string | null;
  units_per_box: number | null;
  image_url: string | null;
  hero_score: number | null;
  description: string | null;
}

function useCatalogProducts() {
  return useQuery({
    queryKey: ['ambassador-catalog-products'],
    queryFn: async (): Promise<CatalogProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, name, sku, store_price, wholesale_price, street_price, brand_id, category, units_per_box, image_url, hero_score, description'
        )
        .eq('is_active', true)
        .eq('is_deleted', false)
        .is('deleted_at', null)
        .order('hero_score', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as CatalogProduct[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function TierRow({ label, perTube, unitsPerBox }: { label: string; perTube: number | null; unitsPerBox: number }) {
  const { t } = useTranslation();
  if (perTube == null) {
    return (
      <div className="rounded-md bg-background/60 border border-border/60 px-2 py-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-[11px] font-semibold">—</p>
      </div>
    );
  }
  const perBox = perTube * unitsPerBox;
  return (
    <div className="rounded-md bg-background/60 border border-border/60 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[11px] font-semibold leading-tight">
        {formatCurrency(perTube)}<span className="font-normal text-muted-foreground">/{t('amb.catalog.tube')}</span>
        <span className="text-muted-foreground"> · </span>
        {formatCurrency(perBox)}<span className="font-normal text-muted-foreground">/{t('amb.catalog.box')}</span>
      </p>
    </div>
  );
}


function ProductCard({ p }: { p: CatalogProduct }) {
  const { t } = useTranslation();
  const brand = p.brand_id ? BRAND_COLORS[p.brand_id] : undefined;
  const isHero = (p.hero_score ?? 0) >= 80;
  const unitsPerBox = p.units_per_box ?? 100;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-2 transition-shadow hover:shadow-md',
        brand?.border ?? 'border-border',
        brand?.tint ?? 'bg-muted/20'
      )}
    >
      {isHero && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-sky-500 text-white text-[10px] gap-0.5 px-1.5 py-0.5">
            <Sparkles className="h-3 w-3" /> {t('amb.catalog.new')}
          </Badge>
        </div>
      )}

      {/* Image / placeholder */}
      <div className="aspect-square w-full bg-muted/40 flex items-center justify-center overflow-hidden">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageOff className="h-10 w-10 text-muted-foreground/40" aria-hidden />
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-sm leading-tight">{p.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {brand?.label ?? t('amb.catalog.brand')}
            {p.sku ? <> · {p.sku}</> : null}
          </p>
        </div>

        {/* All three tiers — per-tube (stored) + per-box (computed × units_per_box) */}
        <div className="space-y-1">
          <TierRow label={t('amb.catalog.store')} perTube={p.store_price} unitsPerBox={unitsPerBox} />
          <TierRow label={t('amb.catalog.wholesale')} perTube={p.wholesale_price} unitsPerBox={unitsPerBox} />
          <TierRow label={t('amb.catalog.street')} perTube={p.street_price} unitsPerBox={unitsPerBox} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Badge variant="secondary" className="text-[10px] capitalize">
            {p.category ?? 'product'}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {unitsPerBox} {t('amb.catalog.per_box_suffix')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}


function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function AmbassadorCatalog() {
  const { data: products = [], isLoading, error } = useCatalogProducts();
  const { t } = useTranslation();

  return (
    <PortalRBACGate allowedRoles={['admin', 'ambassador']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title={t('amb.catalog.title')}
        subtitle={t('amb.catalog.subtitle')}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Badge variant="outline" className="text-xs">
              {products.length} {t('amb.catalog.active')}
            </Badge>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('amb.catalog.all_products')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <CatalogSkeleton />
              ) : error ? (
                <p className="text-sm text-destructive">
                  {t('amb.catalog.failed_load')}: {(error as Error).message}
                </p>
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('amb.catalog.no_products')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((p) => (
                    <ProductCard key={p.id} p={p} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}

