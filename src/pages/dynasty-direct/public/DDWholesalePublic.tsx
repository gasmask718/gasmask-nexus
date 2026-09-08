import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DDChevron } from '@/components/dynasty-direct/DDMark';

const STEPS = [
  {
    step: '01',
    title: 'Apply',
    body: 'Tell us the company, what you carry and where you ship from. A person reviews it — nothing is auto-approved.',
  },
  {
    step: '02',
    title: 'List your products',
    body: 'Add products in your own portal, or photograph them and let our intake fill in the details for you to confirm.',
  },
  {
    step: '03',
    title: 'Set one price',
    body: 'You enter your price to Dynasty Direct. That is the only number you manage. Buyer pricing is ours to set and defend.',
  },
  {
    step: '04',
    title: 'We sell and ship',
    body: 'Orders, buyer support, returns and carrier rates run through us. You fulfil and get paid on the agreed terms.',
  },
];

export default function DDWholesalePublic() {
  useEffect(() => {
    document.title = 'Supply with Dynasty Direct — supplier network';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Become a Dynasty Direct supplier: list your products, set one price to Dynasty Direct, and let us handle buyer pricing, shipping and support.',
    );
  }, []);

  return (
    <div>
      <section className="bg-[hsl(var(--dd-navy-deep))] text-white">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h1 className="font-display text-4xl sm:text-5xl max-w-2xl leading-[1.08]">
            Sell through the arrow, not around it.
          </h1>
          <p className="mt-6 max-w-xl text-white/70 text-lg">
            Dynasty Direct puts your product in front of buyers under one standard of listing,
            pricing and delivery. You supply. We do the rest of the road.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center h-12 px-7 font-medium text-[hsl(var(--dd-navy-deep))] bg-[hsl(var(--dd-gold))] hover:bg-[hsl(var(--dd-gold-soft))]"
            >
              Apply to supply
            </Link>
            <Link
              to="/portal/wholesaler"
              className="inline-flex items-center h-12 px-7 font-medium text-white border border-white/25 hover:border-white/60"
            >
              Already a supplier
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="font-display text-2xl border-b border-[hsl(var(--dd-line))] pb-4">
          How it runs
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.step} className="dd-panel p-6 h-full">
              <div className="flex items-center gap-2">
                <DDChevron size={13} />
                <span className="dd-num text-xs text-[hsl(var(--dd-ink))]/50">{s.step}</span>
              </div>
              <p className="font-display text-lg mt-3">{s.title}</p>
              <p className="mt-2 text-sm text-[hsl(var(--dd-ink))]/70 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-t border-[hsl(var(--dd-line))]">
        <div className="max-w-6xl mx-auto px-4 py-16 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl">What we need from a product</h2>
            <ul className="mt-5 space-y-3 text-[hsl(var(--dd-ink))]/75">
              <li>Real photographs of the item and its packaging.</li>
              <li>Accurate weight and box measurements — shipping is quoted from them.</li>
              <li>Pack or case count, stated plainly.</li>
              <li>Your price to Dynasty Direct.</li>
            </ul>
            <p className="mt-5 text-sm text-[hsl(var(--dd-ink))]/60">
              A product without verified weight and dimensions cannot go live — that rule protects
              you as much as the buyer.
            </p>
          </div>
          <div className="dd-panel dd-panel-accent p-8 self-start">
            <h3 className="font-display text-xl">Ready to start</h3>
            <p className="mt-3 text-[hsl(var(--dd-ink))]/70">
              Create an account and request supplier access. We review every application by hand.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center h-11 px-6 font-medium text-white bg-[hsl(var(--dd-navy))] hover:bg-[hsl(var(--dd-navy-deep))]"
            >
              Apply to supply
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
