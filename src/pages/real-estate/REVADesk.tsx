import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Phone, User, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SCRIPTS = {
  opening: `"Hey [seller name], this is [VA name] calling from Dynasty Property Group. I was reaching out about your property over at [address] — are you the owner?"`,
  qualifying: `"Perfect. I'm not going to waste your time — what would you need to walk away happy from this property?"`,
  offer: `"Okay, based on the condition and what we're seeing in that area — I can come in around [MAO]. We close all cash, no fees, no repairs. Would that work?"`,
  objection: `"I totally hear you. Our offer accounts for [repairs/market/timeline]. What's more important: highest price or getting this done fast and clean?"`,
  close: `"Let me get a simple agreement over to you today, and we'll get your cash within [close date]. Does that work?"`,
};

export default function REVADesk() {
  const [vas, setVas] = useState<any[]>([]);
  const [myLeads, setMyLeads] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('re_va_profiles').select('*').eq('is_active', true).then(({ data }) => setVas(data || []));
    supabase.from('re_leads').select('*').in('status', ['new','phone_found','queued','called','interested','appointment_set']).order('updated_at', { ascending: false }).limit(50).then(({ data }) => setMyLeads(data || []));
  }, []);

  const priorityColor = (s: string) => {
    if (s === 'interested' || s === 'appointment_set') return 'border-red-500';
    if (s === 'called') return 'border-amber-500';
    return 'border-green-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>VA Desk</h1>
        <p className="text-muted-foreground">Acquisition call center — focused interface</p>
      </div>

      {/* VA Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {vas.map(v => (
          <Card key={v.id}>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(59,109,17,0.15)' }}>
                <User className="h-5 w-5" style={{ color: '#3B6D11' }} />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{v.name}</div>
                <div className="text-xs text-muted-foreground">{v.role}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{v.calls_today}</div>
                <div className="text-xs text-muted-foreground">calls today</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">My Queue</TabsTrigger>
          <TabsTrigger value="scripts">Sales Mastery Engine</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Lead Queue ({myLeads.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myLeads.map(l => (
                  <div key={l.id} className={`flex items-center justify-between p-3 rounded-lg border-l-4 bg-card ${priorityColor(l.status)}`}>
                    <div className="flex-1">
                      <div className="font-medium">{l.first_name} {l.last_name}</div>
                      <div className="text-sm text-muted-foreground">{l.property_address}, {l.state}</div>
                      <div className="text-xs text-muted-foreground">
                        ARV: ${(l.arv || 0).toLocaleString()} | MAO: ${(l.mao || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{l.status?.replace(/_/g, ' ')}</Badge>
                      {l.phone && (
                        <Button size="sm" style={{ backgroundColor: '#3B6D11' }}>
                          <Phone className="h-4 w-4 mr-1" />Call
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scripts" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Sales Mastery Engine</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(SCRIPTS).map(([stage, script]) => (
                <div key={stage} className="p-4 rounded-lg border border-border">
                  <div className="font-semibold capitalize mb-2" style={{ color: '#3B6D11' }}>{stage}</div>
                  <p className="text-sm italic text-muted-foreground">{script}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
