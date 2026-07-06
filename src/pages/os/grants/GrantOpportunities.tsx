import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Calendar, DollarSign, ExternalLink } from "lucide-react";

const GOLD = "#C9A84C";

type Opportunity = {
  id: string;
  grant_name: string;
  funder_name: string;
  funder_type: string | null;
  category: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_typical: number | null;
  min_credit_score: number | null;
  min_time_in_business_months: number | null;
  requires_nonprofit: boolean | null;
  requires_minority_owned: boolean | null;
  requires_women_owned: boolean | null;
  requires_veteran_owned: boolean | null;
  eligible_states: string[] | null;
  eligible_industries: string[] | null;
  next_deadline: string | null;
  deadline_type: string | null;
  application_url: string | null;
  is_active: boolean;
};

const FUNDER_TYPES = ["federal","state","local","corporate","foundation","nonprofit","other"];

const fmtMoney = (n: number | null) =>
  n == null ? "—" : `$${Number(n).toLocaleString()}`;

const amountLabel = (o: Opportunity) => {
  if (o.amount_min && o.amount_max && o.amount_min !== o.amount_max)
    return `${fmtMoney(o.amount_min)} — ${fmtMoney(o.amount_max)}`;
  return fmtMoney(o.amount_typical ?? o.amount_max ?? o.amount_min);
};

