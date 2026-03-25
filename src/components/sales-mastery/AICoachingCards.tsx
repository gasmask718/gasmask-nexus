import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Brain, Lightbulb } from 'lucide-react';

type Hub = 'real_estate' | 'surplus_funds';

interface AICoachingCardsProps {
  hub: Hub;
  accentColor: string;
  callNotes?: string;
}

export function AICoachingCards({ hub, accentColor, callNotes = '' }: AICoachingCardsProps) {
  const [noteInput, setNoteInput] = useState('');
  const combinedNotes = `${callNotes} ${noteInput}`.toLowerCase();

  const { data: triggers = [] } = useQuery({
    queryKey: ['coaching-triggers', hub],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_mastery_coaching_triggers')
        .select('*')
        .in('hub', [hub, 'both'])
        .eq('is_active', true)
        .order('priority', { ascending: true });
      return data ?? [];
    },
  });

  const activeCards = triggers.filter((t: any) =>
    combinedNotes.includes(t.trigger_keyword.toLowerCase())
  );

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" style={{ color: accentColor }} />
          AI Coaching — Live
        </CardTitle>
        <Input
          placeholder="Type call notes here... (triggers coaching cards)"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          className="mt-2 text-xs h-8"
        />
      </CardHeader>
      <CardContent className="space-y-2">
        {activeCards.length > 0 ? (
          activeCards.map((card: any) => (
            <div
              key={card.id}
              className="p-3 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-300"
              style={{ borderColor: accentColor, backgroundColor: `${accentColor}10` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="h-4 w-4" style={{ color: accentColor }} />
                <span className="font-bold text-sm">{card.coaching_card_title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{card.coaching_card_body}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Type call notes above to get live coaching tips</p>
            <p className="text-xs mt-1 opacity-50">Try: "inheritance", "price", "need to think", "divorce"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
