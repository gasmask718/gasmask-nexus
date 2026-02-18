import { Crown, Users, Truck, Shield } from 'lucide-react';

/**
 * AboutPage — Public marketing about page
 * SEO-friendly, no auth required
 */
export default function AboutPage() {
  const pillars = [
    { icon: Crown, title: 'Premium Quality', description: 'Authentic, verified tobacco products sourced directly from manufacturers.' },
    { icon: Truck, title: 'Fast Distribution', description: 'Same-day delivery to stores across our territory network.' },
    { icon: Users, title: 'Ambassador Network', description: 'A dedicated team ensuring every store gets personal attention.' },
    { icon: Shield, title: 'Trusted Brand', description: 'Built on transparency, consistency, and long-term partnerships.' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-black text-foreground tracking-tight">
          About <span className="text-primary">GasMask</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          We're building the most efficient tobacco distribution network — powered by technology, driven by people.
        </p>
      </section>

      {/* Pillars */}
      <section className="grid sm:grid-cols-2 gap-6">
        {pillars.map(({ icon: Icon, title, description }) => (
          <div key={title} className="p-6 rounded-xl border border-border bg-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </section>

      {/* Mission */}
      <section className="text-center space-y-4 py-8">
        <h2 className="text-2xl font-bold text-foreground">Our Mission</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          To empower every corner store with premium products, fair pricing, and the tools to grow their business — while creating real opportunities for our distribution partners.
        </p>
      </section>
    </div>
  );
}
