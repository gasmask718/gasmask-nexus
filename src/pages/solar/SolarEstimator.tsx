import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { calculateSolarEstimate, type SolarEstimate } from '@/services/solarEstimation';
import { toast } from 'sonner';
import {
  Sun, Zap, DollarSign, Home, Battery, TrendingUp, ArrowRight, Sparkles, Shield, Calendar
} from 'lucide-react';

const AMBER = '#E8A317';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

export default function SolarEstimator() {
  const [address, setAddress] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [monthlyBill, setMonthlyBill] = useState('');
  const [homeSqft, setHomeSqft] = useState('');
  const [estimate, setEstimate] = useState<SolarEstimate | null>(null);
  const [showChat, setShowChat] = useState(false);

  const saveEstimate = useMutation({
    mutationFn: async (est: SolarEstimate) => {
      const { error } = await supabase.from('solar_property_intelligence' as any).insert({
        address: `${street}, ${city}, ${state} ${zip}`,
        roof_estimated_sqft: est.roof_estimated_sqft,
        estimated_panel_count: est.estimated_panel_count,
        estimated_system_kw: est.estimated_system_kw,
        estimated_monthly_savings: est.estimated_monthly_savings,
        sunlight_score: est.sunlight_score,
        roof_complexity_score: est.roof_complexity_score,
        confidence_score: est.confidence_score,
        data_source: 'ai_estimate',
      });
      if (error) throw error;
    },
  });

  const handleEstimate = () => {
    if (!state) {
      toast.error('Please select your state');
      return;
    }
    const result = calculateSolarEstimate({
      monthly_bill: monthlyBill ? Number(monthlyBill) : undefined,
      home_sqft: homeSqft ? Number(homeSqft) : undefined,
      state,
    });
    setEstimate(result);
    saveEstimate.mutate(result);
  };

  const handleAddressSelect = (parsed: { street: string; city: string; state: string; zip: string }) => {
    setStreet(parsed.street);
    setCity(parsed.city);
    setState(parsed.state);
    setZip(parsed.zip);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sun className="h-6 w-6" style={{ color: AMBER }} />
          Solar Property Intelligence Engine
        </h1>
        <p className="text-muted-foreground">Instant solar potential analysis for any property</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card className="border-2" style={{ borderColor: `${AMBER}30` }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="h-5 w-5" style={{ color: AMBER }} />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="address">Property Address</Label>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={(parsed) => {
                  setAddress(parsed.street);
                  handleAddressSelect(parsed);
                }}
                placeholder="Start typing an address..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bill">Monthly Electric Bill ($)</Label>
                <Input id="bill" type="number" value={monthlyBill} onChange={(e) => setMonthlyBill(e.target.value)} placeholder="150" />
              </div>
              <div>
                <Label htmlFor="sqft">Home Size (sqft)</Label>
                <Input id="sqft" type="number" value={homeSqft} onChange={(e) => setHomeSqft(e.target.value)} placeholder="1800" />
              </div>
            </div>

            <Button className="w-full text-black font-bold text-base h-12" style={{ backgroundColor: AMBER }} onClick={handleEstimate}>
              <Zap className="h-5 w-5 mr-2" />
              Generate Solar Estimate
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {estimate ? (
          <div className="space-y-4">
            <Card className="border-2 border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg text-green-400">
                  <Sparkles className="h-5 w-5" />
                  Your Solar Potential
                </CardTitle>
                <p className="text-xs text-muted-foreground">* All values are estimated</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Estimated Panels', value: estimate.estimated_panel_count, icon: Battery, suffix: ' panels' },
                    { label: 'System Size', value: estimate.estimated_system_kw, icon: Zap, suffix: ' kW' },
                    { label: 'Monthly Savings', value: `$${estimate.estimated_monthly_savings}`, icon: DollarSign, suffix: '/mo' },
                    { label: 'Sunlight Score', value: estimate.sunlight_score, icon: Sun, suffix: '/100' },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-lg bg-muted/30 text-center">
                      <item.icon className="h-6 w-6 mx-auto mb-1 text-green-400" />
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Annual Savings</span>
                  <span className="font-bold text-green-400">${estimate.estimated_annual_savings.toLocaleString()}/yr</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">25-Year Savings</span>
                  <span className="font-bold text-green-400">${estimate.estimated_25yr_savings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">System Cost (after 30% ITC)</span>
                  <span className="font-bold">${estimate.estimated_system_cost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Payback Period</span>
                  <span className="font-bold">{estimate.payback_years} years</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">Confidence</span>
                  <Badge className={estimate.confidence_score >= 75 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                    {estimate.confidence_score}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full text-black font-bold text-base h-12"
              style={{ backgroundColor: AMBER }}
              onClick={() => setShowChat(true)}
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              Lock My Savings Plan — Talk to AI Advisor
            </Button>

            <div className="flex gap-2 text-xs text-muted-foreground justify-center">
              <Shield className="h-3 w-3" /> No commitment required
              <span>•</span>
              <Calendar className="h-3 w-3" /> Free consultation
            </div>
          </div>
        ) : (
          <Card className="border-border/50 flex items-center justify-center min-h-[300px]">
            <div className="text-center p-8">
              <Sun className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
              <h3 className="text-lg font-semibold mb-2">Enter Property Details</h3>
              <p className="text-sm text-muted-foreground">
                Fill in the property info to generate an instant solar potential analysis
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* AI Chat Panel - shows after CTA click */}
      {showChat && estimate && (
        <SolarAIChat estimate={estimate} address={`${street}, ${city}, ${state} ${zip}`} />
      )}
    </div>
  );
}

// ─── AI Chat Component ──────────────────────────────────────────────────────

import { useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Bot, User, Loader2 } from 'lucide-react';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function SolarAIChat({ estimate, address }: { estimate: SolarEstimate; address: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Create session on mount
  useEffect(() => {
    const createSession = async () => {
      const { data, error } = await supabase.from('solar_closing_sessions' as any).insert({
        session_type: 'chat',
        closing_stage: 'intro',
      }).select('id').single();
      if (data) setSessionId((data as any).id);
    };
    createSession();
  }, []);

  // Initial AI greeting
  useEffect(() => {
    const greeting = `Hey! 👋 I just pulled up your solar analysis for ${address}. Your home could support ${estimate.estimated_panel_count} panels and save you an estimated $${estimate.estimated_monthly_savings}/month — that's ${estimate.estimated_annual_savings.toLocaleString()}/year back in your pocket. This is exactly the kind of property that qualifies for the best incentives. Want me to walk you through how this works?`;
    setMessages([{ role: 'assistant', content: greeting }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/solar-ai-closer`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          session_id: sessionId,
          lead_context: {
            address,
            panels: estimate.estimated_panel_count,
            system_kw: estimate.estimated_system_kw,
            savings: estimate.estimated_monthly_savings,
          },
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        toast.error(errData.error || 'AI service error. Try again.');
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No stream body');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > 1) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { textBuffer = line + '\n' + textBuffer; break; }
        }
      }

      // Analyze intent after response
      if (sessionId && allMessages.length >= 3) {
        fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...allMessages, { role: 'assistant', content: assistantSoFar }],
            session_id: sessionId,
            action: 'analyze_intent',
          }),
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, sessionId, address, estimate]);

  return (
    <Card className="border-2" style={{ borderColor: `${AMBER}40` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" style={{ color: AMBER }} />
          AI Solar Advisor — Sarah
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Messages */}
        <div className="h-96 overflow-auto space-y-3 mb-4 p-3 rounded-lg bg-muted/10">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ backgroundColor: `${AMBER}30`, color: AMBER }}>
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={`rounded-lg p-3 max-w-[80%] text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/40'}`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${AMBER}30`, color: AMBER }}>
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Quick Replies */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {['How much does it cost?', 'What financing options?', "I'm interested!", 'Not sure yet'].map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => { setInput(q); }}
            >
              {q}
            </Button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isLoading}
          />
          <Button
            style={{ backgroundColor: AMBER }}
            className="text-black"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
