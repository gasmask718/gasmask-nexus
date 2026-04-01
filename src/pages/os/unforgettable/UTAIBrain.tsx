
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message { role: 'user' | 'assistant'; content: string; }

const QUICK_QUESTIONS = [
  "How many bookings this month?",
  "Who are my top 3 ambassadors?",
  "What's my net margin?",
  "Which event type makes most money?",
  "How many quiz leads this week?",
  "What vendors need to be paid?",
];

export default function UTAIBrain() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ut-ai-brain', {
        body: { messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) },
      });

      if (error) throw error;
      const answer = data?.answer || data?.choices?.[0]?.message?.content || 'No response received.';
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (e: any) {
      toast.error('AI Brain error: ' + (e.message || 'Unknown error'));
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🧠 AI Command Brain</h1>
        <p className="text-muted-foreground">Ask anything about your business in plain English</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map(q => (
          <Button key={q} variant="outline" size="sm" onClick={() => sendMessage(q)} disabled={loading}>{q}</Button>
        ))}
      </div>

      <Card className="min-h-[400px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />Conversation</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}><Trash2 className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 space-y-4 overflow-auto mb-4 max-h-[500px]">
            {messages.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Ask me anything about your Unforgettable Times business...</p>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-muted rounded-lg px-4 py-2 text-sm animate-pulse">Thinking...</div></div>}
          </div>
          <div className="flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about your business..." onKeyDown={e => e.key === 'Enter' && sendMessage(input)} disabled={loading} />
            <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
