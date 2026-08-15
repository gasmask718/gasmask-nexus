import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Plus, Loader2, Globe, MapPin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { errText } from "@/lib/errText";

export default function UTSupplierFinder() {
  const [product, setProduct] = useState('');
  const [supplierType, setSupplierType] = useState('both');
  const [quantity, setQuantity] = useState(100);
  const [maxBudget, setMaxBudget] = useState(30);
  const [needsBranding, setNeedsBranding] = useState(true);
  const [urgency, setUrgency] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState('');

  const handleSearch = async () => {
    if (!product.trim()) { toast.error('Enter a product name'); return; }
    setLoading(true);
    setResults('');

    try {
      const prompt = `You are a sourcing expert for a party rental and event supply company called "Unforgettable Times". 

I need to find suppliers for: ${product}

Requirements:
- Supplier type: ${supplierType === 'chinese' ? 'Chinese (Alibaba/DHgate)' : supplierType === 'local' ? 'Local US Wholesaler' : 'Both Chinese and US'}
- Quantity needed: ${quantity} units
- Max budget per unit: $${maxBudget}
- Need branding: ${needsBranding ? 'Yes - need private label with our logo' : 'No'}
- Urgency: ${urgency}

Please provide a detailed sourcing report with:

${supplierType !== 'local' ? `## 🇨🇳 ALIBABA SOURCING STRATEGY

### Search Terms to Use
(List 3-5 specific search terms)

### Filters to Apply
- Trade Assurance: ✅
- Verified Supplier: ✅
- Minimum 2+ years
- 90%+ response rate

### What to Look For
(Product-specific guidance)

### Average Price Range
(Estimated pricing at the given MOQ)

### Red Flags to Avoid
(Product-specific warnings)

### Sample Message to Send
(Auto-generated outreach message)` : ''}

${supplierType !== 'chinese' ? `## 🇺🇸 LOCAL US SOURCING STRATEGY

### Google Search Terms
(List 3-5 specific terms)

### Directories to Check
- ThomasNet.com
- WholesaleCentral.com
- Faire.com

### Trade Shows to Attend
(Relevant trade shows for this product category)

### Average Price Range
(US supplier pricing, typically higher but faster)` : ''}

## 💡 RECOMMENDATION
(Which approach is best for this specific product given the requirements)`;

      const response = await supabase.functions.invoke('ut-ai-brain', {
        body: { message: prompt }
      });

      if (response.error) throw response.error;
      setResults(response.data?.response || response.data?.message || 'No results generated');
    } catch (err) {
      console.error(errText(err));
      toast.error('Failed to generate supplier research');
      setResults('Error generating research. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addToSupplierManager = async (name: string) => {
    try {
      await supabase.from('ut_suppliers' as any).insert({
        name,
        status: 'contacted',
        product_categories: [product],
        notes: `Found via Supplier Finder for: ${product}`
      });
      toast.success(`${name} added to Supplier Manager`);
    } catch { toast.error('Failed to add supplier'); }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">🔍 Supplier Finder</h1>
        <p className="text-muted-foreground">Find and qualify suppliers for any product category</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Search for Suppliers</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">What product do you need?</label>
            <Input value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g. LED marquee letters, balloon arch kits, photo booth props..." className="text-lg" />
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Supplier Type</label>
              <Select value={supplierType} onValueChange={setSupplierType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chinese"><Globe className="inline mr-1 h-4 w-4" />Chinese (Alibaba/DHgate)</SelectItem>
                  <SelectItem value="local"><MapPin className="inline mr-1 h-4 w-4" />Local US Wholesaler</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Quantity</label><Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
            <div><label className="text-sm font-medium">Max $/unit</label><Input type="number" value={maxBudget} onChange={e => setMaxBudget(Number(e.target.value))} /></div>
            <div>
              <label className="text-sm font-medium">Urgency</label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">Fast (under 2 weeks)</SelectItem>
                  <SelectItem value="standard">Standard (2-4 weeks)</SelectItem>
                  <SelectItem value="economy">Economy (sea freight OK)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={needsBranding} onChange={e => setNeedsBranding(e.target.checked)} />
            <span className="text-sm">Needs UT branding / private label</span>
          </label>
          <Button onClick={handleSearch} disabled={loading} size="lg" className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Researching suppliers...</> : <><Search className="mr-2 h-4 w-4" />Find Suppliers</>}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>📊 Supplier Research Report</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(results); toast.success('Report copied'); }}>Copy Report</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{results}</ReactMarkdown>
            </div>
            <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
              <p className="font-medium mb-2">Quick Add to Supplier Manager:</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => {
                  const name = prompt('Enter supplier name to add:');
                  if (name) addToSupplierManager(name);
                }}><Plus className="mr-1 h-3 w-3" />Add Supplier Lead</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
