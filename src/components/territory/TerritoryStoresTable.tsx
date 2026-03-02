import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MapPin, CheckCircle, Eye, Phone } from "lucide-react";

interface TerritoryStoresTableProps {
  cityFilter: string;
  stateFilter: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  verified: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  pending_visit: "bg-amber-500/15 text-amber-500 border-amber-500/30",
};

export function TerritoryStoresTable({ cityFilter, stateFilter }: TerritoryStoresTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["territory-addresses-table", cityFilter, stateFilter, sourceFilter],
    queryFn: async () => {
      let query = supabase
        .from("territory_addresses")
        // ADDED 'phone' to the select statement
        .select(
          "id, store_name, full_address, city, state, zip, phone, discovery_status, discovered_by, address_type, verified_sells_grabba, last_checked_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (cityFilter !== "all") query = query.eq("city", cityFilter);
      if (stateFilter !== "all") query = query.eq("state", stateFilter);
      if (sourceFilter !== "all") query = query.eq("discovered_by", sourceFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (addresses || []).filter((a) => {
    if (statusFilter !== "all" && a.discovery_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (a.store_name || "").toLowerCase().includes(q) ||
        (a.full_address || "").toLowerCase().includes(q) ||
        (a.discovered_by || "").toLowerCase().includes(q) ||
        (a.phone || "").toLowerCase().includes(q) // ADDED phone to search filtering
      );
    }
    return true;
  });

  const statusCounts = (addresses || []).reduce<Record<string, number>>((acc, a) => {
    const st = a.discovery_status || "new";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const sourceCounts = (addresses || []).reduce<Record<string, number>>((acc, a) => {
    const src = a.discovered_by || "unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Ingested Addresses
            <Badge variant="secondary" className="ml-1">
              {filtered.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search store name, address, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-[250px] text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status ({addresses?.length || 0})</SelectItem>
                {Object.entries(statusCounts).map(([status, count]) => (
                  <SelectItem key={status} value={status}>
                    {status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources ({addresses?.length || 0})</SelectItem>
                <SelectItem value="yelp">Yelp ({sourceCounts.yelp || 0})</SelectItem>
                <SelectItem value="openstreetmap">OpenStreetMap ({sourceCounts.openstreetmap || 0})</SelectItem>
                <SelectItem value="google_places">Google Places ({sourceCounts.google_places || 0})</SelectItem>
                <SelectItem value="import">CSV/Import ({sourceCounts.import || 0})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {addresses?.length === 0
              ? "No ingested addresses found. Import or discover addresses from Territory Ingest."
              : "No addresses match your search/filter criteria."}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Full Address</TableHead>
                  <TableHead>City / State</TableHead>
                  <TableHead>Phone</TableHead> {/* ADDED Phone Header */}
                  <TableHead>Status</TableHead>
                  <TableHead>Discovered By</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sells Grabba</TableHead>
                  <TableHead>Last Checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((addr) => (
                  <TableRow key={addr.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">{addr.store_name || "—"}</TableCell>
                    <TableCell className="font-medium max-w-[240px] truncate">{addr.full_address || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {addr.city || "—"}, {addr.state || ""} {addr.zip || ""}
                    </TableCell>

                    {/* ADDED Phone Cell */}
                    <TableCell className="text-xs">
                      {addr.phone ? (
                        <a href={`tel:${addr.phone}`} className="hover:underline flex items-center gap-1">
                          {addr.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[addr.discovery_status || ""] || ""}>
                        {(addr.discovery_status || "new").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {addr.discovered_by ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          {addr.discovered_by}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{addr.address_type || "—"}</TableCell>
                    <TableCell>
                      {addr.verified_sells_grabba ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {addr.last_checked_at ? new Date(addr.last_checked_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
