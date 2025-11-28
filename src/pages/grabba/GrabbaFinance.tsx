import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, AlertTriangle, Clock, CheckCircle, Users } from "lucide-react";
import { GRABBA_BRANDS, getBrandConfig } from "@/config/grabbaBrands";

export default function GrabbaFinance() {
  const [brandFilter, setBrandFilter] = useState<string>("all");

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ["grabba-finance-invoices", brandFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`*, company:companies(name)`)
        .order("created_at", { ascending: false });

      if (brandFilter !== "all") {
        query = query.eq("brand", brandFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Fetch orders for revenue
  const { data: orders } = useQuery({
    queryKey: ["grabba-finance-orders", brandFilter],
    queryFn: async () => {
      let query = supabase
        .from("wholesale_orders")
        .select("*")
        .in("brand", GRABBA_BRANDS);

      if (brandFilter !== "all") {
        query = query.eq("brand", brandFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Fetch ambassador commissions
  const { data: commissions } = useQuery({
    queryKey: ["grabba-finance-commissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassador_commissions")
        .select(`*, ambassador:ambassadors(user_id)`)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Calculate metrics
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const paidRevenue = invoices?.filter(i => i.payment_status === 'paid')?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const unpaidTotal = invoices?.filter(i => i.payment_status === 'unpaid')?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

  // Aging buckets
  const now = new Date();
  const aging = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };
  
  invoices?.filter(i => i.payment_status === 'unpaid')?.forEach(inv => {
    if (!inv.due_date) return;
    const daysPastDue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysPastDue <= 30) aging['0-30'] += inv.total_amount || 0;
    else if (daysPastDue <= 60) aging['31-60'] += inv.total_amount || 0;
    else if (daysPastDue <= 90) aging['61-90'] += inv.total_amount || 0;
    else aging['90+'] += inv.total_amount || 0;
  });

  // Revenue by brand
  const revenueByBrand: Record<string, number> = {};
  GRABBA_BRANDS.forEach(brand => {
    revenueByBrand[brand] = invoices?.filter(i => i.brand === brand)?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  });

  const pendingCommissions = commissions?.filter(c => c.status === 'pending')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  const paidCommissions = commissions?.filter(c => c.status === 'paid')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              Grabba Accounting & Finance
            </h1>
            <p className="text-muted-foreground mt-1">
              Profit, costs, commissions, unpaid, and risk scores for all Grabba product companies
            </p>
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {GRABBA_BRANDS.map(brand => (
                <SelectItem key={brand} value={brand}>
                  {getBrandConfig(brand).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm">Total Revenue</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${totalRevenue.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">${paidRevenue.toLocaleString()} collected</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-900/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">Total Unpaid</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${unpaidTotal.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Users className="h-5 w-5" />
                <span className="text-sm">Pending Commissions</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${pendingCommissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm">Paid Commissions</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${paidCommissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="revenue">Revenue & Receivables</TabsTrigger>
            <TabsTrigger value="aging">Aging Report</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle>Revenue by Brand</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {GRABBA_BRANDS.map(brand => {
                      const config = getBrandConfig(brand);
                      const revenue = revenueByBrand[brand];
                      const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
                      return (
                        <div key={brand} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge className={config.pill}>{config.label}</Badge>
                            </div>
                            <span className="font-medium text-foreground">${revenue.toLocaleString()}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div 
                              className={`h-full ${config.primary}`} 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle>Unpaid by Brand</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {GRABBA_BRANDS.map(brand => {
                      const config = getBrandConfig(brand);
                      const unpaid = invoices?.filter(i => i.brand === brand && i.payment_status === 'unpaid')
                        ?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
                      return (
                        <div key={brand} className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                          <Badge className={config.pill}>{config.label}</Badge>
                          <span className="font-medium text-red-400">${unpaid.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="aging">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Aging Buckets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="text-sm text-green-400">0-30 Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['0-30'].toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="text-sm text-amber-400">31-60 Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['31-60'].toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="text-sm text-orange-400">61-90 Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['61-90'].toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="text-sm text-red-400">90+ Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['90+'].toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <h4 className="font-medium text-foreground">Unpaid Invoices</h4>
                  {invoices?.filter(i => i.payment_status === 'unpaid')?.slice(0, 10)?.map(inv => (
                    <div key={inv.id} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">{inv.company?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">
                          {inv.brand && <Badge className={getBrandConfig(inv.brand).pill} variant="outline">{getBrandConfig(inv.brand).label}</Badge>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-400">${inv.total_amount?.toLocaleString()}</div>
                        {inv.due_date && (
                          <div className="text-xs text-muted-foreground">
                            Due: {new Date(inv.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Ambassador Commissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {commissions?.length === 0 ? (
                    <p className="text-muted-foreground">No commissions found</p>
                  ) : (
                    commissions?.map(comm => (
                      <div key={comm.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground capitalize">{comm.entity_type}</div>
                          <div className="text-sm text-muted-foreground">{comm.notes || 'No notes'}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xl font-bold text-green-400">${comm.amount?.toLocaleString()}</div>
                          <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                            {comm.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
