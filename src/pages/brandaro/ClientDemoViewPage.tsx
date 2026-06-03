import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useOffers, BrandaroOffer } from "@/hooks/useBrandaroUpsell";
import { useTestimonials, useUrgency } from "@/hooks/useBrandaroConversion";
import {
  Globe, CheckCircle2, Smartphone, Zap, Shield,
  Phone, MessageSquare, Star, ArrowRight, Sparkles, Crown, TrendingUp,
  Clock, AlertTriangle, Users,
} from "lucide-react";

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft === "Expired") return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/30 rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Clock className="h-5 w-5 text-amber-400 animate-pulse" />
        <span className="text-amber-300 font-bold text-sm uppercase tracking-wide">Limited Time Offer</span>
      </div>
      <div className="text-3xl font-bold text-white font-mono">{timeLeft}</div>
      <p className="text-amber-200/70 text-xs mt-1">Your custom website is reserved — this demo expires soon</p>
    </div>
  );
}

export default function ClientDemoViewPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || window.location.pathname.split("/client/")[1];

  const [clientView, setClientView] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [changeRequest, setChangeRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState("starter");

  const { data: offers = [] } = useOffers();
  const { data: testimonials = [] } = useTestimonials();
  const { data: urgency } = useUrgency(clientView?.lead_id);

  useEffect(() => { loadClientView(); }, [token]);

  // Create urgency record on first view
  useEffect(() => {
    if (clientView?.lead_id && !urgency) {
      (supabase as any).from("brandaro_urgency").upsert({
        lead_id: clientView.lead_id,
        expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
        urgency_level: "standard",
      }, { onConflict: "lead_id" }).then(() => {});
    }
  }, [clientView?.lead_id, urgency]);

  const loadClientView = async () => {
    if (!token) { setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from("brandaro_client_views")
      .select("*, brandaro_qualified_leads:lead_id(*)")
      .eq("access_token", token)
      .single();
    if (error || !data) { setLoading(false); return; }
    setClientView(data);
    setLead(data.brandaro_qualified_leads);
    setSelectedTier(data.package_tier || "starter");

    await (supabase as any)
      .from("brandaro_client_views")
      .update({ views_count: (data.views_count || 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq("id", data.id);

    if (data.lead_id) {
      await (supabase as any)
        .from("brandaro_close_pipeline")
        .update({ stage: "demo_viewed", demo_viewed_at: new Date().toISOString() })
        .eq("lead_id", data.lead_id)
        .eq("stage", "demo_sent");
    }
    setLoading(false);
  };

  const handleLaunch = async (tier?: string) => {
    if (!clientView) return;
    const chosenTier = tier || selectedTier;
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-create-payment-link", {
        body: { lead_id: clientView.lead_id, package_tier: chosenTier, send_sms: false },
      });
      if (error) throw error;
      if (data?.checkout_url) window.open(data.checkout_url, "_blank");
    } catch {
      toast.error("Unable to process. Please call us directly.");
    }
  };

  const handleChangeRequest = async () => {
    if (!changeRequest.trim() || !clientView) return;
    setSubmitting(true);
    const existing = clientView.change_requests || [];
    await (supabase as any)
      .from("brandaro_client_views")
      .update({
        change_requests: [...existing, { text: changeRequest, created_at: new Date().toISOString() }],
        status: "in_progress",
      })
      .eq("id", clientView.id);
    toast.success("Change request submitted!");
    setChangeRequest("");
    setSubmitting(false);
    loadClientView();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
        <div className="animate-pulse text-cyan-400 text-lg">Loading your preview...</div>
      </div>
    );
  }

  if (!clientView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
        <div className="text-center">
          <Globe className="h-16 w-16 text-cyan-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Preview Not Found</h1>
          <p className="text-slate-400">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const businessName = lead?.business_name || "Your Business";
  const statusLabels: Record<string, { label: string; color: string }> = {
    demo_ready: { label: "Demo Ready", color: "bg-cyan-500" },
    in_progress: { label: "Updates In Progress", color: "bg-yellow-500" },
    ready_to_launch: { label: "Ready to Launch! 🚀", color: "bg-green-500" },
    launched: { label: "Live!", color: "bg-emerald-500" },
  };
  const statusInfo = statusLabels[clientView.status] || statusLabels.demo_ready;

  const tierIcons: Record<string, any> = { starter: Zap, growth: TrendingUp, premium: Crown, elite: Star };
  const tierLabels: Record<string, string | null> = { starter: null, growth: "Most Popular", premium: "Best Results", elite: "VIP" };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-cyan-400" />
            <span className="font-bold text-white text-lg">Brandaro</span>
          </div>
          <Badge className={`${statusInfo.color} text-white`}>{statusInfo.label}</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-white">{businessName}'s Custom Website</h1>
          <p className="text-lg text-slate-300">Built specifically for your business — ready to bring in new customers.</p>
        </div>

        {/* ═══ URGENCY TIMER ═══ */}
        {urgency?.expires_at && <CountdownTimer expiresAt={urgency.expires_at} />}

        {/* Scarcity Banner */}
        <div className="flex items-center justify-center gap-2 text-amber-300/80 text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>Only <strong className="text-white">3 slots left</strong> this week — we can launch your site <strong className="text-white">TODAY</strong></span>
        </div>

        {/* Website Preview */}
        {clientView.demo_html && (
          <Card className="overflow-hidden border-cyan-500/20 bg-slate-900/50 backdrop-blur">
            <CardContent className="p-0">
              <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-slate-400 bg-slate-700 rounded px-3 py-0.5">
                    {businessName.toLowerCase().replace(/\s+/g, "")}.com
                  </span>
                </div>
              </div>
              <div className="w-full bg-white" style={{ minHeight: 500 }} dangerouslySetInnerHTML={{ __html: clientView.demo_html }} />
            </CardContent>
          </Card>
        )}

        {/* ═══ OFFER LADDER ═══ */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Choose Your Package</h2>
            <p className="text-slate-400 text-sm mt-1">Most businesses we work with choose Growth or Premium for real results.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {offers.map((offer: BrandaroOffer) => {
              const Icon = tierIcons[offer.tier] || Zap;
              const badge = tierLabels[offer.tier];
              const isSelected = selectedTier === offer.tier;
              const isPopular = offer.tier === "growth";
              const isPremium = offer.tier === "premium";

              return (
                <Card
                  key={offer.id}
                  className={`relative cursor-pointer transition-all duration-200 backdrop-blur ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/30 ring-2 ring-cyan-400/50 scale-[1.02]"
                      : isPopular
                      ? "border-cyan-500/40 bg-slate-900/60"
                      : isPremium
                      ? "border-amber-500/30 bg-slate-900/60"
                      : "border-slate-700/50 bg-slate-900/50"
                  }`}
                  onClick={() => setSelectedTier(offer.tier)}
                >
                  {badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      isPopular ? "bg-cyan-500 text-white" : isPremium ? "bg-amber-500 text-black" : "bg-slate-600 text-white"
                    }`}>
                      {badge}
                    </div>
                  )}
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${isPremium ? "text-amber-400" : "text-cyan-400"}`} />
                      <span className="font-bold text-white">{offer.name}</span>
                    </div>
                    <div>
                      <span className="text-3xl font-bold text-white">${offer.price.toLocaleString()}</span>
                      <span className="text-slate-500 text-xs ml-1">one-time</span>
                    </div>
                    <ul className="space-y-1.5">
                      {(offer.features || []).map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleLaunch(offer.tier); }}
                      className={`w-full text-sm ${
                        isSelected
                          ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                          : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                      }`}
                      disabled={clientView.payment_completed}
                      size="sm"
                    >
                      {clientView.payment_completed && isSelected ? (
                        <><CheckCircle2 className="h-4 w-4 mr-1" /> Paid</>
                      ) : (
                        <><ArrowRight className="h-4 w-4 mr-1" /> Get Started</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center">
            <p className="text-slate-500 text-xs">
              💡 For Growth, Premium & Elite packages — <span className="text-cyan-400 font-medium">50% deposit available</span> to get started today.
            </p>
          </div>
        </div>

        {/* ═══ TESTIMONIALS — TRUST LAYER ═══ */}
        {testimonials.length > 0 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-cyan-400" /> Trusted by Local Businesses
              </h2>
              <p className="text-slate-400 text-sm mt-1">Real results from real business owners</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonials.map((t: any) => (
                <Card key={t.id} className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-slate-300 text-sm italic">"{t.testimonial_text}"</p>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">{t.business_name}</span>
                      {t.industry && (
                        <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">
                          {t.industry}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Value Stack */}
        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-400" /> Why Businesses Choose Us
            </h2>
            {[
              { icon: Globe, text: "Custom professional design tailored to your brand" },
              { icon: Smartphone, text: "Mobile-optimized — looks perfect on every device" },
              { icon: Zap, text: "Built-in lead capture system to get you new customers" },
              { icon: Shield, text: "Fast, secure hosting with SSL certificate" },
              { icon: Star, text: "30-day support & revisions after launch" },
              { icon: CheckCircle2, text: "Go live within 48 hours of approval" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Guarantee */}
        <div className="text-center bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-lg p-5">
          <Shield className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <h3 className="text-white font-bold text-lg">100% Satisfaction Guarantee</h3>
          <p className="text-slate-400 text-sm mt-1">If you're not happy with your website, we'll revise it until you are — or your money back.</p>
        </div>

        {/* Action row */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
            onClick={() => document.getElementById("changes-section")?.scrollIntoView({ behavior: "smooth" })}
          >
            <MessageSquare className="h-4 w-4 mr-2" /> Request Changes
          </Button>
          <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => document.getElementById("changes-section")?.scrollIntoView({ behavior: "smooth" })}>
            <Phone className="h-4 w-4 mr-2" /> Talk to a Specialist
          </Button>
        </div>

        {/* Change Request Section */}
        <div id="changes-section">
          <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-bold text-white">Request Changes</h2>
              <p className="text-sm text-slate-400">Want us to adjust anything? Describe the changes below.</p>
              <Textarea
                placeholder="e.g., Change the hero image, update the phone number..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                rows={3}
              />
              <Button onClick={handleChangeRequest} disabled={!changeRequest.trim() || submitting} className="bg-cyan-500 hover:bg-cyan-600">
                <MessageSquare className="h-4 w-4 mr-2" /> Submit Request
              </Button>
              {(clientView.change_requests || []).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Previous Requests:</p>
                  {(clientView.change_requests as any[]).map((cr: any, i: number) => (
                    <div key={i} className="bg-slate-800/50 rounded p-2 text-xs text-slate-400">
                      "{cr.text}" — {new Date(cr.created_at).toLocaleDateString()}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-slate-800/50 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-500">
          Powered by Brandaro · Custom website solutions for local businesses
        </div>
      </footer>
    </div>
  );
}
