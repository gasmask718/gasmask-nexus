import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Send, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK_ACTIONS = [
  "Summarize today's performance",
  "Which bookings need attention?",
  "Top service this week?",
  "Any issues I should know about?",
];

export default function TTAIBrain() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch live context
  const { data: liveContext } = useQuery({
    queryKey: ['tt-ai-context'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [bookingsRes, partnersRes, confirmationsRes, revenueRes, topServiceRes] = await Promise.all([
        supabase.from('tt_bookings').select('id, status').gte('created_at', today),
        supabase.from('tt_partners').select('id').eq('status', 'active'),
        supabase.from('tt_confirmation_requests').select('id').eq('status', 'pending'),
        supabase.from('tt_bookings').select('total_price').gte('created_at', today),
        supabase.from('tt_bookings').select('service_type').gte('created_at', weekAgo),
      ]);

      const revenue = (revenueRes.data || []).reduce((s, b) => s + Number(b.total_price || 0), 0);
      const activeBookings = (bookingsRes.data || []).filter(b => b.status !== 'cancelled').length;
      const serviceCounts = (topServiceRes.data || []).reduce((acc, b) => { acc[b.service_type || 'unknown'] = (acc[b.service_type || 'unknown'] || 0) + 1; return acc; }, {} as Record<string, number>);
      const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        revenueToday: revenue,
        activeBookings,
        pendingConfirmations: confirmationsRes.data?.length || 0,
        activePartners: partnersRes.data?.length || 0,
        topServiceThisWeek: topService ? `${topService[0]} (${topService[1]} bookings)` : 'N/A',
      };
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const buildSystemPrompt = () => {
    const ctx = liveContext || { revenueToday: 0, activeBookings: 0, pendingConfirmations: 0, activePartners: 0, topServiceThisWeek: 'N/A' };
    return `You are the Dynasty OS AI Command Brain for TopTier Experience. You have real-time access to this live business data:

- Revenue Today: $${ctx.revenueToday.toLocaleString()}
- Active Bookings: ${ctx.activeBookings}
- Pending Confirmations: ${ctx.pendingConfirmations}
- Active Partners: ${ctx.activePartners}
- Top Service This Week: ${ctx.topServiceThisWeek}

Answer questions about the business, identify issues, suggest actions, and analyze performance. Be concise and direct. Use bullet points and numbers. Format responses in markdown.`;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tt-ai-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: buildSystemPrompt(),
        }),
      });

      if (resp.status === 429) { toast.error('Rate limited — try again shortly'); setIsLoading(false); return; }
      if (resp.status === 402) { toast.error('Credits needed — add funds in Settings'); setIsLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
    } catch (e) {
      console.error('AI Brain error:', e);
      upsertAssistant('Sorry, I encountered an error. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Brain className="h-6 w-6 text-[#C9A84C]" /> AI Command Brain</h1>
        <p className="text-white/40 text-sm">Real-time intelligence for TopTier operations</p>
      </div>

      {/* Live Context Bar */}
      {liveContext && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {[
            { label: 'Revenue Today', value: `$${liveContext.revenueToday.toLocaleString()}` },
            { label: 'Active Bookings', value: liveContext.activeBookings },
            { label: 'Pending', value: liveContext.pendingConfirmations },
            { label: 'Partners', value: liveContext.activePartners },
          ].map(m => (
            <div key={m.label} className="bg-white/5 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-white/40">{m.label}: </span>
              <span className="text-[#C9A84C] font-semibold">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chat Area */}
      <Card className="flex-1 bg-[#0D0D0D]/80 backdrop-blur border-[#C9A84C]/10 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-[#C9A84C]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Dynasty AI Command Brain</h3>
              <p className="text-white/40 text-sm max-w-md">Ask about business performance, identify issues, or get actionable insights from real-time data.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[#C9A84C] text-black rounded-br-md'
                      : 'bg-white/5 text-white border border-white/5 rounded-bl-md'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-[#C9A84C]" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <CardContent className="border-t border-white/5 p-4 space-y-3">
          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            {QUICK_ACTIONS.map(q => (
              <Button key={q} size="sm" variant="outline" className="border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C]/10 text-xs h-7" onClick={() => sendMessage(q)}>
                {q}
              </Button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ask the AI Brain..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
            <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="bg-[#C9A84C] hover:bg-[#B8973F] text-black px-4">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
