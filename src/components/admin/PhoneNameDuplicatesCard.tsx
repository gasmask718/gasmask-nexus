/**
 * Phone+Name Duplicate Groups
 * Read-only surface for duplicates detected by (normalized_name, normalized_phone)
 * — independent of the address-based detector. Owner-cluster candidates are
 * flagged in yellow with R6 reason and are NOT auto-mergeable.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, ChevronDown, ChevronRight, Phone } from "lucide-react";

interface PhoneNameRow {
  phone_name_group_id: number;
  norm_name: string;
  norm_phone: string;
  group_size: number;
  store_id: string;
  store_name: string | null;
  raw_address: string | null;
  phone: string | null;
  created_at: string | null;
  is_winner: boolean;
  is_owner_cluster_candidate: boolean;
  needs_review: boolean;
  review_reason: string | null;
  distinct_addresses: number;
  distinct_names: number;
}

const fmtPhone = (p?: string | null) => {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
};

export default function PhoneNameDuplicatesCard() {
  const [search, setSearch] = useState("");
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [showOwnerOnly, setShowOwnerOnly] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["phone-name-duplicates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "detect_store_phone_name_duplicates" as any,
      );
      if (error) throw error;
      return (data ?? []) as PhoneNameRow[];
    },
    staleTime: 60_000,
  });

  const groups = useMemo(() => {
    const rows = data ?? [];
    const map = new Map<number, { meta: PhoneNameRow; members: PhoneNameRow[] }>();
    for (const r of rows) {
      if (!map.has(r.phone_name_group_id)) {
        map.set(r.phone_name_group_id, { meta: r, members: [] });
      }
      map.get(r.phone_name_group_id)!.members.push(r);
    }
    let arr = Array.from(map.values());
    if (showOwnerOnly) arr = arr.filter((g) => g.meta.is_owner_cluster_candidate);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (g) =>
          g.meta.norm_name.toLowerCase().includes(q) ||
          g.meta.norm_phone.includes(q.replace(/\D/g, "")),
      );
    }
    return arr.sort((a, b) => b.meta.group_size - a.meta.group_size);
  }, [data, search, showOwnerOnly]);

  const totalGroups = useMemo(() => {
    const ids = new Set((data ?? []).map((r) => r.phone_name_group_id));
    return ids.size;
  }, [data]);

  const ownerGroups = useMemo(() => {
    const ids = new Set(
      (data ?? [])
        .filter((r) => r.is_owner_cluster_candidate)
        .map((r) => r.phone_name_group_id),
    );
    return ids.size;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Phone + Name Duplicate Groups
        </CardTitle>
        <CardDescription>
          Independent of address. Catches duplicates where address fields are
          empty, formatted differently, or embedded in the store name. Owner-
          cluster candidates (same phone, different stores, different
          addresses) are flagged for manual review and are NOT auto-mergeable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border px-3 py-2 text-sm">
            <div className="text-xs text-muted-foreground">Phone+Name groups</div>
            <div className="text-xl font-semibold">{totalGroups}</div>
          </div>
          <div className="rounded-md border px-3 py-2 text-sm">
            <div className="text-xs text-muted-foreground">Total records</div>
            <div className="text-xl font-semibold">{data?.length ?? 0}</div>
          </div>
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 px-3 py-2 text-sm">
            <div className="text-xs text-yellow-700 dark:text-yellow-400">
              Owner-cluster candidates
            </div>
            <div className="text-xl font-semibold">{ownerGroups}</div>
          </div>
          <div className="rounded-md border px-3 py-2 text-sm">
            <div className="text-xs text-muted-foreground">
              Mergeable (non-owner)
            </div>
            <div className="text-xl font-semibold">
              {totalGroups - ownerGroups}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant={showOwnerOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOwnerOnly((v) => !v)}
          >
            {showOwnerOnly ? "Showing owner clusters" : "Show owner clusters only"}
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading phone+name
            clusters…
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Failed to load</AlertTitle>
            <AlertDescription>{(error as any).message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && groups.length === 0 && !error && (
          <div className="text-sm text-muted-foreground">No clusters match.</div>
        )}

        {groups.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const open = openGroup === g.meta.phone_name_group_id;
                  const owner = g.meta.is_owner_cluster_candidate;
                  return (
                    <>
                      <TableRow
                        key={g.meta.phone_name_group_id}
                        className={owner ? "bg-yellow-500/5" : ""}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setOpenGroup(
                                open ? null : g.meta.phone_name_group_id,
                              )
                            }
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          PN-{g.meta.phone_name_group_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {g.meta.norm_name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {fmtPhone(g.meta.norm_phone)}
                        </TableCell>
                        <TableCell className="text-right">
                          {g.meta.group_size}
                        </TableCell>
                        <TableCell>
                          {owner ? (
                            <Badge
                              variant="outline"
                              className="border-yellow-500/60 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              R6 owner cluster
                            </Badge>
                          ) : (
                            <Badge variant="secondary">candidate</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            {owner && (
                              <Alert className="mb-3 border-yellow-500/60 bg-yellow-500/10">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Manual review required</AlertTitle>
                                <AlertDescription>
                                  {g.meta.review_reason} — {g.meta.distinct_names}{" "}
                                  distinct name(s), {g.meta.distinct_addresses}{" "}
                                  distinct address(es). Do NOT auto-merge.
                                </AlertDescription>
                              </Alert>
                            )}
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Store</TableHead>
                                  <TableHead>Address</TableHead>
                                  <TableHead>Phone</TableHead>
                                  <TableHead>Created</TableHead>
                                  <TableHead>Role</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {g.members.map((m) => (
                                  <TableRow key={m.store_id}>
                                    <TableCell className="font-medium">
                                      {m.store_name ?? "—"}
                                      <div className="text-[10px] font-mono text-muted-foreground">
                                        {m.store_id.slice(0, 8)}…
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {m.raw_address || (
                                        <span className="text-muted-foreground italic">
                                          (empty)
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {fmtPhone(m.phone)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {m.created_at
                                        ? new Date(m.created_at).toLocaleDateString()
                                        : "—"}
                                    </TableCell>
                                    <TableCell>
                                      {m.is_winner ? (
                                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                                          winner
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline">loser</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
