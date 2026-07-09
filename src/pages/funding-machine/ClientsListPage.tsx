import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Plus } from "lucide-react";

export default function ClientsListPage() {
  const navigate = useNavigate();

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
          <Plus className="h-4 w-4" /> New Client
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
        <CardHeader>
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${clients.length} client${clients.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {clients.map((c: any) => (
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
                {c.status && <Badge variant="outline">{c.status}</Badge>}
              </button>
            ))}
            {!isLoading && clients.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No clients yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
