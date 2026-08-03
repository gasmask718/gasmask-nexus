import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useClientPortal } from "./ClientPortalPage";

const fmtDuration = (s?: number | null) => {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function ClientCalls() {
  const { client } = useClientPortal();
  const [open, setOpen] = useState<string | null>(null);

  const { data: calls, isLoading, error } = useQuery({
    queryKey: ["client-portal-calls", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_receptionist_calls")
        .select(
          "id,created_at,caller_name,caller_phone,call_duration_seconds,call_outcome,summary,transcript,appointment_booked"
        )
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Call history</h2>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      <Card className="border-border">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : !calls?.length ? (
            <p className="p-6 text-sm text-muted-foreground">No calls logged yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Date</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c) => {
                  const expanded = open === c.id;
                  return (
                    <>
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => setOpen(expanded ? null : c.id)}
                      >
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(c.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.caller_name || c.caller_phone || "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm">{fmtDuration(c.call_duration_seconds)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.call_outcome && (
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {c.call_outcome.replace(/_/g, " ")}
                              </Badge>
                            )}
                            {c.appointment_booked && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-500/30 text-emerald-600"
                              >
                                Booked
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-sm text-xs text-muted-foreground">
                          <span className="line-clamp-2">{c.summary || "—"}</span>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow key={`${c.id}-t`}>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <p className="mb-1 text-xs font-semibold">Transcript</p>
                            <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                              {c.transcript || "No transcript available for this call."}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
