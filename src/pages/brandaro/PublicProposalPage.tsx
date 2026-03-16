import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Globe, Rocket, Shield, Star, Loader2, ExternalLink } from 'lucide-react';

interface ProposalData {
  id: string;
  tracking_token: string;
  package_tier: string;
  base_price: number;
  addons: any[];
  total_price: number;
  status: string;
  lead_id: string;
  demo_id: string | null;
  business_name?: string;
  demo_url?: string;
}

const PACKAGE_DETAILS: Record<string, { name: string; features: string[] }> = {
  starter: { name: 'Starter Website', features: ['5-page website', 'Mobile responsive', 'Contact form', 'Basic SEO', '30-day support'] },
  professional: { name: 'Professional Website', features: ['10-page website', 'Mobile responsive', 'Contact form', 'Advanced SEO', 'Google Analytics', 'Social integration', '60-day support'] },
  premium: { name: 'Premium Website', features: ['Unlimited pages', 'Custom design', 'E-commerce ready', 'Full SEO suite', 'Blog system', 'Lead capture forms', '90-day support'] },
  elite: { name: 'Elite Custom', features: ['Custom everything', 'Dedicated designer', 'Priority support', 'Advanced features', 'Training session', 'Quarterly strategy', 'Lifetime support'] },
};

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchProposal = async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_proposals')
        .select('*')
        .eq('tracking_token', token)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Get lead info
      const { data: lead } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('business_name')
        .eq('id', data.lead_id)
        .single();

      // Get demo info
      let demoUrl = null;
      if (data.demo_id) {
        const { data: demo } = await (supabase as any)
          .from('brandaro_demo_sites')
          .select('demo_url')
          .eq('id', data.demo_id)
          .single();
        demoUrl = demo?.demo_url;
      }

      setProposal({ ...data, business_name: lead?.business_name, demo_url: demoUrl });
      setLoading(false);

      // Track proposal view
      await (supabase as any).from('brandaro_proposals')
        .update({
          view_count: (data.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      // Track via event system
      try {
        await supabase.functions.invoke('brandaro-track-demo-event', {
          body: { demo_id: data.demo_id, lead_id: data.lead_id, event_type: 'proposal_click' },
        });
      } catch {}
    };

    fetchProposal();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (notFound || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="max-w-md bg-slate-800 border-slate-700">
          <CardContent className="pt-8 pb-8 text-center">
            <Globe className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Proposal Not Found</h2>
            <p className="text-slate-400">This proposal link may have expired or been removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pkg = PACKAGE_DETAILS[proposal.package_tier] || PACKAGE_DETAILS.starter;
  const isPaid = proposal.status === 'accepted' || proposal.payment_status === 'paid';

  const handleAccept = async () => {
    // For now, mark as accepted; Stripe checkout will be wired when enabled
    try {
      await supabase.functions.invoke('brandaro-post-payment', {
        body: { proposal_id: proposal.id, payment_amount: proposal.total_price },
      });
      setProposal({ ...proposal, status: 'accepted' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-cyan-400" />
            <span className="text-lg font-bold text-white">Brandaro Digital</span>
          </div>
          <Badge variant="outline" className="text-cyan-400 border-cyan-400/30">
            Custom Proposal
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">
            Your Custom Website for{' '}
            <span className="text-cyan-400">{proposal.business_name || 'Your Business'}</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            We've prepared a professional website package tailored to your business.
            Review the details below and launch when you're ready.
          </p>
        </section>

        {/* Demo Preview */}
        {proposal.demo_url && (
          <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-video bg-slate-700 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Globe className="h-16 w-16 text-cyan-400 mx-auto" />
                  <p className="text-white font-medium">Your Website Preview</p>
                  <a
                    href={proposal.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    View Live Demo <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Package Details */}
        <Card className="bg-slate-800/50 border-cyan-500/30">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Badge className="bg-cyan-500/20 text-cyan-400 mb-2">{proposal.package_tier.toUpperCase()}</Badge>
                <h2 className="text-2xl font-bold text-white">{pkg.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-cyan-400">${proposal.base_price.toLocaleString()}</p>
                <p className="text-sm text-slate-400">one-time</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {pkg.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-300">
                  <CheckCircle className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add-ons */}
        {proposal.addons && proposal.addons.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8">
              <h3 className="text-lg font-bold text-white mb-4">Selected Add-ons</h3>
              <div className="space-y-3">
                {proposal.addons.map((addon: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                    <span className="text-slate-300">{addon.name}</span>
                    <span className="text-cyan-400 font-medium">
                      ${addon.price}{addon.unit ? addon.unit : ''}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total & CTA */}
        <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
          <CardContent className="p-8 text-center space-y-6">
            <div>
              <p className="text-slate-400 mb-1">Total Investment</p>
              <p className="text-5xl font-bold text-white">${(proposal.total_price || 0).toLocaleString()}</p>
            </div>

            {isPaid ? (
              <div className="space-y-3">
                <Badge className="bg-green-500/20 text-green-400 text-lg px-4 py-1">
                  ✅ Payment Received
                </Badge>
                <p className="text-slate-300">Thank you! We're getting started on your website.</p>
              </div>
            ) : (
              <Button
                size="lg"
                onClick={handleAccept}
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-12 py-6 text-lg font-bold rounded-xl"
              >
                <Rocket className="h-5 w-5 mr-2" />
                Launch My Website
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Trust */}
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: Shield, title: 'Secure Payment', desc: '256-bit SSL encryption' },
            { icon: Star, title: '100% Satisfaction', desc: 'Or your money back' },
            { icon: Rocket, title: 'Fast Launch', desc: 'Live in 7-14 business days' },
          ].map((t, i) => (
            <div key={i} className="space-y-2">
              <t.icon className="h-8 w-8 text-cyan-400 mx-auto" />
              <p className="text-white font-medium">{t.title}</p>
              <p className="text-sm text-slate-400">{t.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-700/50 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Brandaro Digital — Professional Website Solutions
        </div>
      </footer>
    </div>
  );
}
