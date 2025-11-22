import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, Building2, TrendingUp } from "lucide-react";

export default function RealEstateClosings() {
  const [closings, setClosings] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalClosings: 0,
    totalRevenue: 0,
    avgFee: 0,
    thisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClosings();
  }, []);

  const fetchClosings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("deal_closings")
        .select(`
          *,
          acquisitions_pipeline(
            leads_raw(address, city, state)
          )
        `)
        .order("closing_date", { ascending: false });

      if (error) throw error;

      const closingData = data || [];
      setClosings(closingData);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthClosings = closingData.filter(
        (c) => new Date(c.closing_date) >= thisMonthStart
      );

      const totalRevenue = closingData.reduce((sum, c) => sum + (c.assignment_fee || 0), 0);
      const avgFee = closingData.length > 0 ? totalRevenue / closingData.length : 0;

      setStats({
        totalClosings: closingData.length,
        totalRevenue,
        avgFee,
        thisMonth: thisMonthClosings.length,
      });
    } catch (error) {
      console.error("Error fetching closings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Deal Closings & Payments</h1>
        <p className="text-muted-foreground">Track closed deals and revenue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Closings</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalClosings}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(stats.totalRevenue / 1000000).toFixed(2)}M</div>
            <p className="text-xs text-muted-foreground mt-1">Assignment fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Fee</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(stats.avgFee / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Per deal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">Closed deals</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Closings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading closings...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Closing Date</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Assignment Fee</TableHead>
                  <TableHead>Net Profit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closings.map((closing) => (
                  <TableRow key={closing.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {closing.acquisitions_pipeline?.leads_raw?.address || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {closing.acquisitions_pipeline?.leads_raw?.city},{" "}
                          {closing.acquisitions_pipeline?.leads_raw?.state}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{closing.buyer_name}</div>
                        {closing.buyer_entity && (
                          <div className="text-sm text-muted-foreground">{closing.buyer_entity}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(closing.closing_date).toLocaleDateString()}</TableCell>
                    <TableCell>${closing.purchase_price?.toLocaleString() || 0}</TableCell>
                    <TableCell className="font-bold text-green-600">
                      ${closing.assignment_fee?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="font-bold">
                      ${closing.net_profit?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={closing.wire_received ? "default" : "secondary"}>
                        {closing.wire_received ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}