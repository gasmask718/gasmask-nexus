import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Building2, TrendingUp, Users, FileText, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RealEstate() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeDeals: 0,
    closedThisMonth: 0,
    monthlyRevenue: 0,
    avgAssignmentFee: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [leadsRes, dealsRes, closingsRes] = await Promise.all([
        supabase.from("leads_raw").select("id", { count: "exact", head: true }),
        supabase.from("acquisitions_pipeline").select("id, status", { count: "exact" }).in("status", ["negotiating", "offer_sent", "signed"]),
        supabase.from("deal_closings").select("assignment_fee, closing_date").gte("closing_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      const totalLeads = leadsRes.count || 0;
      const activeDeals = dealsRes.count || 0;
      const closings = closingsRes.data || [];
      const closedThisMonth = closings.length;
      const monthlyRevenue = closings.reduce((sum, c) => sum + (c.assignment_fee || 0), 0);
      const avgAssignmentFee = closedThisMonth > 0 ? monthlyRevenue / closedThisMonth : 0;

      setStats({
        totalLeads,
        activeDeals,
        closedThisMonth,
        monthlyRevenue,
        avgAssignmentFee,
        conversionRate: totalLeads > 0 ? (closedThisMonth / totalLeads) * 100 : 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Real Estate HQ</h1>
        <p className="text-muted-foreground">AI-Powered Acquisition & Wholesale Command Center</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalLeads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Active in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeDeals}</div>
            <p className="text-xs text-muted-foreground mt-1">In negotiation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Closed This Month</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.closedThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">Assignments completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(stats.monthlyRevenue / 1000).toFixed(0)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Assignment fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Assignment Fee</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(stats.avgAssignmentFee / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Per deal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Lead to close</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Performance Targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Monthly Goal: $10M Revenue</span>
            <Badge variant={stats.monthlyRevenue >= 10000000 ? "default" : "secondary"}>
              {((stats.monthlyRevenue / 10000000) * 100).toFixed(1)}% Complete
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Target: 1,000 Deals/Month</span>
            <Badge variant={stats.closedThisMonth >= 1000 ? "default" : "secondary"}>
              {stats.closedThisMonth} / 1,000
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Avg Fee Target: $10K</span>
            <Badge variant={stats.avgAssignmentFee >= 10000 ? "default" : "secondary"}>
              ${(stats.avgAssignmentFee / 1000).toFixed(1)}K
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}