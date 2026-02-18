import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Phone, Search, Loader2, FileText } from "lucide-react";

import { useAIAgents } from "@/hooks/useAIAgents";
import { useStoreCallTable, StoreRow } from "@/hooks/useStoreCallTable";
import { useBusiness } from "@/contexts/BusinessContext";
import { useCall } from "@/components/communication/CallProvider";
import { AgentSelectorDialog } from "./AgentSelectorDialog";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AIAgent } from "@/hooks/useAIAgents";

const ELEVENLABS_AGENT_ID = "agent_8601khrh92krfgrrdj6gqcdpwate";

type RecentTranscriptRow = {
  id: string;
  created_at: string | null;
  provider_call_sid: string | null;
  store_id: string | null;
  store_master?: { store_name: string | null } | null;
  manual_call_logs?: { id: string; created_at: string | null; metadata: any } | null;
};

export function AIAgentsPanel() {
  const { currentBusiness } = useBusiness();
  const { agents, agentsLoading } = useAIAgents(currentBusiness?.id);
  const { placeCallNow } = useCall();

  const {
    stores,
    isLoading: storesLoading,
    search,
    setSearch,
    pagination,
  } = useStoreCallTable();

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null);

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [activeTranscript, setActiveTranscript] = useState<{
    title: string;
    subtitle: string;
    text: string;
  } | null>(null);

  const handleCallClick = (store: StoreRow) => {
    setSelectedStore(store);
    setSelectorOpen(true);
  };

  const handleAgentConfirm = (agent: AIAgent) => {
    if (!selectedStore?.phone) return;

    // Place outbound call. Backend routes via twilio-elevenlabs-bridge so the AI agent
    // speaks directly on the phone call.
    placeCallNow({
      destinationPhone: selectedStore.phone,
      entityType: "store",
      entityId: selectedStore.id,
      entityName: selectedStore.store_name,
      agentId: ELEVENLABS_AGENT_ID,
    });

    setSelectorOpen(false);
  };

  const activeAgents = agents.filter((a) => a.active);

  const { data: recentTranscriptRows = [], isLoading: recentTranscriptsLoading } = useQuery({
    queryKey: ["recent-ai-call-transcripts", currentBusiness?.id],
    enabled: !!currentBusiness?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_recordings")
        .select(
          "id, created_at, provider_call_sid, store_id, store_master(store_name), manual_call_logs:manual_call_id(id, created_at, metadata)",
        )
        .eq("business_id", currentBusiness!.id)
        .not("elevenlabs_conversation_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data ?? []) as unknown as RecentTranscriptRow[];
    },
  });

  const transcriptCalls = useMemo(() => {
    const rows = recentTranscriptRows ?? [];

    const getTranscriptText = (metadata: any): string | null => {
      const text = metadata?.elevenlabs?.transcript_text;
      if (typeof text === "string" && text.trim().length > 0) return text;
      return null;
    };

    return rows
      .map((r) => {
        const transcriptText = getTranscriptText(r.manual_call_logs?.metadata);
        return {
          id: r.id,
          createdAt: r.created_at ?? r.manual_call_logs?.created_at ?? null,
          storeName: r.store_master?.store_name ?? null,
          transcriptText,
        };
      })
      .filter((x) => !!x.transcriptText);
  }, [recentTranscriptRows]);

  const openTranscript = (row: { storeName: string | null; createdAt: string | null; transcriptText: string | null }) => {
    if (!row.transcriptText) return;

    setActiveTranscript({
      title: row.storeName ?? "Call Transcript",
      subtitle: row.createdAt ? new Date(row.createdAt).toLocaleString() : "",
      text: row.transcriptText,
    });
    setTranscriptOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Agent Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Agents:</span>
        {agentsLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          activeAgents.map((agent) => (
            <Badge key={agent.id} variant="secondary" className="whitespace-nowrap text-xs">
              <Bot className="h-3 w-3 mr-1" />
              {agent.name}
            </Badge>
          ))
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stores..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Store Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storesLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No stores found
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.store_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.address}, {store.city}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{store.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.city}, {store.state}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCallClick(store)}
                        disabled={activeAgents.length === 0}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <DataTablePagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalCount}
            onPageChange={pagination.controls.goToPage}
            onPageSizeChange={pagination.controls.setPageSize}
            pageSizeOptions={[25, 50, 100]}
          />
        </CardContent>
      </Card>

      {/* Recent transcripts */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Recent AI Call Transcripts
          </div>

          {recentTranscriptsLoading ? (
            <div className="py-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : transcriptCalls.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground text-center">
              No transcripts yet — complete an AI call to see it here.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {transcriptCalls.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.storeName ?? "Unknown store"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openTranscript(c)}>
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Dialog */}
      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeTranscript?.title ?? "Transcript"}</DialogTitle>
            <DialogDescription>{activeTranscript?.subtitle ?? ""}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] rounded-md border p-3">
            <pre className="text-xs whitespace-pre-wrap font-mono">{activeTranscript?.text ?? ""}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Agent Selector Dialog */}
      {selectedStore && (
        <AgentSelectorDialog
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          storeName={selectedStore.store_name}
          storePhone={selectedStore.phone}
          agents={agents}
          onConfirm={handleAgentConfirm}
        />
      )}
    </div>
  );
}
