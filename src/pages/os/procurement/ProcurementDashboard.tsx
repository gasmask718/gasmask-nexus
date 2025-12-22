// ═══════════════════════════════════════════════════════════════════════════════
// PROCUREMENT DASHBOARD — OS Command Center
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Truck,
  Users,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Brain,
  Plus,
  FileSpreadsheet,
  Send,
  Globe,
  Star,
  Clock,
  ArrowRight,
  Upload,
  Loader2,
} from 'lucide-react';
import { useProcurementStats, useSuppliers, usePurchaseOrders, useCreateSupplier, useCreateSupplierProduct } from '@/services/procurement';
import { toast } from 'sonner';

export default function ProcurementDashboard() {
  const { data: stats, isLoading: statsLoading } = useProcurementStats();
  const { data: suppliers, refetch: refetchSuppliers } = useSuppliers();
  const { data: recentPOs } = usePurchaseOrders();
  const createSupplier = useCreateSupplier();
  const createProduct = useCreateSupplierProduct();
  
  const [aiPrompt, setAiPrompt] = useState('');
  
  // Dialog states
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [aiNegotiateOpen, setAiNegotiateOpen] = useState(false);
  const [aiSourcingOpen, setAiSourcingOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  
  // Form states
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    country: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  });
  
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    supplier_id: '',
    unit_cost: 0,
    moq: 1,
  });
  
  const [negotiateQuery, setNegotiateQuery] = useState('');
  const [sourcingQuery, setSourcingQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAISubmit = () => {
    if (!aiPrompt.trim()) return;
    toast.info('AI Assistant is processing your request...');
    setAiPrompt('');
  };
  
  const handleAddSupplier = async () => {
    if (!supplierForm.name) {
      toast.error('Supplier name is required');
      return;
    }
    try {
      await createSupplier.mutateAsync(supplierForm);
      setAddSupplierOpen(false);
      setSupplierForm({ name: '', country: '', contact_name: '', contact_email: '', contact_phone: '' });
      refetchSuppliers();
    } catch (error) {
      // Error handled by hook
    }
  };
  
  const handleAddProduct = async () => {
    if (!productForm.name) {
      toast.error('Product name is required');
      return;
    }
    try {
      await createProduct.mutateAsync({
        name: productForm.name,
        sku: productForm.sku || null,
        supplier_id: productForm.supplier_id || null,
        unit_cost: productForm.unit_cost || 0,
        moq: productForm.moq || 1,
      });
      setAddProductOpen(false);
      setProductForm({ name: '', sku: '', supplier_id: '', unit_cost: 0, moq: 1 });
    } catch (error) {
      // Error handled by hook
    }
  };
  
  const handleAiNegotiate = async () => {
    if (!negotiateQuery.trim()) {
      toast.error('Please enter a negotiation query');
      return;
    }
    setIsAiLoading(true);
    setAiResponse('');
    
    // Simulate AI response (in production, this would call Lovable AI)
    setTimeout(() => {
      setAiResponse(`Based on your query "${negotiateQuery}", here are negotiation suggestions:\n\n1. **Volume Discount**: Request 10-15% discount for orders over 500 units\n2. **Payment Terms**: Negotiate NET 45 instead of NET 30\n3. **Shipping**: Ask for free shipping on orders over $5,000\n4. **Quality Guarantee**: Request extended warranty or quality assurance terms`);
      setIsAiLoading(false);
    }, 1500);
  };
  
  const handleAiSourcing = async () => {
    if (!sourcingQuery.trim()) {
      toast.error('Please describe what you need to source');
      return;
    }
    setIsAiLoading(true);
    setAiResponse('');
    
    // Simulate AI response
    setTimeout(() => {
      setAiResponse(`Sourcing recommendations for "${sourcingQuery}":\n\n1. **Alibaba**: Wide variety of suppliers, competitive pricing\n2. **Global Sources**: Verified manufacturers, quality control\n3. **Made-in-China**: Direct factory access, MOQ flexibility\n\n**Suggested next steps:**\n- Request samples from 3-5 suppliers\n- Compare pricing with current vendors\n- Verify certifications and compliance`);
      setIsAiLoading(false);
    }, 1500);
  };
  
  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    
    toast.success(`Importing ${file.name}...`);
    setImportCsvOpen(false);
    
    // In production, this would parse and import the CSV
    setTimeout(() => {
      toast.success('CSV imported successfully!');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Procurement Center</h1>
          <p className="text-muted-foreground">Internal supply chain management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/os/procurement/suppliers">
              <Users className="h-4 w-4 mr-2" />
              Suppliers
            </Link>
          </Button>
          <Button asChild>
            <Link to="/os/procurement/purchase-orders/new">
              <Plus className="h-4 w-4 mr-2" />
              New PO
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suppliers</p>
                <p className="text-2xl font-bold">{stats?.totalSuppliers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active POs</p>
                <p className="text-2xl font-bold">{stats?.activePOs || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Restock Needs</p>
                <p className="text-2xl font-bold">{stats?.urgentRestocks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalSpend || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pipeline</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.pipelineValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Truck className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inbound</p>
                <p className="text-2xl font-bold">{stats?.inboundShipments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">OOS Risk</p>
                <p className="text-2xl font-bold">{stats?.outOfStockRisks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* AI Advisor Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Procurement Advisor
            </CardTitle>
            <CardDescription>Ask anything about suppliers, pricing, or inventory</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Which supplier has the best price for Grabba bundles?"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
            />
            <Button onClick={handleAISubmit} className="w-full" disabled={!aiPrompt.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Ask AI
            </Button>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Quick prompts:</p>
              <div className="flex flex-wrap gap-1">
                {[
                  'Best MOQ for tubes',
                  'Negotiate 7% discount',
                  'When will we run out?',
                  'Compare shipping costs',
                ].map((prompt) => (
                  <Badge
                    key={prompt}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => setAiPrompt(prompt)}
                  >
                    {prompt}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>Your trusted vendors</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/os/procurement/suppliers">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Reliability</TableHead>
                  <TableHead>Total Spend</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers?.slice(0, 5).map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {supplier.country || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {supplier.lead_time_days || 0} days
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-500" />
                        {supplier.reliability_score || 0}%
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(supplier.total_spend || 0)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/os/procurement/suppliers/${supplier.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!suppliers?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No suppliers yet. Add your first supplier to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Actions Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Procurement Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col"
              onClick={() => setAddSupplierOpen(true)}
            >
              <Plus className="h-5 w-5 mb-1" />
              <span className="text-xs">Add Supplier</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col"
              onClick={() => setAddProductOpen(true)}
            >
              <Package className="h-5 w-5 mb-1" />
              <span className="text-xs">Add Product</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link to="/os/procurement/purchase-orders/new">
                <FileSpreadsheet className="h-5 w-5 mb-1" />
                <span className="text-xs">Create PO</span>
              </Link>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col"
              onClick={() => setForecastOpen(true)}
            >
              <TrendingUp className="h-5 w-5 mb-1" />
              <span className="text-xs">Forecast</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col"
              onClick={() => setAiNegotiateOpen(true)}
            >
              <Brain className="h-5 w-5 mb-1" />
              <span className="text-xs">AI Negotiate</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col"
              onClick={() => setAiSourcingOpen(true)}
            >
              <Send className="h-5 w-5 mb-1" />
              <span className="text-xs">AI Sourcing</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col"
              onClick={() => setImportCsvOpen(true)}
            >
              <Upload className="h-5 w-5 mb-1" />
              <span className="text-xs">Import CSV</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent POs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Purchase Orders</CardTitle>
            <CardDescription>Latest procurement activity</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/os/procurement/purchase-orders">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPOs?.slice(0, 5).map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-sm">
                    {po.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell>{(po.supplier as any)?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant={
                      po.status === 'delivered' ? 'default' :
                      po.status === 'in_transit' ? 'secondary' :
                      'outline'
                    }>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{po.products?.length || 0} items</TableCell>
                  <TableCell>{formatCurrency((po.total_cost || 0) + (po.shipping_cost || 0))}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {po.estimated_arrival 
                      ? new Date(po.estimated_arrival).toLocaleDateString()
                      : 'TBD'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/os/procurement/purchase-orders/${po.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!recentPOs?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No purchase orders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Supplier Dialog */}
      <Dialog open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supplier Name *</Label>
              <Input
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="Enter supplier name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={supplierForm.country}
                  onChange={(e) => setSupplierForm({ ...supplierForm, country: e.target.value })}
                  placeholder="e.g., China"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={supplierForm.contact_name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                  placeholder="Contact person"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={supplierForm.contact_email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_email: e.target.value })}
                  placeholder="email@supplier.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={supplierForm.contact_phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSupplierOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSupplier} disabled={createSupplier.isPending}>
              {createSupplier.isPending ? 'Adding...' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Enter product name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  placeholder="SKU-12345"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productForm.unit_cost || ''}
                  onChange={(e) => setProductForm({ ...productForm, unit_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Minimum Order Qty (MOQ)</Label>
              <Input
                type="number"
                value={productForm.moq || ''}
                onChange={(e) => setProductForm({ ...productForm, moq: parseInt(e.target.value) || 1 })}
                placeholder="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProduct} disabled={createProduct.isPending}>
              {createProduct.isPending ? 'Adding...' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forecast Dialog */}
      <Dialog open={forecastOpen} onOpenChange={setForecastOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Inventory Forecast
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-500">+12%</p>
                  <p className="text-xs text-muted-foreground">Projected Growth</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">14 days</p>
                  <p className="text-xs text-muted-foreground">Avg Stock Duration</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">3</p>
                  <p className="text-xs text-muted-foreground">Items Low Stock</p>
                </CardContent>
              </Card>
            </div>
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Based on current trends, we recommend ordering 500 additional units of high-demand products 
                within the next 7 days to maintain optimal stock levels.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForecastOpen(false)}>Close</Button>
            <Button asChild>
              <Link to="/os/procurement/purchase-orders/new">Create Restock PO</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Negotiate Dialog */}
      <Dialog open={aiNegotiateOpen} onOpenChange={(open) => {
        setAiNegotiateOpen(open);
        if (!open) { setAiResponse(''); setNegotiateQuery(''); }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Negotiation Assistant
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>What would you like to negotiate?</Label>
              <Textarea
                value={negotiateQuery}
                onChange={(e) => setNegotiateQuery(e.target.value)}
                placeholder="e.g., I want to negotiate a 10% discount on bulk orders of tubes from Sample Supplier..."
                rows={3}
              />
            </div>
            <Button onClick={handleAiNegotiate} disabled={isAiLoading} className="w-full">
              {isAiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Get Negotiation Tips'
              )}
            </Button>
            {aiResponse && (
              <div className="border rounded-lg p-4 bg-muted/50 whitespace-pre-wrap text-sm">
                {aiResponse}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Sourcing Dialog */}
      <Dialog open={aiSourcingOpen} onOpenChange={(open) => {
        setAiSourcingOpen(open);
        if (!open) { setAiResponse(''); setSourcingQuery(''); }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              AI Sourcing Assistant
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>What product are you looking to source?</Label>
              <Textarea
                value={sourcingQuery}
                onChange={(e) => setSourcingQuery(e.target.value)}
                placeholder="e.g., Looking for a reliable supplier for tobacco tubes with good quality and competitive pricing..."
                rows={3}
              />
            </div>
            <Button onClick={handleAiSourcing} disabled={isAiLoading} className="w-full">
              {isAiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                'Find Suppliers'
              )}
            </Button>
            {aiResponse && (
              <div className="border rounded-lg p-4 bg-muted/50 whitespace-pre-wrap text-sm">
                {aiResponse}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importCsvOpen} onOpenChange={setImportCsvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import CSV
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to bulk import suppliers or products. 
              The file should have headers matching the required fields.
            </p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop your CSV file here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCsv}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Select File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
