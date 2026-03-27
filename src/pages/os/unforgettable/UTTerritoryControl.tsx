import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Globe, MapPin, Play, Pause, RotateCcw, Loader2, Search, Target,
  CheckCircle2, AlertTriangle, ChevronRight, Zap, BarChart3, Plus, X, Rocket
} from "lucide-react";
import {
  useStateCoverage, useTerritoryJobs, useCreateTerritoryJobs, useUpdateJobStatus,
  useUpdateStateCoverage, StateCoverage
} from "@/hooks/useUTTerritoryJobs";
import { useRunSingleJob, useProcessQueue } from "@/hooks/useRunTerritoryJob";
import { US_STATES, UT_CATEGORIES, getStateByName } from "@/data/usStates";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  running: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  queued: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  not_started: "bg-muted text-muted-foreground",
  needs_review: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  paused: "bg-muted text-muted-foreground",
};

const TIER_COLORS: Record<string, string> = {
  priority: "bg-red-500/10 text-red-400 border-red-500/30",
  secondary: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  hold: "bg-muted text-muted-foreground",
  complete: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

export default function UTTerritoryControl() {
  const [searchParams] = useSearchParams();
  const preSelectedState = searchParams.get("state") || "";
  const [selectedState, setSelectedState] = useState<string>(preSelectedState);
  const [drawerOpen, setDrawerOpen] = useState(!!preSelectedState);
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: states = [], isLoading: statesLoading } = useStateCoverage();
  const { data: stateJobs = [], isLoading: jobsLoading } = useTerritoryJobs(
    selectedState ? { state: selectedState } : undefined
  );
  const createJobs = useCreateTerritoryJobs();
  const updateJob = useUpdateJobStatus();
  const updateState = useUpdateStateCoverage();
  const queue = useProcessQueue();

  const filtered = useMemo(() => {
    let list = states;
    if (filterTier !== "all") list = list.filter(s => s.priority_tier === filterTier);
    if (filterStatus !== "all") list = list.filter(s => s.status === filterStatus);
    return list;
  }, [states, filterTier, filterStatus]);

  const handleOpenState = (state: string) => {
    setSelectedState(state);
    setDrawerOpen(true);
  };

  const handleSetTier = async (state: string, tier: string) => {
    try {
      await updateState.mutateAsync({ state, updates: { priority_tier: tier } as any });
      toast.success(`${state} set to ${tier}`);
    } catch { toast.error("Failed to update"); }
  };

  const totalLeads = states.reduce((s, st) => s + (st.total_leads || 0), 0);
  const coveredCount = states.filter(s => s.status !== "not_started").length;
  const priorityCount = states.filter(s => s.priority_tier === "priority").length;
  const inProgressCount = states.filter(s => s.status === "in_progress").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/os/unforgettable/intelligence">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">🗺️ Territory Control</h1>
            <p className="text-sm text-muted-foreground">50-state expansion operating board</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => queue.isRunning ? queue.pause() : queue.start()}
            className="gap-1.5"
          >
            {queue.isRunning ? (
              <><Pause className="h-3.5 w-3.5" /> Pause Queue</>
            ) : (
              <><Rocket className="h-3.5 w-3.5" /> Run All Queued</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Search Jobs
          </Button>
        </div>

        {/* Queue Progress */}
        {queue.isRunning && (
          <div className="absolute top-full left-0 right-0 px-6 pt-2 z-10">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />
              <Progress value={queue.progress.total > 0 ? (queue.progress.current / queue.progress.total) * 100 : 0} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{queue.progress.current}/{queue.progress.total}</span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/50"><CardContent className="p-3 text-center">
          <div className="text-lg font-bold">{coveredCount}/50</div>
          <div className="text-[10px] text-muted-foreground">States Covered</div>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="p-3 text-center">
          <div className="text-lg font-bold">{priorityCount}</div>
          <div className="text-[10px] text-muted-foreground">Priority States</div>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="p-3 text-center">
          <div className="text-lg font-bold">{inProgressCount}</div>
          <div className="text-[10px] text-muted-foreground">In Progress</div>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="p-3 text-center">
          <div className="text-lg font-bold">{totalLeads.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">Total Leads</div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterTier} onValueChange={setFilterTier}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="priority">🔴 Priority</SelectItem>
            <SelectItem value="secondary">🟡 Secondary</SelectItem>
            <SelectItem value="hold">⚪ Hold</SelectItem>
            <SelectItem value="complete">🟢 Complete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} states shown</span>
      </div>

      {/* State Grid */}
      {statesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(s => {
            const stateConfig = getStateByName(s.state);
            return (
              <Card
                key={s.state}
                className="cursor-pointer hover:border-primary/50 transition-all group"
                onClick={() => handleOpenState(s.state)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-bold text-sm">{stateConfig?.abbr || s.state.slice(0, 2).toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground">{s.state}</div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${TIER_COLORS[s.priority_tier] || ""}`}>
                      {s.priority_tier}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Leads</span><span className="font-medium text-foreground">{s.total_leads}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cities</span><span className="font-medium text-foreground">{s.cities_covered}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Categories</span><span className="font-medium text-foreground">{s.categories_searched}</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className={`text-[10px] w-full justify-center ${STATUS_STYLE[s.status] || STATUS_STYLE.not_started}`}>
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* State Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {selectedState}
            </SheetTitle>
          </SheetHeader>
          <StateDetailPanel
            state={selectedState}
            states={states}
            jobs={stateJobs}
            jobsLoading={jobsLoading}
            onSetTier={handleSetTier}
            onCreateJobs={(jobs) => createJobs.mutateAsync(jobs)}
          />
        </SheetContent>
      </Sheet>

      {/* Create Jobs Modal */}
      {showCreateModal && (
        <CreateJobsModal
          states={states}
          onClose={() => setShowCreateModal(false)}
          onCreate={(jobs) => { createJobs.mutateAsync(jobs); setShowCreateModal(false); }}
        />
      )}
    </div>
  );
}

// ─── State Detail Panel ─────────────────────────────────────────
function StateDetailPanel({
  state, states, jobs, jobsLoading, onSetTier, onCreateJobs,
}: {
  state: string;
  states: StateCoverage[];
  jobs: any[];
  jobsLoading: boolean;
  onSetTier: (state: string, tier: string) => void;
  onCreateJobs: (jobs: any[]) => void;
}) {
  const stateData = states.find(s => s.state === state);
  const stateConfig = getStateByName(state);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  if (!stateData) return <p className="p-4 text-muted-foreground">State not found</p>;

  const handleQuickSweep = () => {
    if (!stateConfig || selectedCats.length === 0) {
      toast.error("Select at least one category");
      return;
    }
    const newJobs = stateConfig.cities.flatMap(city =>
      selectedCats.map(cat => ({ state, city, category: cat }))
    );
    onCreateJobs(newJobs);
    toast.success(`Queued ${newJobs.length} jobs for ${state}`);
    setSelectedCats([]);
  };

  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const failedJobs = jobs.filter(j => j.status === "failed").length;

  return (
    <div className="space-y-6 mt-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{stateData.total_leads}</div>
          <div className="text-[10px] text-muted-foreground">Total Leads</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{stateData.total_onboarded}</div>
          <div className="text-[10px] text-muted-foreground">Onboarded</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{stateData.duplicate_count}</div>
          <div className="text-[10px] text-muted-foreground">Duplicates</div>
        </div>
      </div>

      {/* Priority Tier */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">PRIORITY TIER</h4>
        <div className="flex gap-2">
          {["priority", "secondary", "hold", "complete"].map(tier => (
            <Button
              key={tier}
              size="sm"
              variant={stateData.priority_tier === tier ? "default" : "outline"}
              className="capitalize text-xs h-7"
              onClick={() => onSetTier(state, tier)}
            >
              {tier}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Sweep */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">QUICK SWEEP — SELECT CATEGORIES</h4>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {UT_CATEGORIES.map(cat => (
            <label key={cat} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={selectedCats.includes(cat)}
                onCheckedChange={(checked) => {
                  setSelectedCats(prev => checked ? [...prev, cat] : prev.filter(c => c !== cat));
                }}
              />
              <span className="capitalize">{cat.replace(/_/g, " ")}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={handleQuickSweep} disabled={selectedCats.length === 0}>
            <Play className="h-3.5 w-3.5" />
            Queue Sweep ({stateConfig?.cities.length || 0} cities × {selectedCats.length} cats)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedCats(UT_CATEGORIES)}>Select All</Button>
        </div>
      </div>

      {/* Cities */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">CITIES ({stateConfig?.cities.length || 0})</h4>
        <div className="flex flex-wrap gap-1.5">
          {stateConfig?.cities.map(city => (
            <Badge key={city} variant="outline" className="text-xs">{city}</Badge>
          )) || <span className="text-xs text-muted-foreground">No cities configured</span>}
        </div>
      </div>

      {/* Search History */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">SEARCH HISTORY ({jobs.length} jobs)</h4>
        {jobsLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No search jobs yet for this state</p>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {jobs.slice(0, 20).map(job => (
              <div key={job.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/30 text-xs">
                <div>
                  <span className="font-medium">{job.city}</span>
                  <span className="text-muted-foreground ml-1.5 capitalize">• {job.category.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{job.leads_found} leads</span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[job.status] || ""}`}>{job.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-2 rounded bg-muted/20">
          <span className="text-muted-foreground">Completed Jobs:</span>
          <span className="font-medium ml-1">{completedJobs}</span>
        </div>
        <div className="p-2 rounded bg-muted/20">
          <span className="text-muted-foreground">Failed Jobs:</span>
          <span className="font-medium ml-1 text-red-400">{failedJobs}</span>
        </div>
        <div className="p-2 rounded bg-muted/20">
          <span className="text-muted-foreground">Last Run:</span>
          <span className="font-medium ml-1">{stateData.last_run_at ? new Date(stateData.last_run_at).toLocaleDateString() : "Never"}</span>
        </div>
        <div className="p-2 rounded bg-muted/20">
          <span className="text-muted-foreground">Categories:</span>
          <span className="font-medium ml-1">{stateData.categories_searched}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Create Jobs Modal ──────────────────────────────────────────
function CreateJobsModal({
  states, onClose, onCreate,
}: {
  states: StateCoverage[];
  onClose: () => void;
  onCreate: (jobs: any[]) => void;
}) {
  const [mode, setMode] = useState<"single" | "sweep" | "multi">("single");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  const stateConfig = getStateByName(selectedState);

  const handleCreate = () => {
    let jobs: any[] = [];

    if (mode === "single") {
      if (!selectedState || !selectedCity || selectedCats.length === 0) {
        toast.error("Select state, city, and at least one category");
        return;
      }
      jobs = selectedCats.map(cat => ({ state: selectedState, city: selectedCity, category: cat }));
    } else if (mode === "sweep") {
      if (!selectedState || selectedCats.length === 0) {
        toast.error("Select state and categories");
        return;
      }
      const cities = stateConfig?.cities || [];
      jobs = cities.flatMap(city => selectedCats.map(cat => ({ state: selectedState, city, category: cat })));
    } else if (mode === "multi") {
      if (selectedStates.length === 0 || selectedCats.length === 0) {
        toast.error("Select states and categories");
        return;
      }
      jobs = selectedStates.flatMap(st => {
        const cfg = getStateByName(st);
        return (cfg?.cities || []).flatMap(city =>
          selectedCats.map(cat => ({ state: st, city, category: cat }))
        );
      });
    }

    onCreate(jobs);
    toast.success(`Queued ${jobs.length} search jobs`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Create Search Jobs</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode */}
          <div className="flex gap-2">
            {(["single", "sweep", "multi"] as const).map(m => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)} className="capitalize text-xs">
                {m === "single" ? "Single City" : m === "sweep" ? "State Sweep" : "Multi-State"}
              </Button>
            ))}
          </div>

          {/* State Selection */}
          {mode !== "multi" ? (
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
              <SelectContent>
                {US_STATES.map(s => (
                  <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div>
              <h4 className="text-xs font-medium mb-2">Select States</h4>
              <div className="grid grid-cols-3 gap-1 max-h-[150px] overflow-y-auto">
                {US_STATES.map(s => (
                  <label key={s.name} className="flex items-center gap-1.5 text-xs p-1 cursor-pointer hover:bg-muted/50 rounded">
                    <Checkbox
                      checked={selectedStates.includes(s.name)}
                      onCheckedChange={(checked) => {
                        setSelectedStates(prev => checked ? [...prev, s.name] : prev.filter(st => st !== s.name));
                      }}
                    />
                    {s.abbr}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* City (single mode only) */}
          {mode === "single" && stateConfig && (
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
              <SelectContent>
                {stateConfig.cities.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium">Categories</h4>
              <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setSelectedCats(UT_CATEGORIES)}>Select All</Button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {UT_CATEGORIES.map(cat => (
                <label key={cat} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selectedCats.includes(cat)}
                    onCheckedChange={(checked) => {
                      setSelectedCats(prev => checked ? [...prev, cat] : prev.filter(c => c !== cat));
                    }}
                  />
                  <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>

          <Button className="w-full gap-1.5" onClick={handleCreate}>
            <Play className="h-3.5 w-3.5" /> Queue Search Jobs
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
