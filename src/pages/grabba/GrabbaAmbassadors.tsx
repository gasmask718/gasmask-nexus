import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Award, Users, DollarSign, TrendingUp, Plus, Star, MapPin, 
  Store, Package, Search, Building2, Wallet, CheckCircle2, Clock
} from "lucide-react";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { useState } from "react";

export default function GrabbaAmbassadors() {
  const { selectedBrand, setSelectedBrand } = useGrabbaBrand();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch ambassadors
  const { data: ambassadors, isLoading } = useQuery({
    queryKey: ["grabba-ambassadors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassadors")
        .select(`
          *,
          user:profiles(name, email)
        `)
        .order("total_earnings", { ascending: false });
      return data || [];
    },
  });

  // Fetch ambassador assignments (stores & wholesalers)
  const { data: assignments } = useQuery({
    queryKey: ["grabba-ambassador-assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassador_assignments")
        .select(`
          *,
          ambassador:ambassadors(id, user_id, user:profiles(name)),
          company:companies(id, name, type)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch commissions (finders fees)
  const { data: commissions } = useQuery({
    queryKey: ["grabba-ambassador-commissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassador_commissions")
        .select(`
          *,
          ambassador:ambassadors(id, user_id, user:profiles(name))
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch regions
  const { data: regions } = useQuery({
    queryKey: ["grabba-ambassador-regions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassador_regions")
        .select(`
          *,
          ambassador:profiles(id, name, email),
          region:regions(id, name)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // KPI calculations
  const totalAmbassadors = ambassadors?.length || 0;
  const activeAmbassadors = ambassadors?.filter(a => a.is_active)?.length || 0;
  const totalEarnings = ambassadors?.reduce((sum, a) => sum + (a.total_earnings || 0), 0) || 0;
  const pendingCommissions = commissions?.filter(c => c.status === 'pending')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  const paidCommissions = commissions?.filter(c => c.status === 'paid')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  
  // Assigned stores & wholesalers
  const storeAssignments = assignments?.filter(a => a.role_type === 'store_finder' || a.company?.type === 'store') || [];
  const wholesalerAssignments = assignments?.filter(a => a.role_type === 'wholesaler_finder' || a.company?.type === 'wholesaler') || [];
  
  // Finders fees breakdown
  const findersFees = commissions?.filter(c => c.entity_type === 'store' || c.entity_type === 'wholesaler') || [];
  const storeFindersFees = findersFees.filter(c => c.entity_type === 'store');
  const wholesalerFindersFees = findersFees.filter(c => c.entity_type === 'wholesaler');

  // Active regions
  const activeRegions = regions?.filter(r => r.active)?.length || 0;

  // Filter ambassadors by search
  const filteredAmbassadors = ambassadors?.filter(amb => 
    !searchTerm || 
    amb.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    amb.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    amb.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Brand Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              Floor 8 — Ambassadors & Reps
            </h1>
            <p className="text-muted-foreground mt-1">
              Partner reps, regions, payouts, assigned stores, wholesalers & finders fees
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Users className="h-5 w-5" />
                <span className="text-sm">Ambassadors</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{totalAmbassadors}</div>
              <div className="text-xs text-muted-foreground">{activeAmbassadors} active</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">Total Paid</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                ${paidCommissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Clock className="h-5 w-5" />
                <span className="text-sm">Pending</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                ${pendingCommissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <MapPin className="h-5 w-5" />
                <span className="text-sm">Regions</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{activeRegions}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <Store className="h-5 w-5" />
                <span className="text-sm">Stores Linked</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{storeAssignments.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-rose-500/10 to-rose-900/5 border-rose-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-rose-400">
                <Package className="h-5 w-5" />
                <span className="text-sm">Wholesalers</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{wholesalerAssignments.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ambassadors" className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="ambassadors">Ambassadors</TabsTrigger>
            <TabsTrigger value="regions">Regions</TabsTrigger>
            <TabsTrigger value="stores">Assigned Stores</TabsTrigger>
            <TabsTrigger value="wholesalers">Wholesalers</TabsTrigger>
            <TabsTrigger value="finders-fees">Finders Fees</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          {/* Ambassadors Tab */}
          <TabsContent value="ambassadors">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>All Ambassadors</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search ambassadors..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Ambassador
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading ambassadors...</p>
                ) : filteredAmbassadors?.length === 0 ? (
                  <p className="text-muted-foreground">No ambassadors found</p>
                ) : (
                  <div className="space-y-3">
                    {filteredAmbassadors?.map((amb, i) => {
                      const ambStores = assignments?.filter(a => a.ambassador?.id === amb.id && (a.role_type === 'store_finder' || a.company?.type === 'store'))?.length || 0;
                      const ambWholesalers = assignments?.filter(a => a.ambassador?.id === amb.id && (a.role_type === 'wholesaler_finder' || a.company?.type === 'wholesaler'))?.length || 0;
                      
                      return (
                        <div key={amb.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-bold text-muted-foreground">#{i + 1}</div>
                            <div className="p-3 rounded-full bg-primary/10">
                              <Award className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{amb.user?.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">{amb.user?.email}</div>
                              <div className="flex gap-2 mt-1">
                                <Badge variant={amb.is_active ? 'default' : 'secondary'}>
                                  {amb.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                                <Badge variant="outline">{amb.tier}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <div className="text-lg font-bold text-cyan-400">{ambStores}</div>
                              <div className="text-xs text-muted-foreground">Stores</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-rose-400">{ambWholesalers}</div>
                              <div className="text-xs text-muted-foreground">Wholesalers</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-green-400">
                                ${amb.total_earnings?.toLocaleString() || 0}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Code: {amb.tracking_code}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regions Tab */}
          <TabsContent value="regions">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-400" />
                  Ambassador Regions
                </CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Assign Region
                </Button>
              </CardHeader>
              <CardContent>
                {regions?.length === 0 ? (
                  <p className="text-muted-foreground">No regions assigned yet</p>
                ) : (
                  <div className="space-y-3">
                    {regions?.map(reg => (
                      <div key={reg.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-full bg-purple-500/10">
                            <MapPin className="h-5 w-5 text-purple-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {reg.region?.name || 'Unknown Region'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Region ID: {reg.region_id?.slice(0, 8)}...
                            </div>
                            <div className="flex gap-2 mt-1">
                              <Badge variant={reg.active ? 'default' : 'secondary'}>
                                {reg.active ? 'Active' : 'Inactive'}
                              </Badge>
                              {reg.role && <Badge variant="outline" className="capitalize">{reg.role}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-foreground">
                            Rep: {reg.ambassador?.name || 'Unassigned'}
                          </div>
                          <div className="text-sm text-green-400">
                            {reg.commission_rate}% Commission
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(reg.created_at), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assigned Stores Tab */}
          <TabsContent value="stores">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-cyan-400" />
                  Reps → Assigned Stores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {storeAssignments.length === 0 ? (
                  <p className="text-muted-foreground">No store assignments found</p>
                ) : (
                  <div className="space-y-3">
                    {storeAssignments.map(assgn => (
                      <div key={assgn.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-full bg-cyan-500/10">
                            <Store className="h-5 w-5 text-cyan-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{assgn.company?.name || 'Unknown Store'}</div>
                            <div className="text-sm text-muted-foreground">
                              Rep: {assgn.ambassador?.user?.name || 'Unassigned'}
                            </div>
                            <Badge variant="outline" className="mt-1 capitalize">{assgn.role_type?.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-400">
                            {assgn.commission_rate}%
                          </div>
                          <div className="text-xs text-muted-foreground">Commission Rate</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(assgn.created_at), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wholesalers Tab */}
          <TabsContent value="wholesalers">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-rose-400" />
                  Reps → Wholesalers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wholesalerAssignments.length === 0 ? (
                  <p className="text-muted-foreground">No wholesaler assignments found</p>
                ) : (
                  <div className="space-y-3">
                    {wholesalerAssignments.map(assgn => (
                      <div key={assgn.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-full bg-rose-500/10">
                            <Package className="h-5 w-5 text-rose-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{assgn.company?.name || 'Unknown Wholesaler'}</div>
                            <div className="text-sm text-muted-foreground">
                              Rep: {assgn.ambassador?.user?.name || 'Unassigned'}
                            </div>
                            <Badge variant="outline" className="mt-1 capitalize">{assgn.role_type?.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-400">
                            {assgn.commission_rate}%
                          </div>
                          <div className="text-xs text-muted-foreground">Commission Rate</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(assgn.created_at), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finders Fees Tab */}
          <TabsContent value="finders-fees">
            <div className="space-y-4">
              {/* Finders Fees Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-400">
                      <DollarSign className="h-5 w-5" />
                      <span className="text-sm">Total Finders Fees</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      ${findersFees.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border-cyan-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Store className="h-5 w-5" />
                      <span className="text-sm">Store Finders Fees</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      ${storeFindersFees.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{storeFindersFees.length} transactions</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-rose-500/10 to-rose-900/5 border-rose-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-rose-400">
                      <Package className="h-5 w-5" />
                      <span className="text-sm">Wholesaler Finders Fees</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      ${wholesalerFindersFees.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{wholesalerFindersFees.length} transactions</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-amber-400" />
                    Finders Fee Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {findersFees.length === 0 ? (
                    <p className="text-muted-foreground">No finders fees recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {findersFees.map(comm => (
                        <div key={comm.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${comm.entity_type === 'store' ? 'bg-cyan-500/10' : 'bg-rose-500/10'}`}>
                              {comm.entity_type === 'store' ? (
                                <Store className="h-5 w-5 text-cyan-400" />
                              ) : (
                                <Package className="h-5 w-5 text-rose-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-foreground capitalize">{comm.entity_type} Finder Fee</div>
                              <div className="text-sm text-muted-foreground">
                                Rep: {comm.ambassador?.user?.name || 'Unknown'}
                              </div>
                              {comm.notes && (
                                <div className="text-xs text-muted-foreground mt-1">{comm.notes}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-green-400">${comm.amount?.toLocaleString()}</div>
                            <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                              {comm.status === 'paid' ? (
                                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Paid</span>
                              ) : (
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>
                              )}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(comm.created_at), "MMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <div className="space-y-4">
              {/* Payouts Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm">Total Paid Out</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      ${paidCommissions.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Clock className="h-5 w-5" />
                      <span className="text-sm">Pending Payouts</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      ${pendingCommissions.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-blue-400">
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-sm">Avg Payout</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      ${commissions && commissions.length > 0 
                        ? Math.round(commissions.reduce((sum, c) => sum + (c.amount || 0), 0) / commissions.length).toLocaleString() 
                        : 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Award className="h-5 w-5" />
                      <span className="text-sm">Total Transactions</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      {commissions?.length || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-green-400" />
                    All Commission Payouts
                  </CardTitle>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Record Payout
                  </Button>
                </CardHeader>
                <CardContent>
                  {commissions?.length === 0 ? (
                    <p className="text-muted-foreground">No payouts recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {commissions?.map(comm => (
                        <div key={comm.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${comm.status === 'paid' ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                              {comm.status === 'paid' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                              ) : (
                                <Clock className="h-5 w-5 text-amber-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">
                                {comm.ambassador?.user?.name || 'Unknown Rep'}
                              </div>
                              <div className="text-sm text-muted-foreground capitalize">{comm.entity_type}</div>
                              {comm.notes && (
                                <div className="text-xs text-muted-foreground">{comm.notes}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-green-400">${comm.amount?.toLocaleString()}</div>
                            <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                              {comm.status}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(comm.created_at), "MMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
