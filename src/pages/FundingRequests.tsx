import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Send, Clock, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function FundingRequests() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    approved: 0,
    funded: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("lender_applications")
        .select(`
          *,
          lenders(lender_name),
          loan_products(product_name),
          leads_raw(address, city, state)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setApplications(data || []);

      const submitted = data?.filter(a => a.status === 'submitted' || a.status === 'reviewing').length || 0;
      const approved = data?.filter(a => a.status === 'approved' || a.status === 'conditionally_approved').length || 0;
      const funded = data?.filter(a => a.status === 'funded').length || 0;
      const totalAmount = data?.reduce((sum, a) => sum + (a.loan_amount || 0), 0) || 0;

      setStats({
        total: data?.length || 0,
        submitted,
        approved,
        funded,
        totalAmount,
      });
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("lender_applications")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Application ${newStatus}`);
      fetchApplications();
    } catch (error) {
      console.error("Error updating application:", error);
      toast.error("Failed to update application");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return Clock;
      case 'submitted': case 'reviewing': return Send;
      case 'approved': case 'conditionally_approved': return CheckCircle;
      case 'funded': return DollarSign;
      case 'denied': case 'withdrawn': return XCircle;
      default: return FileText;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'funded': return 'default';
      case 'submitted': case 'reviewing': return 'secondary';
      case 'denied': case 'withdrawn': return 'destructive';
      case 'conditionally_approved': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Funding Requests</h1>
        <p className="text-muted-foreground">
          Track loan applications and funding status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.submitted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Funded</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.funded}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(stats.totalAmount / 1000000).toFixed(1)}M</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Funding Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading applications...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>LTV</TableHead>
                  <TableHead>DSCR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => {
                  const StatusIcon = getStatusIcon(app.status);
                  return (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {app.leads_raw?.address || "Unknown"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {app.leads_raw?.city}, {app.leads_raw?.state}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{app.lenders?.lender_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {app.borrower_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{app.loan_products?.product_name || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold">${(app.loan_amount / 1000).toFixed(0)}K</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{app.loan_purpose.replace("_", " ")}</span>
                      </TableCell>
                      <TableCell>
                        {app.ltv ? `${app.ltv.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        {app.dscr ? (
                          <span className={app.dscr >= 1.0 ? "text-green-600 font-bold" : "text-red-600"}>
                            {app.dscr.toFixed(2)}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(app.status) as any} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {app.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {app.submitted_at
                          ? new Date(app.submitted_at).toLocaleDateString()
                          : "Draft"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {app.status === 'draft' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusUpdate(app.id, 'submitted')}
                            >
                              Submit
                            </Button>
                          )}
                          {app.status === 'submitted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(app.id, 'reviewing')}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
