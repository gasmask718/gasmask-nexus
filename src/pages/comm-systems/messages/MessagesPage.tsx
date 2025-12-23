import CommSystemsLayout from "../CommSystemsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Search, Send, Bot, User, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function MessagesPage() {
  const [search, setSearch] = useState('');
  const { data: messages, isLoading } = useQuery({
    queryKey: ['comm-messages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('call_center_messages').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    }
  });

  const filtered = messages?.filter(m => m.from_number?.includes(search) || m.message_body?.toLowerCase().includes(search.toLowerCase()));

  return (
    <CommSystemsLayout title="Messages" subtitle="Execute and log SMS conversations">
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search messages..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Button><Send className="h-4 w-4 mr-2" />New Message</Button>
      </div>
      <div className="space-y-3">
        {isLoading ? <Card><CardContent className="py-8 text-center">Loading...</CardContent></Card> : filtered?.length ? filtered.map(msg => (
          <Card key={msg.id}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${msg.direction === 'inbound' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                {msg.direction === 'inbound' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
              </div>
              <div className="flex-1"><p className="font-medium">{msg.from_number}</p><p className="text-sm text-muted-foreground line-clamp-1">{msg.message_body}</p></div>
              {msg.ai_reply && <Badge variant="secondary"><Bot className="h-3 w-3 mr-1" />AI</Badge>}
            </CardContent>
          </Card>
        )) : <Card><CardContent className="py-8 text-center text-muted-foreground">No messages</CardContent></Card>}
      </div>
    </CommSystemsLayout>
  );
}
