import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { PhoneTypeBadge } from "@/components/communication/PhoneTypeBadge";
import { Search, Users, Phone, AlertTriangle } from "lucide-react";

export interface SelectedContact {
  type: string;
  id: string;
  phone: string;
  name: string;
}

interface ContactSelectorProps {
  selectedContacts: Map<string, SelectedContact>;
  onSelectionChange: (contacts: Map<string, SelectedContact>) => void;
  customNumbers: string;
  onCustomNumbersChange: (val: string) => void;
}

const ENTITY_TYPES = [
  { key: "store", label: "Stores" },
  { key: "prior_customer", label: "Prior Customers" },
  { key: "prospect", label: "Prospects" },
  { key: "driver", label: "Drivers" },
  { key: "biker", label: "Bikers" },
  { key: "ambassador", label: "Ambassadors" },
  { key: "wholesaler", label: "Wholesalers" },
  { key: "customer", label: "Customers" },
  { key: "active_purchaser", label: "Active Purchasers" },
] as const;

type EntityType = (typeof ENTITY_TYPES)[number]["key"];

type FlowStatus = "all" | "active_flow" | "recently_quiet" | "cold" | "long_dormant";

const FLOW_STATUS_META: Record<Exclude<FlowStatus, "all">, { label: string; dot: string; chip: string }> = {
  active_flow:    { label: "Active Flow",     dot: "bg-green-500",  chip: "data-[on=true]:bg-green-500/15 data-[on=true]:border-green-500/40 data-[on=true]:text-green-400" },
  recently_quiet: { label: "Recently Quiet",  dot: "bg-yellow-500", chip: "data-[on=true]:bg-yellow-500/15 data-[on=true]:border-yellow-500/40 data-[on=true]:text-yellow-400" },
  cold:           { label: "Cold",            dot: "bg-red-500",    chip: "data-[on=true]:bg-red-500/15 data-[on=true]:border-red-500/40 data-[on=true]:text-red-400" },
  long_dormant:   { label: "Long Dormant",    dot: "bg-zinc-500",   chip: "data-[on=true]:bg-zinc-500/20 data-[on=true]:border-zinc-500/40 data-[on=true]:text-zinc-300" },
};

interface ContactRow {
  key: string; // {type}:{id}
  type: EntityType;
  id: string;
  name: string;
  phone: string;
  flow_status?: Exclude<FlowStatus, "all">;
  lifetime_tubes?: number;
  days_since?: number;
}

const PAGE_SIZE = 20;

