import CommSystemsLayout from "../CommSystemsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Search, Send, ArrowDownLeft, ArrowUpRight, Bot } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function EmailsPage() {
  const [search, setSearch] = useState('');
  const { data: emails, isLoading } = useQuery({
    queryKey: ['comm-emails'],
    queryFn: async () => {
      const { data, error } = await supabase.from('call_center_emails').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    }
  });

  const filtered = emails?.filter(e => e.subject?.toLowerCase().includes(search.toLowerCase()) || e.from_address?.includes(search));

  return (
    <CommSystemsLayout title="Emails" subtitle="Execute and log email communications">
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search emails..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Button><Send className="h-4 w-4 mr-2" />Compose</Button>
      </div>
      <div className="space-y-3">
        {isLoading ? <Card><CardContent className="py-8 text-center">Loading...</CardContent></Card> : filtered?.length ? filtered.map(email => (
          <Card key={email.id}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${email.direction === 'inbound' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                {email.direction === 'inbound' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
              </div>
              <div className="flex-1"><p className="font-medium">{email.subject || '(No Subject)'}</p><p className="text-sm text-muted-foreground">{email.from_address}</p></div>
              {email.ai_handled && <Badge variant="secondary"><Bot className="h-3 w-3 mr-1" />AI</Badge>}
              {email.priority === 'high' && <Badge variant="destructive">High</Badge>}
            </CardContent>
          </Card>
        )) : <Card><CardContent className="py-8 text-center text-muted-foreground">No emails</CardContent></Card>}
      </div>
    </CommSystemsLayout>
  );
}