export default function GrantOpportunities() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [search, setSearch] = useState("");
  const [funderType, setFunderType] = useState("all");
  const [amountBucket, setAmountBucket] = useState("any");
  const [pills, setPills] = useState({ minority: false, women: false, rolling: false });
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    grant_name: "", funder_name: "", funder_type: "federal", category: "",
    description: "", amount_min: "", amount_max: "", amount_typical: "",
    next_deadline: "", deadline_type: "fixed", application_url: "",
    requires_minority_owned: false, requires_women_owned: false,
    requires_veteran_owned: false, requires_nonprofit: false,
  };
  const [form, setForm] = useState(emptyForm);

  const fetchOpps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("grant_opportunities")
      .select("*")
      .eq("is_active", true)
      .order("amount_typical", { ascending: false, nullsFirst: false });
    if (error) { toast.error(error.message); setOpps([]); }
    else setOpps((data as Opportunity[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOpps(); }, []);

  const filtered = useMemo(() => {
    return opps.filter((o) => {
      if (search) {
        const q = search.toLowerCase();
        if (!o.grant_name?.toLowerCase().includes(q) &&
            !o.funder_name?.toLowerCase().includes(q)) return false;
      }
      if (funderType !== "all" && o.funder_type !== funderType) return false;
      const amt = o.amount_typical ?? o.amount_max ?? o.amount_min ?? 0;
      if (amountBucket === "under10" && !(amt < 10000)) return false;
      if (amountBucket === "10to50" && !(amt >= 10000 && amt <= 50000)) return false;
      if (amountBucket === "over50" && !(amt > 50000)) return false;
      if (pills.minority && !o.requires_minority_owned) return false;
      if (pills.women && !o.requires_women_owned) return false;
      if (pills.rolling && o.deadline_type !== "rolling") return false;
      return true;
    });
  }, [opps, search, funderType, amountBucket, pills]);

  const handleApply = async (o: Opportunity) => {
    const { data, error } = await supabase
      .from("grant_applications")
      .insert({
        opportunity_id: o.id,
        grant_name: o.grant_name,
        funder_name: o.funder_name,
        amount_requested: o.amount_typical,
        deadline: o.next_deadline,
        status: "identified",
        applicant_type: "dynasty_business",
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Application created!");
    navigate(`/os/grants/${data.id}`);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: any = {
      grant_name: form.grant_name.trim(),
      funder_name: form.funder_name.trim(),
      funder_type: form.funder_type,
      category: form.category || null,
      description: form.description || null,
      amount_min: form.amount_min ? Number(form.amount_min) : null,
      amount_max: form.amount_max ? Number(form.amount_max) : null,
      amount_typical: form.amount_typical ? Number(form.amount_typical) : null,
      next_deadline: form.next_deadline || null,
      deadline_type: form.deadline_type,
      application_url: form.application_url || null,
      requires_minority_owned: form.requires_minority_owned,
      requires_women_owned: form.requires_women_owned,
      requires_veteran_owned: form.requires_veteran_owned,
      requires_nonprofit: form.requires_nonprofit,
      is_active: true,
    };
    const { error } = await supabase.from("grant_opportunities").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Opportunity added");
    setAddOpen(false);
    setForm(emptyForm);
    fetchOpps();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">🗂️ Grant Opportunities</h1>
          <p className="text-muted-foreground mt-1">Browse and apply for available grants</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: GOLD, color: "#000" }} className="hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" /> Add Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Grant Opportunity</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Grant Name *</Label><Input required value={form.grant_name} onChange={(e)=>setForm({...form,grant_name:e.target.value})}/></div>
                <div><Label>Funder Name *</Label><Input required value={form.funder_name} onChange={(e)=>setForm({...form,funder_name:e.target.value})}/></div>
                <div>
                  <Label>Funder Type</Label>
                  <Select value={form.funder_type} onValueChange={(v)=>setForm({...form,funder_type:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{FUNDER_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}/></div>
                <div><Label>Amount Min</Label><Input type="number" value={form.amount_min} onChange={(e)=>setForm({...form,amount_min:e.target.value})}/></div>
                <div><Label>Amount Max</Label><Input type="number" value={form.amount_max} onChange={(e)=>setForm({...form,amount_max:e.target.value})}/></div>
                <div><Label>Amount Typical</Label><Input type="number" value={form.amount_typical} onChange={(e)=>setForm({...form,amount_typical:e.target.value})}/></div>
                <div>
                  <Label>Deadline Type</Label>
                  <Select value={form.deadline_type} onValueChange={(v)=>setForm({...form,deadline_type:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">fixed</SelectItem>
                      <SelectItem value="rolling">rolling</SelectItem>
                      <SelectItem value="quarterly">quarterly</SelectItem>
                      <SelectItem value="annual">annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Next Deadline</Label><Input type="date" value={form.next_deadline} onChange={(e)=>setForm({...form,next_deadline:e.target.value})}/></div>
                <div><Label>Application URL</Label><Input value={form.application_url} onChange={(e)=>setForm({...form,application_url:e.target.value})}/></div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.requires_minority_owned} onChange={(e)=>setForm({...form,requires_minority_owned:e.target.checked})}/>Minority-owned</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.requires_women_owned} onChange={(e)=>setForm({...form,requires_women_owned:e.target.checked})}/>Women-owned</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.requires_veteran_owned} onChange={(e)=>setForm({...form,requires_veteran_owned:e.target.checked})}/>Veteran-owned</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.requires_nonprofit} onChange={(e)=>setForm({...form,requires_nonprofit:e.target.checked})}/>Nonprofit</label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} style={{backgroundColor:GOLD,color:"#000"}}>{saving?"Saving...":"Save Opportunity"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <Input placeholder="Search grants..." className="pl-9" value={search} onChange={(e)=>setSearch(e.target.value)}/>
            </div>
            <Select value={funderType} onValueChange={setFunderType}>
              <SelectTrigger><SelectValue placeholder="All Types"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {FUNDER_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={amountBucket} onValueChange={setAmountBucket}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Amount</SelectItem>
                <SelectItem value="under10">Under $10K</SelectItem>
                <SelectItem value="10to50">$10K - $50K</SelectItem>
                <SelectItem value="over50">Over $50K</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["minority","women","rolling"] as const).map((k)=>(
              <button key={k} onClick={()=>setPills((p)=>({...p,[k]:!p[k]}))}
                className={`px-3 py-1 rounded-full text-xs border transition ${pills[k]?"border-transparent text-black":"border-border text-muted-foreground"}`}
                style={pills[k]?{backgroundColor:GOLD}:undefined}>
                {k[0].toUpperCase()+k.slice(1)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_,i)=><Skeleton key={i} className="h-64"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No opportunities found.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o)=>(
            <Card key={o.id} className="flex flex-col">
              <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  {o.funder_type && <Badge variant="outline" className="capitalize">{o.funder_type}</Badge>}
                  {o.deadline_type === "rolling" && <Badge style={{backgroundColor:GOLD,color:"#000"}}>Rolling ✓</Badge>}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{o.grant_name}</h3>
                  <p className="text-sm text-muted-foreground">{o.funder_name}</p>
                </div>
                {o.description && <p className="text-xs text-muted-foreground line-clamp-2">{o.description}</p>}
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4" style={{color:GOLD}}/>
                  <span className="font-semibold">{amountLabel(o)}</span>
                </div>
                {o.deadline_type !== "rolling" && o.next_deadline && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3"/> Deadline: {new Date(o.next_deadline).toLocaleDateString()}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {o.requires_minority_owned && <Badge variant="secondary" className="text-xs">Minority</Badge>}
                  {o.requires_women_owned && <Badge variant="secondary" className="text-xs">Women</Badge>}
                  {o.requires_veteran_owned && <Badge variant="secondary" className="text-xs">Veteran</Badge>}
                  {o.requires_nonprofit && <Badge variant="secondary" className="text-xs">Nonprofit</Badge>}
                </div>
                <div className="mt-auto flex gap-2 pt-2">
                  <Button onClick={()=>handleApply(o)} className="flex-1" style={{backgroundColor:GOLD,color:"#000"}}>Apply Now</Button>
                  {o.application_url && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={o.application_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4"/></a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
