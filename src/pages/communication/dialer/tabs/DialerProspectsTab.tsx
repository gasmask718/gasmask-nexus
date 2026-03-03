import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MapPin, ChevronLeft, ChevronRight, Download, Filter, Globe, PhoneCall } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportData } from "@/utils/exportUtils";

const PAGE_SIZE = 50;
const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];
const SOURCES = ["yelp", "google_places", "openstreetmap", "ai", "human", "import"];

export default function DialerProspectsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 300);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["dialer-prospects", debouncedSearch, stateFilter, sourceFilter, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_callable_prospects", {
        p_search: debouncedSearch,
        p_state: stateFilter,
        p_source: sourceFilter,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return data as any[];
    },
  });

  const prospects = data || [];
  const totalCount = prospects.length > 0 ? Number(prospects[0].total_count) : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelectedIds(new Set(prospects.map((p) => p.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const sourceLabel = (s: string) => {
    const map: Record<string, string> = {
      yelp: "Yelp",
      google_places: "Google",
      openstreetmap: "OSM",
      ai: "AI",
      human: "Manual",
      import: "Import",
    };
    return map[s] || s;
  };

  const handleExport = () => {
    const rows = (selectedIds.size > 0 ? prospects.filter((p) => selectedIds.has(p.id)) : prospects).map((p) => ({
      name: p.store_name || "",
      phone: p.phone || "", // Added phone to export
      address: p.full_address || "",
      city: p.city || "",
      state: p.state || "",
      source: p.discovered_by || "",
    }));
    exportData({ filename: "prospects-export", format: "csv", data: rows });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap p-3 border rounded-lg bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, address, city..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={stateFilter || "all"}
          onValueChange={(v) => {
            setStateFilter(v === "all" ? "" : v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[110px] h-9 text-xs">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter || "all"}
          onValueChange={(v) => {
            setSourceFilter(v === "all" ? "" : v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {sourceLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-primary/5 border-primary/20">
          <Badge variant="secondary">{selectedIds.size} selected</Badge>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            {prospects.length} shown of {totalCount.toLocaleString()} · Page {page + 1}/{totalPages}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select Page
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            <div className="divide-y">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading prospects...</div>
              ) : prospects.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No prospects match filters</div>
              ) : (
                prospects.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${selectedIds.has(p.id) ? "bg-primary/5" : ""}`}
                  >
                    <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{p.store_name || "Unknown"}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          <Globe className="h-2.5 w-2.5 mr-0.5" /> {sourceLabel(p.discovered_by)}
                        </Badge>
                      </div>
                      {/* Updated metadata row with Phone */}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-0.5">
                        {p.phone && (
                          <span className="flex items-center gap-1 text-primary/80">
                            <PhoneCall className="h-3 w-3" /> {p.phone}
                          </span>
                        )}
                        {p.full_address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {p.full_address}
                          </span>
                        )}
                        {p.city && (
                          <span>
                            {p.city}, {p.state}
                          </span>
                        )}
                        <span>Added: {new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {totalCount > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{" "}
          {totalCount.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm font-medium px-2">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
