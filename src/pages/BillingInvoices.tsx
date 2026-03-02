import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Plus,
  Search,
  Store,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import { ReceiptStatusIndicator } from "@/components/invoice/ReceiptStatusIndicator";
import type { ReceiptStatus } from "@/components/invoice/ReceiptStatusIndicator";
import { usePaginatedInvoiceFeed, useInvoiceSystemCounts } from "@/hooks/usePaginatedInvoiceFeed";
import { UnifiedInvoice } from "@/hooks/useUnifiedInvoiceFeed";
import { format } from "date-fns";
import { ExportButton } from "@/components/crud/ExportButton";
import { DataTablePagination } from "@/components/crud/DataTablePagination";

const BillingInvoices = () => {
  const navigate = useNavigate();

  // Existing Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "store" | "crm" | "wholesale">("all");

  // New Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "updated_at">("created_at");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // HARD-LOCKED: Uses PAGINATED unified invoice feed
  // Added new params to the hook
  const { data, isLoading } = usePaginatedInvoiceFeed({
    status: statusFilter,
    source: sourceFilter,
    search: searchTerm,
    startDate, // New param
    endDate, // New param
    sortBy, // New param (created_at vs updated_at)
    page: currentPage,
    pageSize,
  });

  // Get TRUE system-wide counts for verification
  const { data: systemCounts } = useInvoiceSystemCounts();

  const invoices = data?.invoices || [];
  const stats = data?.stats;
  const pagination = data?.pagination;
  const verification = data?.verification;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      sent: "secondary",
      overdue: "destructive",
      partial: "outline",
      unpaid: "outline",
      draft: "outline",
      void: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getSourceIcon = (source: UnifiedInvoice["source"]) => {
    switch (source) {
      case "store":
        return <Store className="h-4 w-4 text-blue-500" />;
      case "crm":
        return <Users className="h-4 w-4 text-green-500" />;
      case "wholesale":
        return <Building2 className="h-4 w-4 text-purple-500" />;
      case "legacy":
        return <FileText className="h-4 w-4 text-amber-500" />;
      default:
        return <Building2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const exportData = invoices.map((inv) => ({
    invoice_number: inv.invoice_number,
    entity_name: inv.entity_name,
    source: inv.source,
    total: inv.total_amount,
    paid: inv.amount_paid,
    balance: inv.balance_due,
    status: inv.status,
    due_date: inv.due_date,
    created_at: inv.created_at,
  }));

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with TRUE counts */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            All Invoices
          </h1>
          <div className="flex items-center gap-4 text-muted-foreground mt-1">
            <span className="text-lg font-semibold text-foreground">
              {systemCounts?.totalSystemWide?.toLocaleString() || pagination?.totalCount?.toLocaleString() || 0}{" "}
              invoices total
            </span>
            <span>•</span>
            <span>{stats?.paidCount || 0} paid</span>
            <span>•</span>
            <span>{stats?.unpaidCount || 0} unpaid</span>
            <span>•</span>
            <span className="text-destructive">{stats?.overdueCount || 0} overdue</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ${stats?.totalOutstanding?.toLocaleString() || 0} outstanding • $
            {stats?.overdueAmount?.toLocaleString() || 0} overdue
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={exportData}
            filename="invoices"
            columns={[
              { key: "invoice_number", label: "Invoice #" },
              { key: "entity_name", label: "Customer" },
              { key: "source", label: "Source" },
              { key: "total", label: "Total" },
              { key: "paid", label: "Paid" },
              { key: "balance", label: "Balance" },
              { key: "status", label: "Status" },
              { key: "due_date", label: "Due Date" },
            ]}
          />
          <Button onClick={() => navigate("/billing/invoices/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Verification Status Bar */}
      {verification && statusFilter === "all" && !searchTerm && (
        <Card
          className={`p-3 border ${verification.discrepancy === 0 ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              {verification.discrepancy === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <span className="font-medium">
                {verification.discrepancy === 0 ? "Invoice count verified" : "Invoice discrepancy detected"}
              </span>
            </div>
            <div className="flex items-center gap-6 text-muted-foreground">
              <span>Store: {verification.storeInvoiceCount.toLocaleString()}</span>
              <span>CRM: {verification.crmInvoiceCount.toLocaleString()}</span>
              <span>Wholesale: {verification.wholesaleOrderCount.toLocaleString()}</span>
              <span className="text-foreground font-semibold">
                Total: {verification.totalExpected.toLocaleString()}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          {/* Row 1: Search, Status, Source */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number or customer name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset page on search
                }}
                className="pl-10"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                setSourceFilter(v as typeof sourceFilter);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="store">Store Invoices</SelectItem>
                <SelectItem value="crm">CRM Invoices</SelectItem>
                <SelectItem value="wholesale">Wholesale Orders</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Sort and Date Range */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Sort By:</span>
              <Select
                value={sortBy}
                onValueChange={(v: "created_at" | "updated_at") => {
                  setSortBy(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Most Recently Created</SelectItem>
                  <SelectItem value="updated_at">Most Recently Edited</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-6 w-px bg-border mx-2 hidden sm:block" />

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Date Range:</span>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-auto"
                />
                <span className="self-center text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Invoice List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length > 0 ? (
        <>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <Card
                key={invoice.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/billing/invoices/${invoice.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      {getSourceIcon(invoice.source)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{invoice.invoice_number}</h3>
                        {invoice.brand && (
                          <Badge variant="outline" className="text-xs">
                            {invoice.brand}
                          </Badge>
                        )}
                        {invoice.is_historical && (
                          <Badge variant="secondary" className="text-xs">
                            Historical
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.entity_name}
                        <span className="mx-2">•</span>
                        <span className="capitalize">{invoice.source}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {invoice.receipt_status && (
                      <ReceiptStatusIndicator
                        status={invoice.receipt_status as ReceiptStatus}
                        sentAt={invoice.receipt_sent_at || undefined}
                        showLabel
                      />
                    )}
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="text-xl font-bold">${invoice.total_amount.toLocaleString()}</p>
                      {invoice.balance_due > 0 && invoice.balance_due < invoice.total_amount && (
                        <p className="text-xs text-orange-500">Balance: ${invoice.balance_due.toLocaleString()}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium">
                        {invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : "N/A"}
                      </p>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <Card>
              <DataTablePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[25, 50, 100, 200]}
              />
            </Card>
          )}
        </>
      ) : (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No invoices found matching current filters</p>
          <Button onClick={() => navigate("/billing/invoices/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Invoice
          </Button>
        </Card>
      )}
    </div>
  );
};

export default BillingInvoices;
