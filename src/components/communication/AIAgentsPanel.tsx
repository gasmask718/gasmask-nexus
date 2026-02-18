import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Phone, Search, Loader2 } from "lucide-react";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useStoreCallTable, StoreRow } from "@/hooks/useStoreCallTable";
import { useBusiness } from "@/contexts/BusinessContext";
import { useCall } from "@/components/communication/CallProvider";
import { AgentSelectorDialog } from "./AgentSelectorDialog";
import { VoiceCallDialog } from "./VoiceCallDialog";
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
  const [callOpen, setCallOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);

  const handleCallClick = (store: StoreRow) => {
    setSelectedStore(store);
    setSelectorOpen(true);
  };

  const handleAgentConfirm = (agent: AIAgent) => {
    if (!selectedStore) return;

    // Place Twilio outbound call to the store's phone
    if (selectedStore.phone) {
      placeCallNow({
        destinationPhone: selectedStore.phone,
        entityType: "store",
        entityId: selectedStore.id,
        entityName: selectedStore.store_name,
      });
    }

    // Open ElevenLabs AI agent voice dialog
    setSelectedAgent(agent);
    setSelectorOpen(false);
    setCallOpen(true);
  };

  const activeAgents = agents.filter((a) => a.active);

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
                    <TableCell className="text-muted-foreground">{store.address}, {store.city}</TableCell>
                    <TableCell className="text-muted-foreground">{store.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{store.city}, {store.state}</TableCell>
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

      {/* Voice Call Dialog */}
      {selectedAgent && selectedStore && (
        <VoiceCallDialog
          open={callOpen}
          onOpenChange={setCallOpen}
          agentName={selectedAgent.name}
          elevenlabsAgentId={ELEVENLABS_AGENT_ID}
          storeName={selectedStore.store_name}
          storePhone={selectedStore.phone}
        />
      )}
    </div>
  );
}
