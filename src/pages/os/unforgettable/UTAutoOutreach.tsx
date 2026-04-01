import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Mail, MessageSquare, Search, CheckCircle, AlertTriangle, Loader2, Users, Zap } from 'lucide-react';
import { format } from 'date-fns';

export default function UTAutoOutreach() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [selectedRfq, setSelectedRfq] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [channel, setChannel] = useState('email');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ name: string; status: string }[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [step, setStep] = useState(1);

  useEffect(() => {
    fetchSuppliers();
    fetchRfqs();
  }, []);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('ut_suppliers' as any).select('*').order('name');
    setSuppliers((data || []) as any[]);
  };

  const fetchRfqs = async () => {
    const { data } = await supabase.from('ut_rfq_requests' as any).select('*').order('created_at', { ascending: false });
    setRfqs((data || []) as any[]);
  };

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedSuppliers(suppliers.map(s => s.id));
  const clearAll = () => setSelectedSuppliers([]);

  const generateMessages = () => {
    const rfq = rfqs.find(r => r.id === selectedRfq);
    const newMessages: Record<string, string> = {};
    selectedSuppliers.forEach(id => {
      const supplier = suppliers.find(s => s.id === id);
      if (supplier) {
        newMessages[id] = `Hi ${supplier.name},\n\nI'm reaching out from Unforgettable Times USA. We are an event rental and party supply company${rfq ? ` looking for ${rfq.product_name}` : ''}.\n\nCould you please provide:\n- Product catalog and pricing\n- MOQ and bulk discounts\n- Branding/private label options\n- Shipping rates to USA (New York)\n${rfq ? `\nQuantity needed: ${rfq.quantity} units\nTarget price: $${rfq.max_budget_per_unit}/unit\n` : ''}\nWe're looking to build a long-term supplier relationship and scale orders quickly.\n\nThank you,\nUnforgettable Times Sourcing Team`;
      }
    });
    setMessages(newMessages);
    setStep(4);
  };

  const sendAll = async () => {
    setSending(true);
    setResults([]);
    const total = selectedSuppliers.length;
    let sent = 0;
    const newResults: { name: string; status: string }[] = [];

    for (const id of selectedSuppliers) {
      const supplier = suppliers.find(s => s.id === id);
      if (!supplier) continue;

      const to = channel === 'email' ? supplier.contact_email : supplier.whatsapp_number;
      if (!to) {
        newResults.push({ name: supplier.name, status: `⚠️ No ${channel}` });
        sent++;
        setProgress((sent / total) * 100);
        setResults([...newResults]);
        continue;
      }

      try {
        // Create thread first
        const { data: thread } = await supabase.from('ut_supplier_threads' as any).insert({
          supplier_id: id,
          supplier_name: supplier.name,
          supplier_email: supplier.contact_email,
          supplier_whatsapp: supplier.whatsapp_number,
          rfq_id: selectedRfq || null,
          product_name: rfqs.find(r => r.id === selectedRfq)?.product_name || 'General Inquiry',
          subject: `Sourcing Inquiry - Unforgettable Times`,
          last_message_at: new Date().toISOString(),
          last_message_preview: messages[id]?.substring(0, 100),
          status: 'active',
        } as any).select().single();

        const { error } = await supabase.functions.invoke('supplier-send', {
          body: {
            channel,
            to,
            subject: 'Sourcing Inquiry - Unforgettable Times USA',
            body: messages[id],
            supplier_id: id,
            supplier_name: supplier.name,
            rfq_id: selectedRfq || null,
            thread_id: thread?.id || null,
            product_name: rfqs.find(r => r.id === selectedRfq)?.product_name,
          }
        });
        if (error) throw error;
        newResults.push({ name: supplier.name, status: '✅ Sent' });
      } catch {
        newResults.push({ name: supplier.name, status: '❌ Failed' });
      }

      sent++;
      setProgress((sent / total) * 100);
      setResults([...newResults]);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }

    setSending(false);
    const successCount = newResults.filter(r => r.status.includes('✅')).length;
    toast.success(`Outreach complete: ${successCount} sent, ${total - successCount} failed`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">🤖 Auto Outreach Engine</h1>
        <p className="text-muted-foreground">Automatically contact multiple suppliers with one click</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[1,2,3,4,5].map(s => (
          <div key={s} className="flex items-center gap-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{s}</div>
            {s < 5 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select RFQ */}
      {step >= 1 && (
        <Card>
          <CardHeader><CardTitle>Step 1 — Select or Create RFQ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedRfq} onValueChange={v => { setSelectedRfq(v); setStep(Math.max(step, 2)); }}>
              <SelectTrigger><SelectValue placeholder="Select existing RFQ..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No RFQ — General Outreach</SelectItem>
                {rfqs.map(r => <SelectItem key={r.id} value={r.id}>{r.product_name} — {r.quantity} units</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setStep(Math.max(step, 2))}>Skip — General Outreach</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Suppliers */}
      {step >= 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Step 2 — Select Suppliers to Contact</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={clearAll}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {suppliers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No suppliers found. Add suppliers in Supplier Manager first.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {suppliers.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                    <Checkbox checked={selectedSuppliers.includes(s.id)} onCheckedChange={() => toggleSupplier(s.id)} />
                    <span className="font-medium text-sm flex-1">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.contact_email || 'No email'}</span>
                    {s.whatsapp_number && <MessageSquare className="h-3 w-3 text-green-400" />}
                    {s.contact_email && <Mail className="h-3 w-3 text-blue-400" />}
                  </div>
                ))}
              </div>
            )}
            {selectedSuppliers.length > 0 && (
              <Button className="mt-3" onClick={() => setStep(3)}>
                <Users className="mr-1 h-4 w-4" /> Continue with {selectedSuppliers.length} suppliers
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Choose Channel */}
      {step >= 3 && (
        <Card>
          <CardHeader><CardTitle>Step 3 — Choose Channel</CardTitle></CardHeader>
          <CardContent className="flex gap-3">
            <Button variant={channel === 'email' ? 'default' : 'outline'} onClick={() => { setChannel('email'); generateMessages(); }}>
              <Mail className="mr-1 h-4 w-4" /> Email All Selected
            </Button>
            <Button variant={channel === 'whatsapp' ? 'default' : 'outline'} onClick={() => { setChannel('whatsapp'); generateMessages(); }}>
              <MessageSquare className="mr-1 h-4 w-4" /> WhatsApp All Selected
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review Messages */}
      {step >= 4 && !sending && results.length === 0 && (
        <Card>
          <CardHeader><CardTitle>Step 4 — Review Messages</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {selectedSuppliers.map(id => {
              const s = suppliers.find(sup => sup.id === id);
              if (!s) return null;
              return (
                <div key={id} className="border rounded-lg p-3">
                  <p className="font-medium text-sm mb-1">Message to {s.name}:</p>
                  <Textarea value={messages[id] || ''} onChange={e => setMessages({ ...messages, [id]: e.target.value })} rows={6} className="text-xs" />
                </div>
              );
            })}
            <Button size="lg" className="w-full" onClick={() => { setStep(5); sendAll(); }}>
              <Zap className="mr-1 h-4 w-4" /> Send to {selectedSuppliers.length} Suppliers Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Sending Progress */}
      {(sending || results.length > 0) && (
        <Card>
          <CardHeader><CardTitle>{sending ? 'Sending...' : '✅ Outreach Complete'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} className="h-3" />
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-1">
                  <span>{r.name}</span>
                  <span>{r.status}</span>
                </div>
              ))}
            </div>
            {!sending && (
              <div className="flex gap-2 mt-4">
                <Badge variant="outline" className="text-green-400">{results.filter(r => r.status.includes('✅')).length} sent</Badge>
                <Badge variant="outline" className="text-red-400">{results.filter(r => !r.status.includes('✅')).length} failed</Badge>
                <Button variant="link" size="sm" onClick={() => { setStep(1); setResults([]); setProgress(0); setSelectedSuppliers([]); }}>
                  Start New Outreach →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
