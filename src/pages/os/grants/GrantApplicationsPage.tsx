// Dedicated Grant Applications page — /os/grants/applications
// Row-click navigates to /os/grants/:id (GrantApplicationDetail)
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, FileText, ArrowRight } from "lucide-react";
import { DataTablePagination } from "@/components/crud/DataTablePagination";

const GOLD = "#C9A84C";

type App = {
  id: string;
  grant_name: string;
  funder_name: string;
  status: string;
  amount_requested: number | null;
  amount_awarded: number | null;
  deadline: string | null;
  applicant_type: string;
  funding_client_id: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "identified", label: "Identified" },
  { key: "drafting", label: "Drafting" },
  { key: "submitted", label: "Submitted" },
  { key: "awarded", label: "Awarded" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_STYLE: Record<string, string> = {
  identified: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  drafting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  submitted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  awarded: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

function progressForStatus(s: string): number {
  switch (s) {
    case "identified": return 15;
    case "drafting": return 45;
    case "submitted": return 75;
    case "awarded": return 100;
    case "rejected": return 100;
    default: return 5;
  }
}

const fmtMoney = (n: number | null) =>
  n == null ? "—" : `$${Number(n).toLocaleString()}`;

export default function GrantApplicationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = location.pathname.endsWith("/approved")
    ? "awarded"
    : location.pathname.endsWith("/pending")
    ? "submitted"
    : "all";
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<App[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState(initialTab);
  const [applicantFilter, setApplicantFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Keep status tab in sync when navigating between /applications, /approved, /pending
  useEffect(() => { setStatusTab(initialTab); }, [initialTab]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("grant_applications")
      .select("id, grant_name, funder_name, status, amount_requested, amount_awarded, deadline, applicant_type, funding_client_id, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setApps([]);
    } else {
      setApps((data as App[]) ?? []);
      const ids = Array.from(new Set((data ?? []).map((a: any) => a.funding_client_id).filter(Boolean)));
      if (ids.length) {
        const { data: cli } = await supabase
          .from("funding_clients")
          .select("id, first_name, last_name, business_name")
          .in("id", ids);
        const map: Record<string, string> = {};
        (cli ?? []).forEach((c: any) => {
          map[c.id] = c.business_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
        });
        setClients(map);
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return apps.filter((a) => {
      if (statusTab !== "all" && a.status !== statusTab) return false;
      if (applicantFilter !== "all" && a.applicant_type !== applicantFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.grant_name?.toLowerCase().includes(q) &&
          !a.funder_name?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [apps, statusTab, applicantFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, statusTab, applicantFilter, pageSize]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length };
    STATUS_TABS.forEach(t => { if (t.key !== "all") c[t.key] = 0; });
    apps.forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1; });
    return c;
  }, [apps]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">📋 Grant Applications</h1>
          <p className="text-muted-foreground mt-1">Track every grant application across all businesses.</p>
        </div>
        <Button onClick={() => navigate("/os/grants/opportunities")} style={{ backgroundColor: GOLD, color: "#000" }}>
          Browse Opportunities <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search grant or funder..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={applicantFilter} onValueChange={setApplicantFilter}>
              <SelectTrigger><SelectValue placeholder="Applicant type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All applicants</SelectItem>
                <SelectItem value="dynasty_business">Dynasty Business</SelectItem>
                <SelectItem value="funding_client">Funding Client</SelectItem>
                <SelectItem value="uben">UBEN</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={statusTab} onValueChange={setStatusTab}>
            <TabsList className="flex flex-wrap gap-1 h-auto">
              {STATUS_TABS.map(t => (
                <TabsTrigger key={t.key} value={t.key} className="gap-2">
                  {t.label}
                  <Badge variant="secondary" className="text-xs">{counts[t.key] ?? 0}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No applications match your filters.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Grant</TableHead>
                    <TableHead>Funder</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="w-[160px]">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((a) => {
                    const pct = progressForStatus(a.status);
                    const applicant = a.funding_client_id
                      ? (clients[a.funding_client_id] ?? "Client")
                      : (a.applicant_type === "dynasty_business" ? "Dynasty Business" : a.applicant_type);
                    return (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/os/grants/${a.id}`)}
                      >
                        <TableCell className="font-medium">{applicant}</TableCell>
                        <TableCell>{a.grant_name}</TableCell>
                        <TableCell className="text-muted-foreground">{a.funder_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLE[a.status] ?? ""}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{fmtMoney(a.amount_awarded ?? a.amount_requested)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.deadline ? new Date(a.deadline).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2" />
                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <DataTablePagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filtered.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
