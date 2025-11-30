// ═══════════════════════════════════════════════════════════════════════════════
// PROCUREMENT DASHBOARD — OS Command Center
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { useProcurementStats, useSuppliers, usePurchaseOrders } from '@/services/procurement';

export default function ProcurementDashboard() {
  const { data: stats, isLoading: statsLoading } = useProcurementStats();
  const { data: suppliers } = useSuppliers();
  const { data: recentPOs } = usePurchaseOrders();
  const [aiPrompt, setAiPrompt] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAISubmit = () => {
    // TODO: Connect to AI Workforce
    console.log('AI Prompt:', aiPrompt);
    setAiPrompt('');
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
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link to="/os/procurement/suppliers/new">
                <Plus className="h-5 w-5 mb-1" />
                <span className="text-xs">Add Supplier</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link to="/os/procurement/catalog">
                <Package className="h-5 w-5 mb-1" />
                <span className="text-xs">Add Product</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link to="/os/procurement/purchase-orders/new">
                <FileSpreadsheet className="h-5 w-5 mb-1" />
                <span className="text-xs">Create PO</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link to="/os/procurement/inventory-flow">
                <TrendingUp className="h-5 w-5 mb-1" />
                <span className="text-xs">Forecast</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col">
              <Brain className="h-5 w-5 mb-1" />
              <span className="text-xs">AI Negotiate</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col">
              <Send className="h-5 w-5 mb-1" />
              <span className="text-xs">AI Sourcing</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col">
              <FileSpreadsheet className="h-5 w-5 mb-1" />
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
    </div>
  );
}
