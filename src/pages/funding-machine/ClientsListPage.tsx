import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Users, Plus, Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  intake: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  funded: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  completed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  paused: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export default function ClientsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["funding-clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_clients")
        .select("id, first_name, last_name, email, phone, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const statuses = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c: any) => c.status && s.add(c.status));
    return Array.from(s).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c: any) => {
      if (statusFilter !== "all" && (c.status || "") !== statusFilter) return false;
      if (!q) return true;
      const hay = `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clients, search, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/funding-machine")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-[#C9A84C]" />
              Funding Clients
            </h1>
            <p className="text-sm text-muted-foreground">All Funding Machine clients</p>
          </div>
        </div>
        <Button onClick={() => navigate("/funding-machine/intake")} className="gap-2">
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load clients: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {isLoading
              ? "Loading…"
              : `${filtered.length} of ${clients.length} client${clients.length === 1 ? "" : "s"}`}
          </CardTitle>
          <div className="flex flex-1 sm:flex-none gap-2 sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate(`/funding-machine/client/${c.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-accent/50 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    {c.first_name} {c.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.email || c.phone || "—"}
                  </div>
                </div>
                {c.status && (
                  <Badge
                    variant="outline"
                    className={STATUS_COLORS[c.status] || "border-zinc-500/30"}
                  >
                    {c.status}
                  </Badge>
                )}
              </button>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {clients.length === 0 ? "No clients yet." : "No clients match your filters."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
