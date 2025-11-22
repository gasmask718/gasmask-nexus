import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Download, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function HRPayroll() {
  const navigate = useNavigate();
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      const { data, error } = await supabase
        .from("hr_payroll")
        .select(`
          *,
          employee:hr_employees(id, full_name, job_title)
        `)
        .order("next_pay_date", { ascending: true });

      if (error) throw error;
      setPayrollData(data || []);
    } catch (error) {
      console.error("Error fetching payroll:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunPayroll = () => {
    toast.success("Payroll processing started");
    // Would trigger edge function in production
  };

  const handleExportCSV = () => {
    toast.success("Exporting payroll data...");
    // Would export to CSV in production
  };

  const getPayTypeColor = (payType: string) => {
    switch (payType) {
      case "salary":
        return "bg-blue-500";
      case "hourly":
        return "bg-green-500";
      case "commission":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Payroll Management</h1>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleRunPayroll}>
            <DollarSign className="mr-2 h-4 w-4" />
            Run Payroll
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Payroll Records ({payrollData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Pay Type</TableHead>
                <TableHead>Pay Rate</TableHead>
                <TableHead>Last Pay Date</TableHead>
                <TableHead>Next Pay Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.map((payroll) => (
                <TableRow key={payroll.id}>
                  <TableCell className="font-medium">
                    {payroll.employee?.full_name || "N/A"}
                  </TableCell>
                  <TableCell>{payroll.employee?.job_title || "N/A"}</TableCell>
                  <TableCell>
                    <Badge className={getPayTypeColor(payroll.pay_type)}>
                      {payroll.pay_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    ${payroll.pay_rate || 0}
                    {payroll.pay_type === "hourly" ? "/hr" : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {payroll.last_pay_date
                        ? new Date(payroll.last_pay_date).toLocaleDateString()
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {payroll.next_pay_date
                        ? new Date(payroll.next_pay_date).toLocaleDateString()
                        : "—"}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
