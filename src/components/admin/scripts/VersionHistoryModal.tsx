import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { History, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: string;
  naturalKeyColumn: string;
  naturalKeyValue: string | number | null;
  isCurrentColumn?: string; // 'is_current' or 'is_active'
  versionColumn?: string;   // 'version' or 'script_version'
  displayColumns: string[]; // which columns to show in the diff body
  rowId: string;            // id of the current row (restore target)
}

/**
 * Generic version history + restore modal for any table using the
 * snapshot_version_on_update() trigger.
 *
 * - Lists every row matching (naturalKeyColumn = naturalKeyValue),
 *   ordered by version desc.
 * - "Restore" updates the current row's content to the historical row's
 *   content. The trigger handles snapshotting the now-overwritten current
 *   into a new historical entry. Restore is a forward operation.
 */
export function VersionHistoryModal({
  open,
  onOpenChange,
  table,
  naturalKeyColumn,
  naturalKeyValue,
  isCurrentColumn = "is_current",
  versionColumn = "version",
  displayColumns,
  rowId,
}: VersionHistoryModalProps) {
  const qc = useQueryClient();

  const { data: versions, isLoading } = useQuery({
    queryKey: ["version-history", table, naturalKeyValue],
    enabled: open && naturalKeyValue != null,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("*")
        .eq(naturalKeyColumn, naturalKeyValue)
        .order(versionColumn, { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (historicalRow: any) => {
      // Build the restore payload — copy display columns + any plain
      // content columns, skip version-tracking columns.
      const skip = new Set([
        "id", "created_at", "updated_at",
        "version", "script_version",
        "is_current", "is_active",
        "parent_version_id", "superseded_at", "superseded_by", "created_by",
      ]);
      const payload: Record<string, any> = {};
      Object.entries(historicalRow).forEach(([k, v]) => {
        if (!skip.has(k)) payload[k] = v;
      });
      const { error } = await (supabase as any)
        .from(table)
        .update(payload)
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Restored. A new current version was created.");
      qc.invalidateQueries({ queryKey: ["version-history", table, naturalKeyValue] });
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: any) => toast.error(`Restore failed: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version history — {naturalKeyValue}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !versions?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No history.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v, idx) => {
                const isCurrent = !!v[isCurrentColumn];
                const versionNum = v[versionColumn];
                const ts = v.superseded_at || v.updated_at || v.created_at;
                return (
                  <div
                    key={v.id}
                    className={`border rounded-md p-3 ${isCurrent ? "border-primary bg-primary/5" : "border-muted"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={isCurrent ? "default" : "outline"}>
                          v{versionNum} {isCurrent && "· current"}
                        </Badge>
                        {ts && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(ts), "MMM d, yyyy h:mm a")}
                          </span>
                        )}
                      </div>
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(v)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      {displayColumns.map((col) => {
                        const val = v[col];
                        if (val == null || val === "") return null;
                        return (
                          <div key={col} className="grid grid-cols-[140px_1fr] gap-2">
                            <span className="text-xs font-medium text-muted-foreground">{col}</span>
                            <span className="text-xs whitespace-pre-wrap break-words">
                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
