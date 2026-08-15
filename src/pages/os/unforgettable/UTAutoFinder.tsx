import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, Bot, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { errText } from "@/lib/errText";

const STATUS_COLORS: Record<string, string> = {
  searching: 'text-red-400 border-red-400/50',
  outreach_sent: 'text-yellow-400 border-yellow-400/50',
  quote_received: 'text-blue-400 border-blue-400/50',
  confirmed: 'text-green-400 border-green-400/50',
};

const STATUS_EMOJI: Record<string, string> = {
  searching: '🔴',
  outreach_sent: '🟡',
  quote_received: '🔵',
  confirmed: '🟢',
};

export default function UTAutoFinder() {
  const [needs, setNeeds] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newQty, setNewQty] = useState(50);
  const [newPrice, setNewPrice] = useState(30);
  const [newPriority, setNewPriority] = useState('medium');
  const [newNotes, setNewNotes] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);

  useEffect(() => { fetchNeeds(); }, []);

  const fetchNeeds = async () => {
    const { data } = await supabase.from('ut_product_needs' as any).select('*').order('created_at', { ascending: false });
    setNeeds((data || []) as any[]);
  };

  const addNeed = async () => {
    if (!newName.trim()) { toast.error('Enter product name'); return; }
    await supabase.from('ut_product_needs' as any).insert({
      product_name: newName,
      category: newCategory || null,
      quantity_needed: newQty,
      target_unit_price: newPrice,
      priority: newPriority,
      notes: newNotes || null,
    } as any);
    toast.success('Product need added');
    setShowAdd(false);
    setNewName(''); setNewCategory(''); setNewQty(50); setNewPrice(30); setNewNotes('');
    fetchNeeds();
  };

  const deleteNeed = async (id: string) => {
    await supabase.from('ut_product_needs' as any).delete().eq('id', id);
    toast.success('Removed');
    fetchNeeds();
  };

  const findSuppliers = async (need: any) => {
    setSearchingId(need.id);
    try {
      const prompt = `Find 5 suppliers for: ${need.product_name}
Category: ${need.category || 'General'}
Quantity: ${need.quantity_needed} units
Target price: $${need.target_unit_price}/unit

For each supplier provide:
- Company name
- Platform (Alibaba/Local US)
- Estimated price range
- MOQ
- Contact method

Focus on suppliers that can do private label branding for an event rental company called "Unforgettable Times".`;

      const { data, error } = await supabase.functions.invoke('ut-ai-brain', {
        body: { message: prompt }
      });

      if (error) throw error;

      await supabase.from('ut_product_needs' as any).update({
        status: 'outreach_sent',
        suppliers_found: 5,
        notes: (need.notes || '') + '\n\nAI Research: ' + (data?.response || data?.message || 'Complete').substring(0, 500),
      } as any).eq('id', need.id);

      toast.success(`Suppliers found for ${need.product_name}`);
      fetchNeeds();
    } catch (err) {
      console.error(errText(err));
      toast.error('Failed to search');
    } finally {
      setSearchingId(null);
    }
  };

  const bulkFind = async () => {
    const highPriority = needs.filter(n => n.priority === 'high' && n.status === 'searching');
    if (highPriority.length === 0) { toast.info('No high-priority items need searching'); return; }
    setSearching(true);
    for (const need of highPriority) {
      await findSuppliers(need);
      await new Promise(r => setTimeout(r, 1000));
    }
    setSearching(false);
    toast.success(`Searched ${highPriority.length} products`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔄 Bulk Supplier Auto-Finder</h1>
          <p className="text-muted-foreground">Tell the system what you need. AI finds suppliers automatically.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(true)}><Plus className="mr-1 h-4 w-4" /> Add Product Need</Button>
          <Button variant="outline" onClick={bulkFind} disabled={searching}>
            {searching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bot className="mr-1 h-4 w-4" />}
            Find All High Priority
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Add Product Need</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input placeholder="Product Name *" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder="Category" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 High Priority</SelectItem>
                  <SelectItem value="medium">🟡 Medium Priority</SelectItem>
                  <SelectItem value="low">🟢 Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div><label className="text-xs">Quantity Needed</label><Input type="number" value={newQty} onChange={e => setNewQty(Number(e.target.value))} /></div>
              <div><label className="text-xs">Target $/unit</label><Input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} /></div>
              <Textarea placeholder="Notes..." value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={1} />
            </div>
            <div className="flex gap-2">
              <Button onClick={addNeed}>Add</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {['searching', 'outreach_sent', 'quote_received', 'confirmed'].map(status => (
          <Card key={status}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{needs.filter(n => n.status === status).length}</p>
              <p className="text-xs text-muted-foreground capitalize">{STATUS_EMOJI[status]} {status.replace('_', ' ')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Needs List */}
      <Card>
        <CardHeader><CardTitle>Product Needs ({needs.length})</CardTitle></CardHeader>
        <CardContent>
          {needs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No product needs yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {needs.map(need => (
                <div key={need.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/30">
                  <span className="text-lg">{STATUS_EMOJI[need.status] || '⚪'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{need.product_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {need.category && <span>{need.category}</span>}
                      <span>Qty: {need.quantity_needed}</span>
                      <span>Target: ${need.target_unit_price}/unit</span>
                      {need.suppliers_found > 0 && <span>📦 {need.suppliers_found} suppliers</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[need.status] || ''}>{need.status?.replace('_', ' ')}</Badge>
                  <Badge variant={need.priority === 'high' ? 'destructive' : need.priority === 'medium' ? 'default' : 'outline'}>{need.priority}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => findSuppliers(need)} disabled={searchingId === need.id}>
                    {searchingId === need.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteNeed(need.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