export default function ContactSelector({
  selectedContacts,
  onSelectionChange,
  customNumbers,
  onCustomNumbersChange,
}: ContactSelectorProps) {
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(new Set(["store"]));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const toggleType = (type: EntityType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    setPage(1);
  };

  // Fetch all contacts for active types
  const { data: allContacts = [], isLoading } = useQuery({
    queryKey: ["contact-selector", Array.from(activeTypes).sort()],
    queryFn: async () => {
      const rows: ContactRow[] = [];
      const types = Array.from(activeTypes);

      const fetchers: Promise<void>[] = [];

      if (types.includes("store")) {
        fetchers.push(
          (async () => {
            // Paginate to fetch ALL stores — including those without phones
            let page = 0;
            const PAGE = 1000;
            while (true) {
              const { data } = await (supabase as any)
                .from("store_master")
                .select("id, store_name, phone, phone_type, sms_capable")
                .order("store_name", { ascending: true })
                .range(page * PAGE, (page + 1) * PAGE - 1);
              if (!data?.length) break;
              data.forEach((r: any) =>
                rows.push({ key: `store:${r.id}`, type: "store", id: r.id, name: r.store_name || "", phone: r.phone || "" })
              );
              if (data.length < PAGE) break;
              page++;
            }
          })()
        );
      }
      if (types.includes("prospect")) {
        fetchers.push(
          (supabase as any)
            .from("territory_addresses")
            .select("id, store_name, phone")
            .not("phone", "is", null)
            .limit(5000)
            .then(({ data }: any) => {
              (data || []).forEach((r: any) =>
                rows.push({ key: `prospect:${r.id}`, type: "prospect", id: r.id, name: r.store_name || "", phone: r.phone || "" })
              );
            })
        );
      }
      if (types.includes("driver")) {
        fetchers.push(
          (supabase as any)
            .from("drivers")
            .select("id, full_name, phone")
            .not("phone", "is", null)
            .limit(1000)
            .then(({ data }: any) => {
              (data || []).forEach((r: any) =>
                rows.push({ key: `driver:${r.id}`, type: "driver", id: r.id, name: r.full_name || "", phone: r.phone || "" })
              );
            })
        );
      }
      if (types.includes("biker")) {
        fetchers.push(
          (supabase as any)
            .from("bikers")
            .select("id, full_name, phone")
            .not("phone", "is", null)
            .limit(1000)
            .then(({ data }: any) => {
              (data || []).forEach((r: any) =>
                rows.push({ key: `biker:${r.id}`, type: "biker", id: r.id, name: r.full_name || "", phone: r.phone || "" })
              );
            })
        );
      }
      if (types.includes("ambassador")) {
        fetchers.push(
          (supabase as any)
            .from("ambassadors")
            .select("id, name, user_id, profiles(phone)")
            .limit(1000)
            .then(({ data }: any) => {
              (data || []).forEach((r: any) => {
                const phone = r.profiles?.phone;
                if (phone) {
                  rows.push({ key: `ambassador:${r.id}`, type: "ambassador", id: r.id, name: r.name || "", phone });
                }
              });
            })
        );
      }
      if (types.includes("wholesaler")) {
        fetchers.push(
          (supabase as any)
            .from("wholesalers")
            .select("id, name, phone")
            .not("phone", "is", null)
            .limit(1000)
            .then(({ data }: any) => {
              (data || []).forEach((r: any) =>
                rows.push({ key: `wholesaler:${r.id}`, type: "wholesaler", id: r.id, name: r.name || "", phone: r.phone || "" })
              );
            })
        );
      }
      if (types.includes("customer")) {
        fetchers.push(
          (supabase as any)
            .from("people")
            .select("id, name, phone")
            .not("phone", "is", null)
            .limit(5000)
            .then(({ data }: any) => {
              (data || []).forEach((r: any) =>
                rows.push({ key: `customer:${r.id}`, type: "customer", id: r.id, name: r.name || "", phone: r.phone || "" })
              );
            })
        );
      }
      if (types.includes("active_purchaser")) {
        fetchers.push(
          (async () => {
            // Fetch stores that have finalized invoices
            const { data: invoiceData } = await (supabase as any)
              .from("invoices")
              .select("store_id, created_at, total, status")
              .eq("status", "finalized")
              .not("store_id", "is", null)
              .order("created_at", { ascending: false });

            if (invoiceData?.length) {
              const countMap: Record<string, number> = {};
              const lastPurchaseMap: Record<string, string> = {};
              const totalSpendMap: Record<string, number> = {};

              for (const inv of invoiceData as any[]) {
                if (!inv.store_id) continue;
                countMap[inv.store_id] = (countMap[inv.store_id] || 0) + 1;
                totalSpendMap[inv.store_id] = (totalSpendMap[inv.store_id] || 0) + (inv.total || 0);
                if (!lastPurchaseMap[inv.store_id]) lastPurchaseMap[inv.store_id] = inv.created_at;
              }

              const purchaserIds = Object.keys(countMap);
              const batchSize = 200;
              for (let i = 0; i < purchaserIds.length; i += batchSize) {
                const batch = purchaserIds.slice(i, i + batchSize);
                const { data: stores } = await (supabase as any)
                  .from("store_master")
                  .select("id, store_name, phone, phone_type, sms_capable")
                  .in("id", batch);
                (stores || []).forEach((s: any) =>
                  rows.push({
                    key: `active_purchaser:${s.id}`,
                    type: "active_purchaser" as EntityType,
                    id: s.id,
                    name: `${s.store_name} (${countMap[s.id] || 0} invoices · $${Math.round(totalSpendMap[s.id] || 0)})`,
                    phone: s.phone || "",
                  })
                );
              }
            }
          })()
        );
      }

      await Promise.all(fetchers);
      return rows;
    },
    enabled: activeTypes.size > 0,
  });

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allContacts;
    const q = search.toLowerCase();
    return allContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [allContacts, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageData = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const toggleContact = useCallback(
    (contact: ContactRow) => {
      const next = new Map(selectedContacts);
      if (next.has(contact.key)) {
        next.delete(contact.key);
      } else {
        next.set(contact.key, { type: contact.type, id: contact.id, phone: contact.phone, name: contact.name });
      }
      onSelectionChange(next);
    },
    [selectedContacts, onSelectionChange]
  );

  const togglePageAll = useCallback(() => {
    const next = new Map(selectedContacts);
    const allSelected = pageData.every((c) => next.has(c.key));
    if (allSelected) {
      pageData.forEach((c) => next.delete(c.key));
    } else {
      pageData.forEach((c) => next.set(c.key, { type: c.type, id: c.id, phone: c.phone, name: c.name }));
    }
    onSelectionChange(next);
  }, [selectedContacts, pageData, onSelectionChange]);

  const selectAllFiltered = useCallback(() => {
    const next = new Map(selectedContacts);
    filtered.forEach((c) => next.set(c.key, { type: c.type, id: c.id, phone: c.phone, name: c.name }));
    onSelectionChange(next);
  }, [selectedContacts, filtered, onSelectionChange]);

  const customCount = customNumbers
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n).length;
  const totalSelected = selectedContacts.size + customCount;

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/10">
      <Label className="text-base font-semibold flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" /> Target Audience
      </Label>

      {/* Store count summary */}
      {allContacts.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          <span>Total: <strong className="text-foreground">{allContacts.length.toLocaleString()}</strong></span>
          <span>With phone: <strong className="text-foreground">{allContacts.filter(c => c.phone).length.toLocaleString()}</strong></span>
          <span>No phone: <strong className="text-destructive">{allContacts.filter(c => !c.phone).length.toLocaleString()}</strong></span>
        </div>
      )}

      {/* Entity type badges */}
      <div className="flex flex-wrap gap-1.5">
        {ENTITY_TYPES.map((et) => (
          <Badge
            key={et.key}
            variant={activeTypes.has(et.key) ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => toggleType(et.key)}
          >
            {et.label}
          </Badge>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9 h-9"
        />
      </div>

      {/* Select all filtered */}
      {filtered.length > PAGE_SIZE && (
        <Button variant="ghost" size="sm" className="text-xs" onClick={selectAllFiltered}>
          Select all {filtered.length} contacts
        </Button>
      )}

      {/* Table */}
      <div className="border rounded-md bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={pageData.length > 0 && pageData.every((c) => selectedContacts.has(c.key))}
                  onCheckedChange={togglePageAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Loading contacts...</TableCell>
              </TableRow>
            ) : pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No contacts found.</TableCell>
              </TableRow>
            ) : (
              pageData.map((c) => {
                const missingPhone = !c.phone;
                return (
                  <TableRow key={c.key} className={missingPhone ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedContacts.has(c.key)}
                        onCheckedChange={() => toggleContact(c)}
                        disabled={missingPhone}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{c.name || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] capitalize">{c.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {missingPhone ? (
                        <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> No phone
                        </Badge>
                      ) : (
                        c.phone
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        totalItems={filtered.length}
        onPageChange={setPage}
      />

      {/* Custom numbers */}
      <div className="space-y-2 pt-2">
        <Label className="text-xs text-muted-foreground">Or Add Custom Numbers (comma separated)</Label>
        <Textarea
          placeholder="+1234567890, +0987654321"
          value={customNumbers}
          onChange={(e) => onCustomNumbersChange(e.target.value)}
          rows={2}
        />
      </div>

      {totalSelected > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-primary">
            {totalSelected.toLocaleString()} Total Targets Selected
          </span>
        </div>
      )}
    </div>
  );
}
