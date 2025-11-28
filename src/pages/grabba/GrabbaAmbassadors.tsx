import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Users, DollarSign, TrendingUp, Plus, Star } from "lucide-react";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar, BrandBadge } from "@/components/grabba/BrandFilterBar";
import { GRABBA_BRANDS, GrabbaBrand } from "@/config/grabbaBrands";

export default function GrabbaAmbassadors() {
  const { selectedBrand, setSelectedBrand } = useGrabbaBrand();

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

  // Fetch ambassador assignments
  const { data: assignments } = useQuery({
    queryKey: ["grabba-ambassador-assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassador_assignments")
        .select(`
          *,
          ambassador:ambassadors(id, user_id),
          company:companies(id, name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch commissions
  const { data: commissions } = useQuery({
    queryKey: ["grabba-ambassador-commissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassador_commissions")
        .select(`
          *,
          ambassador:ambassadors(id, user_id)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const totalAmbassadors = ambassadors?.length || 0;
  const activeAmbassadors = ambassadors?.filter(a => a.is_active)?.length || 0;
  const totalEarnings = ambassadors?.reduce((sum, a) => sum + (a.total_earnings || 0), 0) || 0;
  const pendingCommissions = commissions?.filter(c => c.status === 'pending')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Brand Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              Grabba Ambassadors & Reps
            </h1>
            <p className="text-muted-foreground mt-1">
              Partner reps who find and maintain stores and wholesalers – with tracked commissions
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Users className="h-5 w-5" />
                <span className="text-sm">Total Ambassadors</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{totalAmbassadors}</div>
              <div className="text-sm text-muted-foreground">{activeAmbassadors} active</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">Total Earnings</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${totalEarnings.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm">Pending Commissions</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${pendingCommissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Award className="h-5 w-5" />
                <span className="text-sm">Assignments</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{assignments?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ambassadors" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="ambassadors">Ambassadors</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
          </TabsList>

          <TabsContent value="ambassadors">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Ambassadors</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Add Ambassador
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading ambassadors...</p>
                ) : ambassadors?.length === 0 ? (
                  <p className="text-muted-foreground">No ambassadors found</p>
                ) : (
                  <div className="space-y-3">
                    {ambassadors?.map((amb, i) => (
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
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-400">
                            ${amb.total_earnings?.toLocaleString() || 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Earnings</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Code: {amb.tracking_code}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Store & Wholesaler Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                {assignments?.length === 0 ? (
                  <p className="text-muted-foreground">No assignments found</p>
                ) : (
                  <div className="space-y-3">
                    {assignments?.map(assgn => (
                      <div key={assgn.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">{assgn.company?.name || 'Unknown'}</div>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="capitalize">{assgn.role_type?.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-foreground">
                            Commission: {assgn.commission_rate}%
                          </div>
                          <div className="text-xs text-muted-foreground">
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

          <TabsContent value="commissions">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
              </CardHeader>
              <CardContent>
                {commissions?.length === 0 ? (
                  <p className="text-muted-foreground">No commissions found</p>
                ) : (
                  <div className="space-y-3">
                    {commissions?.map(comm => (
                      <div key={comm.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground capitalize">{comm.entity_type}</div>
                          <div className="text-sm text-muted-foreground">{comm.notes || 'No notes'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-400">${comm.amount?.toLocaleString()}</div>
                          <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                            {comm.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
