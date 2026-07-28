import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPin, Search, Trash2, Route as RouteIcon, UserCog, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  useFieldWorkers,
  useWorkerEffectiveStores,
  useStoreSearch,
  useAssignStores,
  useUnassignStore,
  type FieldWorker,
} from "@/hooks/useFieldAssignments";
import { InviteButton } from "@/components/invites/InviteButton";

const TYPE_LABEL: Record<FieldWorker["type"], string> = {
  driver: "Driver",
  biker: "Biker",
  ambassador: "Ambassador",
};

export default function FieldAssignments() {
  const [workerFilter, setWorkerFilter] = useState("");
  const [selected, setSelected] = useState<FieldWorker | null>(null);
  const [storeTerm, setStoreTerm] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { data: workers = [], isLoading: workersLoading, error: workersError } = useFieldWorkers();
  const { data: stores = [], isLoading: storesLoading, error: storesError } = useWorkerEffectiveStores(selected);
  const { data: results = [], isFetching: searching } = useStoreSearch(storeTerm);
  const assign = useAssignStores();
  const unassign = useUnassignStore();

  const filteredWorkers = useMemo(() => {
    const q = workerFilter.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => w.name.toLowerCase().includes(q) || (w.phone || "").includes(q));
  }, [workers, workerFilter]);

  const assignedIds = useMemo(() => new Set(stores.map((s) => s.store_id)), [stores]);
  const permanent = stores.filter((s) => s.source === "assignment");
  const viaRoute = stores.filter((s) => s.source === "route");

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function doAssign() {
    if (!selected || picked.size === 0) return;
    await assign.mutateAsync({ worker: selected, storeIds: Array.from(picked) });
    setPicked(new Set());
    setStoreTerm("");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> People &amp; Access
          </h1>
          <p className="text-sm text-muted-foreground">
            One canonical workspace for worker invites, store assignments, and access governance.
          </p>
        </div>
      </div>

      <Tabs defaultValue="assignments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="invites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unified Invite Sender</CardTitle>
              <CardDescription>All worker invites use the same secure invite link and acceptance flow.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <InviteButton role="driver" label="Invite driver" />
              <InviteButton role="biker" label="Invite biker" />
              <InviteButton role="ambassador" label="Invite ambassador" />
              <InviteButton role="va" label="Invite VA" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Field Store Assignments</h2>
            <p className="text-sm text-muted-foreground">
              Permanent store ownership for drivers, bikers and ambassadors. Route-based access is automatic
              (last 30 days) and shown read-only alongside.
            </p>
          </div>

      {(workersError || storesError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{(workersError || storesError)?.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Worker picker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Workers</CardTitle>
            <CardDescription>{workers.length} total</CardDescription>
            <Input
              placeholder="Search worker…"
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
            />
          </CardHeader>
          <CardContent className="p-0">
            {workersLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <ScrollArea className="h-[540px]">
                <div className="divide-y">
                  {filteredWorkers.map((w) => (
                    <button
                      key={w.key}
                      onClick={() => { setSelected(w); setPicked(new Set()); }}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition ${selected?.key === w.key ? "bg-muted" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{w.name}</span>
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[w.type]}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{w.phone || "no phone"}</span>
                        {!w.user_id && <span className="text-destructive">no login</span>}
                      </div>
                    </button>
                  ))}
                  {filteredWorkers.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">No workers match.</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Assignment panel */}
        {!selected ? (
          <Card className="flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground text-sm">Pick a worker to manage their stores.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" /> Add stores to {selected.name}
                </CardTitle>
                <CardDescription>Search by store name or address, tick several, then assign in bulk.</CardDescription>
                <Input
                  placeholder="Search stores (min 2 characters)…"
                  value={storeTerm}
                  onChange={(e) => setStoreTerm(e.target.value)}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {searching && <Loader2 className="h-4 w-4 animate-spin" />}
                {results.length > 0 && (
                  <ScrollArea className="h-[240px] border rounded-md">
                    <div className="divide-y">
                      {results.map((s) => {
                        const already = assignedIds.has(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-start gap-3 px-3 py-2 text-sm ${already ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}`}
                          >
                            <Checkbox
                              className="mt-0.5"
                              disabled={already}
                              checked={picked.has(s.id)}
                              onCheckedChange={() => togglePick(s.id)}
                            />
                            <span>
                              <span className="font-medium">{s.store_name || "Unnamed store"}</span>
                              <span className="block text-xs text-muted-foreground">
                                {[s.address, s.city].filter(Boolean).join(", ")}
                                {already && " — already has access"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
                <Button onClick={doAssign} disabled={picked.size === 0 || assign.isPending}>
                  {assign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Assign {picked.size || ""} store{picked.size === 1 ? "" : "s"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Effective access — {selected.name}</CardTitle>
                <CardDescription>
                  {permanent.length} permanent · {viaRoute.length} via active routes ·{" "}
                  {permanent.length + viaRoute.length} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {storesLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                        Permanent assignments
                      </h3>
                      {permanent.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None yet.</p>
                      ) : (
                        <div className="divide-y border rounded-md">
                          {permanent.map((s) => (
                            <div key={s.assignment_id} className="flex items-center justify-between px-3 py-2">
                              <div className="text-sm">
                                <span className="font-medium">{s.store_name || "Unnamed store"}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {[s.address, s.city].filter(Boolean).join(", ")}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={unassign.isPending}
                                onClick={() => unassign.mutate({ worker: selected, assignmentId: s.assignment_id! })}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                        <RouteIcon className="h-3 w-3" /> Via active routes (read-only, last 30 days)
                      </h3>
                      {viaRoute.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No route-derived stores.</p>
                      ) : (
                        <div className="divide-y border rounded-md bg-muted/30">
                          {viaRoute.map((s) => (
                            <div key={s.store_id} className="flex items-center justify-between px-3 py-2">
                              <div className="text-sm">
                                <span className="font-medium">{s.store_name || "Unnamed store"}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {[s.address, s.city].filter(Boolean).join(", ")}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {s.route_label || "route"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Access Governance</CardTitle>
              <CardDescription>Roles, security review, and invite oversight remain restricted to owner/admin access.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/security/users">User Management</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/security/roles">Roles &amp; Permissions</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/security/console">Security Console</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
