import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { dp } from "@/lib/dpClient";

export default function DPActivity() {
  const [actor, setActor] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dp-activity", actor],
    queryFn: async () => {
      let q = dp().from("activity_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (actor !== "all") q = q.eq("actor_type", actor);
      const { data } = await q;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((r: any) =>
    !search || `${r.action} ${r.entity_type} ${r.entity_id}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Activity Firehose</h2>
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Input placeholder="Search action / entity" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {["system","ai_agent","admin","partner","ambassador"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6">Loading…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead>
                <TableHead>Entity</TableHead><TableHead>Partner</TableHead><TableHead>Metadata</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{r.actor_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.action}</TableCell>
                    <TableCell className="text-xs">{r.entity_type}: {r.entity_id?.slice(0,8) ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.partner_id?.slice(0,8) ?? "—"}</TableCell>
                    <TableCell><pre className="text-xs max-w-md truncate">{JSON.stringify(r.metadata)}</pre></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
