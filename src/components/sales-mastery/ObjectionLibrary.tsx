import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Search, Trophy } from 'lucide-react';

type Hub = 'real_estate' | 'surplus_funds';

interface ObjectionLibraryProps {
  hub: Hub;
  accentColor: string;
  compact?: boolean;
}

export function ObjectionLibrary({ hub, accentColor, compact = false }: ObjectionLibraryProps) {
  const [search, setSearch] = useState('');

  const { data: objections = [] } = useQuery({
    queryKey: ['objections', hub],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_mastery_objections')
        .select('*')
        .in('hub', [hub, 'both'])
        .order('win_count', { ascending: false });
      return data ?? [];
    },
  });

  const filtered = search
    ? objections.filter((o: any) =>
        o.objection_text.toLowerCase().includes(search.toLowerCase()) ||
        o.category?.toLowerCase().includes(search.toLowerCase())
      )
    : objections;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" style={{ color: accentColor }} />
          Objection Library
          <Badge variant="outline" className="ml-auto text-xs">{objections.length} responses</Badge>
        </CardTitle>
        <div className="relative mt-2">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-muted-foreground" />
          <Input
            placeholder='Search objections... (try "too low", "scam")'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </CardHeader>
      <CardContent className={`space-y-3 ${compact ? 'max-h-64 overflow-y-auto' : ''}`}>
        {filtered.map((o: any) => (
          <div key={o.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-red-400">🗣️ "{o.objection_text}"</p>
              {o.win_count > 0 && (
                <Badge variant="outline" className="text-xs flex items-center gap-1 flex-shrink-0">
                  <Trophy className="h-3 w-3" />{o.win_count}
                </Badge>
              )}
            </div>
            <p className="text-sm text-green-400 pl-4 mt-1">✅ {o.best_response}</p>
            {o.category && (
              <Badge variant="outline" className="mt-1 text-xs ml-4">{o.category}</Badge>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-4">No matching objections found</p>
        )}
      </CardContent>
    </Card>
  );
}
