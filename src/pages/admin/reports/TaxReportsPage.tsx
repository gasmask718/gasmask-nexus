import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import { use1099Summary, exportToCSV } from '@/hooks/useReporting';

export default function TaxReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  const { data: summary, isLoading } = use1099Summary(selectedYear);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Stats
  const totalAmbassadors = summary?.length || 0;
  const totalPaid = summary?.reduce((sum, a) => sum + Number(a.total_paid || 0), 0) || 0;
  const over600 = summary?.filter(a => Number(a.total_paid) >= 600) || [];
  const under600 = summary?.filter(a => Number(a.total_paid) < 600) || [];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExport = () => {
    if (summary?.length) {
      exportToCSV(
        summary.map(s => ({
          ambassador_id: s.ambassador_id,
          ambassador_name: s.ambassador_name,
          tax_year: s.tax_year,
          total_paid: s.total_paid,
          payment_count: s.payment_count,
          requires_1099: Number(s.total_paid) >= 600 ? 'YES' : 'NO',
        })),
        `1099_report_${selectedYear}`
      );
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax Reports</h1>
          <p className="text-muted-foreground">1099-MISC preparation and compliance</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} variant="outline" disabled={!summary?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export 1099 CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalPaid)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ambassadors Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{totalAmbassadors}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Requires 1099</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{over600.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">≥ $600 threshold</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Below Threshold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{under600.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">&lt; $600</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700">1099-MISC Requirement</h4>
              <p className="text-sm text-muted-foreground mt-1">
                You must issue a 1099-MISC to any contractor paid $600 or more during the tax year.
                This report shows all ambassadors with their annual totals. Export to CSV for your accountant or tax software.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1099 Table */}
      <Card>
        <CardHeader>
          <CardTitle>1099 Summary - {selectedYear}</CardTitle>
          <CardDescription>Annual payment totals by ambassador</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambassador</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-center">1099 Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.map((amb) => {
                  const requires1099 = Number(amb.total_paid) >= 600;
                  
                  return (
                    <TableRow key={amb.ambassador_id}>
                      <TableCell>
                        <div className="font-medium">{amb.ambassador_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{amb.ambassador_id}</div>
                      </TableCell>
                      <TableCell className="text-right">{amb.payment_count}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(amb.total_paid || 0))}
                      </TableCell>
                      <TableCell className="text-center">
                        {requires1099 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            YES
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!summary || summary.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No payments found for {selectedYear}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
