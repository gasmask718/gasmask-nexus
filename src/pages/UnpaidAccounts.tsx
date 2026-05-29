/**
 * =====================================================
 * UNPAID ACCOUNTS & COLLECTIONS COMMAND CENTER
 * =====================================================
 * 
 * Floor 5 - Finance & Orders
 * 
 * HARD-LOCK RULE:
 * This page shows 100% of unpaid financial exposure across ALL sources.
 * It uses ENTITY-FIRST grouping (accounts, not invoices).
 * 
 * Sources:
 * - Store Invoices (invoices)
 * - CRM Customer Invoices (customer_invoices)
 * - Wholesale Orders (marketplace_orders)
 * - Legacy / Historical invoices
 * 
 * If an invoice exists and is not fully paid → it MUST appear here.
 * =====================================================
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Phone, 
  MessageSquare, 
  DollarSign, 
  AlertTriangle, 
  Star, 
  Building2, 
  Search, 
  TrendingDown, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Users,
  FileText,
  AlertCircle,
  ShieldAlert,
  Store,
  User,
  Package,
  RefreshCw,
  MoreHorizontal,
  Send,
  Pencil,
  Flag,
  FileDown,
  Banknote,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useMessage } from "@/components/communication/MessageProvider";
import { 
  useUnpaidAccounts, 
  UnpaidAccount, 
  EntityType, 
  InvoiceSource, 
  RiskLevel 
} from "@/hooks/useUnpaidAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { DeleteCollectionAccountModal } from "@/components/collections/DeleteCollectionAccountModal";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BRANDS = [
  { value: 'all', label: 'All Brands' },
  { value: 'gasmask', label: 'GasMask' },
  { value: 'GasMask', label: 'GasMask' },
  { value: 'hotmama', label: 'HotMama' },
  { value: 'hotscolati', label: 'Hotscolatti' },
  { value: 'grabba_r_us', label: 'Grabba R Us' },
];

const ENTITY_TYPES: { value: string; label: string; icon: typeof Building2 }[] = [
  { value: 'all', label: 'All Types', icon: Building2 },
  { value: 'store', label: 'Store', icon: Store },
  { value: 'company', label: 'Company', icon: Building2 },
  { value: 'customer', label: 'Customer', icon: User },
  { value: 'wholesaler', label: 'Wholesaler', icon: Package },
];

const SOURCES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'store', label: 'Store' },
  { value: 'crm', label: 'CRM' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'legacy', label: 'Legacy' },
];

const OVERDUE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '7', label: '7+ Days' },
  { value: '14', label: '14+ Days' },
  { value: '30', label: '30+ Days' },
  { value: '60', label: '60+ Days' },
];

const BALANCE_THRESHOLDS = [
  { value: 'all', label: 'Any Balance' },
  { value: '50', label: '$50+' },
  { value: '100', label: '$100+' },
  { value: '500', label: '$500+' },
  { value: '1000', label: '$1,000+' },
];

const RISK_LEVELS: { value: RiskLevel | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All Risk Levels', color: 'bg-muted' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-green-500' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const colors: Record<RiskLevel, string> = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-green-500 text-white',
  };

  return (
    <Badge className={`${colors[level]} text-xs uppercase`}>
      {level}
    </Badge>
  );
}

function EntityIcon({ type }: { type: EntityType }) {
  const icons: Record<EntityType, typeof Building2> = {
    store: Store,
    company: Building2,
    customer: User,
    wholesaler: Package,
  };
  const Icon = icons[type] || Building2;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

function SourceBadge({ source }: { source: InvoiceSource }) {
  const colors: Record<InvoiceSource, string> = {
    store: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    crm: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    wholesale: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    legacy: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <Badge variant="outline" className={`${colors[source]} text-[10px] uppercase`}>
      {source}
    </Badge>
  );
}

function PaymentReliabilityBadge({ score, tier }: { score?: number; tier?: string }) {
  if (!score && !tier) return null;
  
  const stars = tier === 'elite' ? 5 : tier === 'solid' ? 4 : tier === 'middle' ? 3 : tier === 'concerning' ? 2 : 1;
  const color = stars >= 4 ? "text-yellow-500" : stars === 3 ? "text-gray-400" : "text-red-500";
  
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < stars ? color + " fill-current" : "text-muted"}`} />
      ))}
      {score && <span className="text-xs text-muted-foreground ml-1">({score})</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function UnpaidAccounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { initiateMessage } = useMessage();
  const { user } = useAuth();
  const { roles } = useUserRole(user?.id);
  const isOwner = roles.includes('owner');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  
  // Fetch data from unified hook
  const { data, isLoading, refetch } = useUnpaidAccounts();
  
  // UI State
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [overdueFilter, setOverdueFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>("all");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Toggle account expansion
  const toggleAccount = (id: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // COLLECTION ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSendReminder = (account: UnpaidAccount) => {
    if (!account.phone) {
      toast.error("No phone number available for this account");
      return;
    }
    
    initiateMessage({
      destinationPhone: account.phone,
      entityType: account.entity_type as "store" | "customer" | "wholesaler",
      entityId: account.entity_id,
      entityName: account.entity_name,
      channel: "sms",
      source: "collections",
      contextData: {
        invoiceIds: account.invoices.map(inv => inv.id),
        totalAmount: account.total_outstanding,
        daysOverdue: account.max_days_overdue,
        isVip: account.payment_reliability_tier === 'elite' || account.payment_reliability_tier === 'solid',
      }
    });
  };

  const handleLogPayment = (account: UnpaidAccount) => {
    toast.info(`Log payment for ${account.entity_name}`, {
      description: "Payment logging modal coming soon"
    });
  };

  const handleMarkDispute = (account: UnpaidAccount) => {
    toast.info(`Flag dispute for ${account.entity_name}`, {
      description: "Dispute flagging coming soon"
    });
  };

  const handleGenerateStatement = (account: UnpaidAccount) => {
    toast.info(`Generate statement for ${account.entity_name}`, {
      description: `${account.invoices.length} invoices totaling $${account.total_outstanding.toLocaleString()}`
    });
  };

  const handleEscalate = (account: UnpaidAccount) => {
    toast.warning(`Escalating ${account.entity_name} to high-risk`, {
      description: "This will trigger enhanced collections workflow"
    });
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    if (!data?.accounts) return [];
    
    return data.accounts.filter(account => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (!account.entity_name.toLowerCase().includes(searchLower)) return false;
      }

      // Brand filter
      if (brandFilter !== 'all') {
        if (!account.brands.some(b => b.toLowerCase() === brandFilter.toLowerCase())) return false;
      }

      // Entity type filter
      if (entityTypeFilter !== 'all') {
        if (account.entity_type !== entityTypeFilter) return false;
      }

      // Source filter
      if (sourceFilter !== 'all') {
        if (!account.invoices.some(inv => inv.source === sourceFilter)) return false;
      }

      // Overdue filter
      if (overdueFilter !== 'all') {
        if (account.max_days_overdue < parseInt(overdueFilter)) return false;
      }

      // Balance filter
      if (balanceFilter !== 'all') {
        if (account.total_outstanding < parseInt(balanceFilter)) return false;
      }

      // Risk filter
      if (riskFilter !== 'all') {
        if (account.risk_level !== riskFilter) return false;
      }

      return true;
    });
  }, [data?.accounts, search, brandFilter, entityTypeFilter, sourceFilter, overdueFilter, balanceFilter, riskFilter]);

  // Paginated accounts
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(start, start + pageSize);
  }, [filteredAccounts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAccounts.length / pageSize);

  // KPI values (from system-wide data, NOT filtered)
  const kpi = data?.kpi;
  const verification = data?.verification;

  return (
    <>
    <div className="p-6 space-y-6">
      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* HEADER */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-500" />
            Unpaid Accounts & Collections
          </h1>
          <p className="text-muted-foreground">
            Track and manage ALL outstanding payments across Store, CRM, and Wholesale sources
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* VERIFICATION BAR */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {verification && (
        <Card className={`border ${verification.is_valid ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {verification.is_valid ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span className={verification.is_valid ? 'text-green-400' : 'text-red-400'}>
                  {verification.is_valid 
                    ? `✓ Ledger verified — ${verification.total_in_view.toLocaleString()} unpaid invoices across ${kpi?.unique_accounts_count.toLocaleString()} accounts`
                    : `⚠️ Discrepancy detected — Expected ${verification.total_expected}, found ${verification.total_in_view}`
                  }
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Store: {verification.store_unpaid_count}</span>
                <span>CRM: {verification.crm_unpaid_count}</span>
                <span>Wholesale: {verification.wholesale_unpaid_count}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* KPI STRIP (SYSTEM-WIDE - Never filtered) */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ${kpi?.total_outstanding.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Total Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              ${kpi?.total_overdue.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Unpaid Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpi?.unpaid_invoice_count.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {kpi?.overdue_invoice_count.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Accounts with Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpi?.unique_accounts_count.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Avg Days Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpi?.average_days_outstanding || "0"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {RISK_LEVELS.filter(r => r.value !== 'all').map(risk => {
          const riskData = kpi?.by_risk[risk.value as RiskLevel];
          return (
            <Card key={risk.value} className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">{risk.label} Risk</p>
                    <p className="text-xl font-bold">${riskData?.outstanding.toLocaleString() || 0}</p>
                  </div>
                  <Badge className={`${risk.color} text-white`}>
                    {riskData?.count || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* FILTERS */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={overdueFilter} onValueChange={setOverdueFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Overdue" />
              </SelectTrigger>
              <SelectContent>
                {OVERDUE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={balanceFilter} onValueChange={setBalanceFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Balance" />
              </SelectTrigger>
              <SelectContent>
                {BALANCE_THRESHOLDS.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskLevel | 'all')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* ACCOUNTS TABLE (ENTITY-FIRST) */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Unpaid Accounts ({filteredAccounts.length.toLocaleString()})
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              Showing {paginatedAccounts.length} of {filteredAccounts.length} accounts
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Brands</TableHead>
                    <TableHead className="text-right">Total Billed</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-center">Invoices</TableHead>
                    <TableHead className="text-center">Max Overdue</TableHead>
                    <TableHead className="text-center">Risk</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAccounts.map((account) => (
                    <Collapsible key={account.entity_id} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow 
                            className={`cursor-pointer hover:bg-muted/50 ${account.risk_level === 'critical' ? 'bg-red-500/5' : account.risk_level === 'high' ? 'bg-orange-500/5' : ''}`}
                            onClick={() => toggleAccount(account.entity_id)}
                          >
                            <TableCell>
                              {expandedAccounts.has(account.entity_id) 
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <EntityIcon type={account.entity_type} />
                                <div>
                                  <p className="font-medium">{account.entity_name}</p>
                                  {(account.city || account.state) && (
                                    <p className="text-xs text-muted-foreground">
                                      {account.city}{account.city && account.state && ', '}{account.state}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {account.entity_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {account.brands.slice(0, 2).map(brand => (
                                  <Badge key={brand} variant="secondary" className="text-[10px]">
                                    {brand}
                                  </Badge>
                                ))}
                                {account.brands.length > 2 && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    +{account.brands.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              ${account.total_billed.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-green-500">
                              ${account.total_paid.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-500">
                              ${account.total_outstanding.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{account.unpaid_invoice_count}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={account.max_days_overdue > 30 ? "destructive" : account.max_days_overdue > 7 ? "secondary" : "outline"}>
                                {account.max_days_overdue} days
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <RiskBadge level={account.risk_level} />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center items-center gap-1">
                                {/* Quick Actions */}
                                {account.phone && (
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7" 
                                    title="Send Reminder"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendReminder(account);
                                    }}
                                  >
                                    <Send className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                {/* More Actions Dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button size="icon" variant="ghost" className="h-7 w-7">
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Collection Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    
                                    <DropdownMenuItem onClick={() => handleSendReminder(account)} disabled={!account.phone}>
                                      <Send className="h-4 w-4 mr-2" />
                                      Send Reminder
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={() => handleGenerateStatement(account)}>
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Generate Statement
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={() => handleLogPayment(account)}>
                                      <Banknote className="h-4 w-4 mr-2" />
                                      Log Payment
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuSeparator />
                                    
                                    <DropdownMenuItem onClick={() => handleMarkDispute(account)}>
                                      <Flag className="h-4 w-4 mr-2" />
                                      Mark as Dispute
                                    </DropdownMenuItem>
                                    
                                    {account.risk_level !== 'critical' && (
                                      <DropdownMenuItem onClick={() => handleEscalate(account)} className="text-destructive">
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        Escalate
                                      </DropdownMenuItem>
                                    )}
                                    
                                    <DropdownMenuSeparator />
                                    
                                    <DropdownMenuItem onClick={() => {
                                      if (account.entity_type === 'store') {
                                        navigate(`/store/${account.entity_id}`);
                                      } else if (account.entity_type === 'company') {
                                        navigate(`/companies/${account.entity_id}`);
                                      } else if (account.entity_type === 'wholesaler') {
                                        navigate(`/wholesalers`);
                                      }
                                    }}>
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      View Profile
                                    </DropdownMenuItem>
                                    
                                    {isOwner && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() => setDeleteTarget({ id: account.entity_id, name: account.entity_name })}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete Account
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        
                        {/* Expanded Invoice Drawer */}
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={11} className="p-0">
                              {expandedAccounts.has(account.entity_id) && (
                                <div className="p-4 pl-12">
                                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Unpaid Invoices ({account.invoices.length})
                                  </h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs">Invoice #</TableHead>
                                        <TableHead className="text-xs">Source</TableHead>
                                        <TableHead className="text-xs">Invoice Date</TableHead>
                                        <TableHead className="text-xs">Due Date</TableHead>
                                        <TableHead className="text-xs text-center">Days Overdue</TableHead>
                                        <TableHead className="text-xs text-right">Billed</TableHead>
                                        <TableHead className="text-xs text-right">Paid</TableHead>
                                        <TableHead className="text-xs text-right">Balance</TableHead>
                                        <TableHead className="text-xs text-center">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {account.invoices.map(inv => (
                                        <TableRow key={inv.id} className="hover:bg-muted/50">
                                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                                          <TableCell><SourceBadge source={inv.source} /></TableCell>
                                          <TableCell className="text-xs">
                                            {format(new Date(inv.invoice_date), 'MMM d, yyyy')}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {inv.days_overdue > 0 ? (
                                              <Badge variant="destructive" className="text-[10px]">
                                                {inv.days_overdue} days
                                              </Badge>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right text-xs">
                                            ${inv.total_amount.toLocaleString()}
                                          </TableCell>
                                          <TableCell className="text-right text-xs text-green-500">
                                            ${inv.amount_paid.toLocaleString()}
                                          </TableCell>
                                          <TableCell className="text-right text-xs font-bold text-red-500">
                                            ${inv.balance_due.toLocaleString()}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <Badge variant="outline" className="text-[10px] capitalize">
                                              {inv.status}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                  
                  {paginatedAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        {filteredAccounts.length === 0 && data?.accounts?.length === 0
                          ? "No unpaid accounts found"
                          : "No accounts match your filters"
                        }
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredAccounts.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[25, 50, 100, 250]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>

    {/* GDS Delete Modal */}
    {deleteTarget && (
      <DeleteCollectionAccountModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        accountId={deleteTarget.id}
        accountName={deleteTarget.name}
        onDeleted={() => refetch()}
      />
    )}
    </>
  );
}
