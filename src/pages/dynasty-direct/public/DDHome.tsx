import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { DDChevron } from '@/components/dynasty-direct/DDMark';

/**
 * Dynasty Direct public homepage. Real catalog rows only (products_public,
 * consumer price = dtc_price_b); no invented products, no invented stats.
 */
export default function DDHome() {
  useEffect(() => {
    document.title = 'Dynasty Direct — Supplier to buyer, nothing in between';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Dynasty Direct sources from vetted suppliers and ships direct to the buyer — one catalog, live carrier rates at checkout, no extra hops.',
    );
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['dd-home-catalog'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products_public')
        .select('id, product_name, category, dtc_price_b, retail_price, primary_image_url, images')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;

      // Live catalog size — the only supply-side number a public visitor can read.
      const { count: liveCount } = await supabase
        .from('products_public')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      return { products: products ?? [], liveCount: liveCount ?? 0 };
    },
  });


  const products = data?.products ?? [];

  return (
    <div>
      {/* ── Hero: the mark's own idea, made literal ───────────────────────── */}
      <section className="bg-[hsl(var(--dd-navy-deep))] text-white">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] max-w-3xl">
            Supplier to buyer.
            <br />
            <span className="text-[hsl(var(--dd-gold))]">Nothing in between.</span>
          </h1>
          <p className="mt-6 max-w-xl text-white/70 text-lg">
            Two D's sharing one arrow. That is the whole business: we vet the supplier, hold the
            product to one standard, and ship it to you — without the layers that usually sit in
            the middle.
          </p>

          {/* Flow diagram — Supplier → Dynasty Direct → You */}
          <div className="mt-14 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            <FlowStage
              step="01"
              title="Supplier"
              body="Vetted suppliers price to us directly — no broker markup on the way in, and no mystery about where the product came from."
            />
            <FlowJoin />
            <FlowStage
              accent
              step="02"
              title="Dynasty Direct"
              body="Product data verified, dimensions and weight measured for real shipping cost, one price set for the buyer."
            />
            <FlowJoin />
            <FlowStage
              step="03"
              title="You"
              body="Order from the catalog. Live carrier rates at checkout, shipped from the source, tracked end to end."
            />
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center h-12 px-7 font-medium text-[hsl(var(--dd-navy-deep))] bg-[hsl(var(--dd-gold))] hover:bg-[hsl(var(--dd-gold-soft))]"
            >
              Browse the catalog
            </Link>
            <Link
              to="/direct/wholesale"
              className="inline-flex items-center h-12 px-7 font-medium text-white border border-white/25 hover:border-white/60"
            >
              Supply with us
            </Link>
          </div>
        </div>
      </section>

      {/* ── Catalog ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="flex items-end justify-between gap-4 border-b border-[hsl(var(--dd-line))] pb-4">
          <h2 className="font-display text-2xl">
            In the catalog now
            {typeof data?.liveCount === 'number' && (
              <span className="dd-num ml-3 text-base text-[hsl(var(--dd-ink))]/50">
                {data.liveCount} live
              </span>
            )}
          </h2>

          <Link to="/shop" className="text-sm text-[hsl(var(--dd-navy))] underline underline-offset-4">
            See everything
          </Link>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--dd-navy))]" />
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-[hsl(var(--dd-ink))]/60">
            The catalog is between listings right now. New products go live once they clear
            verification.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p: any) => {
              const img = p.primary_image_url ?? (Array.isArray(p.images) ? p.images[0] : null);
              const price = p.dtc_price_b ?? p.retail_price ?? null;
              return (
                <Link key={p.id} to={`/shop/product/${p.id}`} className="group block">
                  <div className="aspect-square bg-white border border-[hsl(var(--dd-line))] flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img
                        src={img}
                        alt={p.product_name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-[hsl(var(--dd-ink))]/25" />
                    )}
                  </div>
                  <p className="mt-3 font-medium group-hover:text-[hsl(var(--dd-navy))]">
                    {p.product_name}
                  </p>
                  {price != null && (
                    <p className="dd-num mt-1 text-[hsl(var(--dd-gold))] font-semibold">
                      {formatCurrency(price)}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Two audiences ─────────────────────────────────────────────────── */}
      <section className="bg-white border-t border-[hsl(var(--dd-line))]">
        <div className="max-w-6xl mx-auto px-4 py-16 grid gap-10 md:grid-cols-2">
          <div className="dd-panel p-8">
            <h3 className="font-display text-xl">If you are buying</h3>
            <p className="mt-3 text-[hsl(var(--dd-ink))]/70">
              One price, shown plainly. Shipping is calculated from the real measured weight and box
              of what you ordered, quoted live by the carrier at checkout — not a flat guess added
              on afterwards.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex items-center h-11 px-6 font-medium text-white bg-[hsl(var(--dd-navy))] hover:bg-[hsl(var(--dd-navy-deep))]"
            >
              Browse the catalog
            </Link>
          </div>
          <div className="dd-panel dd-panel-accent p-8">
            <h3 className="font-display text-xl">If you are supplying</h3>
            <p className="mt-3 text-[hsl(var(--dd-ink))]/70">
              You set one number — your price to Dynasty Direct. We handle listing, buyer pricing,
              shipping cost and support. You keep your own portal to manage products and orders.
            </p>
            <Link
              to="/direct/wholesale"
              className="mt-6 inline-flex items-center h-11 px-6 font-medium text-[hsl(var(--dd-navy-deep))] bg-[hsl(var(--dd-gold))] hover:bg-[hsl(var(--dd-gold-soft))]"
            >
              Supply with us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FlowStage({
  step,
  title,
  body,
  accent = false,
}: {
  step: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-6 h-full border-t-2 ${
        accent
          ? 'bg-white/[0.07] border-[hsl(var(--dd-gold))]'
          : 'bg-white/[0.03] border-white/25'
      }`}
    >
      <span className="dd-num text-xs text-white/45">{step}</span>
      <p className="font-display text-xl mt-2">{title}</p>
      <p className="mt-3 text-sm text-white/65 leading-relaxed">{body}</p>
    </div>
  );
}

function FlowJoin() {
  return (
    <div className="hidden md:flex items-center justify-center px-1">
      <DDChevron size={26} />
    </div>
  );
}
