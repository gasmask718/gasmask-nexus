
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const CATEGORIES: Record<string, string> = {
  LED: '💡 LED & Lighting', Balloon: '🎈 Balloons & Decor', Favor: '🎁 Party Favors',
  Cake: '🎂 Cake & Dessert', 'Photo Booth': '📸 Photo Booth', Bundle: '🛍️ Gift Sets',
  Glass: '🥂 Drinkware', Cup: '🥂 Drinkware', Sash: '🎀 Wearables',
  Table: '🎊 Essentials', Chair: '🎊 Essentials',
};

interface MockProduct { id: string; name: string; price: string; category: string; inventory: number; }

export default function UTProductOrganizer() {
  const [products, setProducts] = useState<MockProduct[]>([]);

  const autoCategorize = () => {
    const updated = products.map(p => {
      const key = Object.keys(CATEGORIES).find(k => p.name.toLowerCase().includes(k.toLowerCase()));
      return { ...p, category: key ? CATEGORIES[key] : p.category };
    });
    setProducts(updated);
    toast.success('Auto-categorization complete');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📦 Product Organizer</h1>
        <p className="text-muted-foreground">Manage how AutoDS products are categorized in your shop</p>
      </div>

      <Button onClick={autoCategorize}><Zap className="h-4 w-4 mr-2" />Auto-Categorize All Products</Button>

      <Card>
        <CardHeader><CardTitle>Products</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Inventory</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Connect Shopify to load products</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-dashed border-amber-500/50">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">Category Key</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(CATEGORIES).filter((v, i, a) => a.findIndex(x => x[1] === v[1]) === i).map(([k, v]) => (
              <span key={k}>{v}</span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
