import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Camera, MapPin, Users, DollarSign, CheckCircle, Clock, AlertTriangle, 
  Plus, Eye, Star, Briefcase, Send, TrendingUp, Target, Search
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface TourRequest {
  id: string;
  venue_id: string | null;
  venue_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  venue_size: string | null;
  venue_type: string | null;
  preferred_date: string | null;
  budget_range: string | null;
  status: string;
  assigned_photographer_id: string | null;
  notes: string | null;
  created_at: string;
}

interface Photographer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  service_area: string | null;
  lat: number | null;
  lng: number | null;
  radius_miles: number;
  equipment_type: string;
  rating: number;
  jobs_completed: number;
  is_active: boolean;
  commission_rate: number;
  created_at: string;
}

interface PhotographerJob {
  id: string;
  request_id: string;
  photographer_id: string;
  status: string;
  price: number | null;
  commission_amount: number | null;
  photographer_payout: number | null;
  payout_status: string;
  scheduled_date: string | null;
  completed_at: string | null;
  tour_url: string | null;
  created_at: string;
}

interface VirtualTour {
  id: string;
  venue_id: string | null;
  tour_type: string;
  tour_url: string;
  is_verified: boolean;
  created_at: string;
}

// ─── Status Config ───────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  accepted: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  en_route: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant="outline" className={`${statusColors[status] || 'bg-muted text-muted-foreground'} text-xs font-semibold uppercase tracking-wider`}>
    {status.replace('_', ' ')}
  </Badge>
);

// ─── KPI Card ────────────────────────────────────────────────────────
const KPICard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) => (
  <Card className="bg-[#0a0f1a]/80 border-[#1e293b] hover:border-amber-500/30 transition-all">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${color === 'text-amber-400' ? 'from-amber-500/20 to-amber-600/10' : color === 'text-emerald-400' ? 'from-emerald-500/20 to-emerald-600/10' : color === 'text-blue-400' ? 'from-blue-500/20 to-blue-600/10' : 'from-purple-500/20 to-purple-600/10'}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function UTVirtualTours() {
  const [requests, setRequests] = useState<TourRequest[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [jobs, setJobs] = useState<PhotographerJob[]>([]);
  const [tours, setTours] = useState<VirtualTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showNewPhotographer, setShowNewPhotographer] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // ─── Data Fetching ─────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('virtual_tour_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('photographers').select('*').order('rating', { ascending: false }),
      supabase.from('photographer_jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('venue_virtual_tours').select('*').order('created_at', { ascending: false }),
    ]);
    if (r1.data) setRequests(r1.data);
    if (r2.data) setPhotographers(r2.data);
    if (r3.data) setJobs(r3.data);
    if (r4.data) setTours(r4.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ─── KPI Calculations ─────────────────────────────────────────────
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const completedRequests = requests.filter(r => r.status === 'completed').length;
  const activePhotographers = photographers.filter(p => p.is_active).length;
  const totalRevenue = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.commission_amount || 0), 0);
  const totalPayouts = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.photographer_payout || 0), 0);
  const verifiedTours = tours.filter(t => t.is_verified).length;
  const avgRating = photographers.length ? (photographers.reduce((s, p) => s + Number(p.rating), 0) / photographers.length).toFixed(1) : '0';

  // ─── Auto-Assignment Engine ────────────────────────────────────────
  const autoAssign = async (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req || !req.lat || !req.lng) {
      toast.error('Request missing location data for auto-assignment');
      return;
    }

    const { data: matches } = await supabase.rpc('match_photographers_by_location', {
      req_lat: req.lat,
      req_lng: req.lng,
      equipment: null,
    });

    if (!matches || matches.length === 0) {
      toast.warning('No photographers available in range — added to manual queue');
      return;
    }

    const best = matches[0];
    const price = 500; // default pricing
    const commissionRate = photographers.find(p => p.id === best.photographer_id)?.commission_rate || 20;
    const commissionAmount = price * (commissionRate / 100);
    const payout = price - commissionAmount;

    // Create job
    const { error: jobErr } = await supabase.from('photographer_jobs').insert({
      request_id: requestId,
      photographer_id: best.photographer_id,
      price,
      commission_amount: commissionAmount,
      photographer_payout: payout,
    });

    if (jobErr) { toast.error('Failed to create job'); return; }

    // Update request
    await supabase.from('virtual_tour_requests').update({
      status: 'assigned',
      assigned_photographer_id: best.photographer_id,
    }).eq('id', requestId);

    toast.success(`Auto-assigned to ${best.photographer_name} (${best.distance_miles.toFixed(1)} mi)`);
    fetchAll();
  };

  // ─── Create Request ────────────────────────────────────────────────
  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from('virtual_tour_requests').insert({
      venue_name: fd.get('venue_name') as string,
      contact_name: fd.get('contact_name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      address: fd.get('address') as string,
      venue_size: fd.get('venue_size') as string,
      venue_type: fd.get('venue_type') as string,
      preferred_date: fd.get('preferred_date') as string || null,
      budget_range: fd.get('budget_range') as string,
      lat: parseFloat(fd.get('lat') as string) || null,
      lng: parseFloat(fd.get('lng') as string) || null,
    });
    if (error) { toast.error('Failed to create request'); return; }
    toast.success('Tour request created');
    setShowNewRequest(false);
    fetchAll();
  };

  // ─── Create Photographer ───────────────────────────────────────────
  const handleCreatePhotographer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from('photographers').insert({
      name: fd.get('name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      service_area: fd.get('service_area') as string,
      lat: parseFloat(fd.get('lat') as string) || null,
      lng: parseFloat(fd.get('lng') as string) || null,
      radius_miles: parseInt(fd.get('radius_miles') as string) || 25,
      equipment_type: fd.get('equipment_type') as string,
    });
    if (error) { toast.error('Failed to add photographer'); return; }
    toast.success('Photographer added to network');
    setShowNewPhotographer(false);
    fetchAll();
  };

  // ─── Job Actions ───────────────────────────────────────────────────
  const updateJobStatus = async (jobId: string, status: string, tourUrl?: string) => {
    const update: any = { status };
    if (status === 'completed') {
      update.completed_at = new Date().toISOString();
      if (tourUrl) update.tour_url = tourUrl;
    }
    const { error } = await supabase.from('photographer_jobs').update(update).eq('id', jobId);
    if (error) { toast.error('Failed to update job'); return; }

    // If completed and has tour URL, create tour entry
    if (status === 'completed' && tourUrl) {
      const job = jobs.find(j => j.id === jobId);
      const req = requests.find(r => r.id === job?.request_id);
      await supabase.from('venue_virtual_tours').insert({
        venue_id: req?.venue_id,
        tour_url: tourUrl,
        tour_type: 'google',
      });
      // Update request status
      if (job) {
        await supabase.from('virtual_tour_requests').update({ status: 'completed' }).eq('id', job.request_id);
      }
      // Increment photographer jobs_completed
      if (job) {
        const photographer = photographers.find(p => p.id === job.photographer_id);
        if (photographer) {
          await supabase.from('photographers').update({ jobs_completed: photographer.jobs_completed + 1 }).eq('id', photographer.id);
        }
      }
    }

    toast.success(`Job ${status}`);
    fetchAll();
  };

  const verifyTour = async (tourId: string) => {
    await supabase.from('venue_virtual_tours').update({ is_verified: true, verified_at: new Date().toISOString() }).eq('id', tourId);
    toast.success('Tour verified ✓');
    fetchAll();
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Camera className="h-7 w-7 text-amber-400" />
            Virtual Tour Command
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Photographer marketplace • Auto-assignment • Commission engine</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                <Plus className="h-4 w-4 mr-1" /> New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0f1a] border-[#1e293b] max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-amber-400">New Virtual Tour Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateRequest} className="space-y-3">
                <div><Label>Venue Name *</Label><Input name="venue_name" required className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contact Name</Label><Input name="contact_name" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Phone</Label><Input name="phone" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div><Label>Email</Label><Input name="email" type="email" className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div><Label>Address</Label><Input name="address" className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Latitude</Label><Input name="lat" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Longitude</Label><Input name="lng" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Venue Size</Label><Input name="venue_size" placeholder="e.g. 2000 sqft" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Venue Type</Label><Input name="venue_type" placeholder="e.g. Restaurant" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Preferred Date</Label><Input name="preferred_date" type="date" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Budget Range</Label><Input name="budget_range" placeholder="e.g. $300-$500" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">Create Request</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewPhotographer} onOpenChange={setShowNewPhotographer}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                <Users className="h-4 w-4 mr-1" /> Add Photographer
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0f1a] border-[#1e293b] max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-emerald-400">Add Photographer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreatePhotographer} className="space-y-3">
                <div><Label>Name *</Label><Input name="name" required className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input name="phone" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Email</Label><Input name="email" type="email" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div><Label>Service Area</Label><Input name="service_area" placeholder="e.g. Miami, FL" className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Latitude</Label><Input name="lat" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Longitude</Label><Input name="lng" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Radius (mi)</Label><Input name="radius_miles" type="number" defaultValue={25} className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div>
                    <Label>Equipment</Label>
                    <select name="equipment_type" className="w-full h-10 rounded-md border border-[#1e293b] bg-[#0f172a] px-3 text-sm text-foreground">
                      <option value="360_camera">360° Camera</option>
                      <option value="matterport">Matterport</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">Add to Network</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0a0f1a] border border-[#1e293b] p-1">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Dashboard</TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Requests</TabsTrigger>
          <TabsTrigger value="photographers" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Photographers</TabsTrigger>
          <TabsTrigger value="jobs" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Jobs</TabsTrigger>
          <TabsTrigger value="tours" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Tours</TabsTrigger>
          <TabsTrigger value="commissions" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Commissions</TabsTrigger>
        </TabsList>

        {/* ═══ TAB: Dashboard ═══ */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={Camera} label="Total Requests" value={totalRequests} sub={`${pendingRequests} pending`} color="text-amber-400" />
            <KPICard icon={Users} label="Photographers" value={activePhotographers} sub={`Avg ${avgRating}★`} color="text-blue-400" />
            <KPICard icon={CheckCircle} label="Completed" value={completedRequests} sub={`${verifiedTours} verified`} color="text-emerald-400" />
            <KPICard icon={DollarSign} label="Platform Revenue" value={`$${totalRevenue.toLocaleString()}`} sub={`$${totalPayouts.toLocaleString()} paid out`} color="text-purple-400" />
          </div>

          {/* Recent Requests */}
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">Recent Requests</CardTitle></CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No tour requests yet</p>
              ) : (
                <div className="space-y-3">
                  {requests.slice(0, 5).map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0f172a]/60 border border-[#1e293b]">
                      <div>
                        <p className="font-medium text-sm">{req.venue_name}</p>
                        <p className="text-xs text-muted-foreground">{req.address || 'No address'} • {req.venue_type || 'Unknown type'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={req.status} />
                        {req.status === 'pending' && (
                          <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 text-xs" onClick={() => autoAssign(req.id)}>
                            Auto-Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Queue */}
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-red-400 text-sm uppercase tracking-wider flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Manual Assignment Queue</CardTitle></CardHeader>
            <CardContent>
              {requests.filter(r => r.status === 'pending' && !r.assigned_photographer_id).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Queue is clear</p>
              ) : (
                <div className="space-y-2">
                  {requests.filter(r => r.status === 'pending' && !r.assigned_photographer_id).map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div>
                        <p className="font-medium text-sm">{req.venue_name}</p>
                        <p className="text-xs text-muted-foreground">{req.address}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs border-amber-500/30 text-amber-400" onClick={() => autoAssign(req.id)}>
                          Retry Auto
                        </Button>
                        <ManualAssignButton requestId={req.id} photographers={photographers} onAssign={fetchAll} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Requests ═══ */}
        <TabsContent value="requests">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">All Tour Requests</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Venue</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id} className="border-[#1e293b]">
                      <TableCell>
                        <p className="font-medium text-sm">{req.venue_name}</p>
                        <p className="text-xs text-muted-foreground">{req.address || '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm">{req.contact_name || '—'}</TableCell>
                      <TableCell className="text-sm">{req.venue_type || '—'}</TableCell>
                      <TableCell className="text-sm">{req.preferred_date || '—'}</TableCell>
                      <TableCell className="text-sm">{req.budget_range || '—'}</TableCell>
                      <TableCell><StatusBadge status={req.status} /></TableCell>
                      <TableCell>
                        {req.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="text-amber-400 text-xs h-7" onClick={() => autoAssign(req.id)}>Assign</Button>
                            <ManualAssignButton requestId={req.id} photographers={photographers} onAssign={fetchAll} />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No requests</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Photographers ═══ */}
        <TabsContent value="photographers">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-emerald-400 text-sm uppercase tracking-wider">Photographer Network</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Name</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Radius</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {photographers.map(p => (
                    <TableRow key={p.id} className="border-[#1e293b]">
                      <TableCell>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.email || p.phone || '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm">{p.service_area || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-400">
                          {p.equipment_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{p.radius_miles} mi</TableCell>
                      <TableCell className="text-sm">
                        <span className="text-amber-400 flex items-center gap-1"><Star className="h-3 w-3" /> {Number(p.rating).toFixed(1)}</span>
                      </TableCell>
                      <TableCell className="text-sm">{p.jobs_completed}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${p.is_active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {photographers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No photographers</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Jobs ═══ */}
        <TabsContent value="jobs">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-purple-400 text-sm uppercase tracking-wider">Job Tracker</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Venue</TableHead>
                    <TableHead>Photographer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(job => {
                    const req = requests.find(r => r.id === job.request_id);
                    const photog = photographers.find(p => p.id === job.photographer_id);
                    return (
                      <TableRow key={job.id} className="border-[#1e293b]">
                        <TableCell className="text-sm font-medium">{req?.venue_name || '—'}</TableCell>
                        <TableCell className="text-sm">{photog?.name || '—'}</TableCell>
                        <TableCell><StatusBadge status={job.status} /></TableCell>
                        <TableCell className="text-sm">{job.price ? `$${job.price}` : '—'}</TableCell>
                        <TableCell className="text-sm">{job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {job.status === 'assigned' && (
                              <>
                                <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7" onClick={() => updateJobStatus(job.id, 'accepted')}>Accept</Button>
                                <Button size="sm" variant="ghost" className="text-red-400 text-xs h-7" onClick={() => updateJobStatus(job.id, 'rejected')}>Reject</Button>
                              </>
                            )}
                            {job.status === 'accepted' && (
                              <Button size="sm" variant="ghost" className="text-blue-400 text-xs h-7" onClick={() => updateJobStatus(job.id, 'en_route')}>En Route</Button>
                            )}
                            {job.status === 'en_route' && (
                              <CompleteJobButton jobId={job.id} onComplete={(url) => updateJobStatus(job.id, 'completed', url)} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {jobs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No jobs</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Tours ═══ */}
        <TabsContent value="tours">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-cyan-400 text-sm uppercase tracking-wider">Completed Tours — Verification</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Tour Type</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tours.map(tour => (
                    <TableRow key={tour.id} className="border-[#1e293b]">
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 border-cyan-500/30 text-cyan-400 uppercase">{tour.tour_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <a href={tour.tour_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm truncate max-w-[200px] block">
                          {tour.tour_url}
                        </a>
                      </TableCell>
                      <TableCell>
                        {tour.is_verified ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(tour.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {!tour.is_verified && (
                          <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7" onClick={() => verifyTour(tour.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Verify
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-blue-400 text-xs h-7" onClick={() => window.open(tour.tour_url, '_blank')}>
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tours.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tours yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Commissions ═══ */}
        <TabsContent value="commissions" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={DollarSign} label="Total Job Value" value={`$${jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.price || 0), 0).toLocaleString()}`} color="text-amber-400" />
            <KPICard icon={TrendingUp} label="Platform Fees" value={`$${totalRevenue.toLocaleString()}`} color="text-emerald-400" />
            <KPICard icon={Users} label="Photographer Payouts" value={`$${totalPayouts.toLocaleString()}`} color="text-blue-400" />
            <KPICard icon={Target} label="Avg Margin" value={totalRevenue > 0 ? `${((totalRevenue / (totalRevenue + totalPayouts)) * 100).toFixed(0)}%` : '0%'} color="text-purple-400" />
          </div>

          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">Commission Ledger</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Photographer</TableHead>
                    <TableHead>Job Price</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Payout Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.filter(j => j.price).map(job => {
                    const photog = photographers.find(p => p.id === job.photographer_id);
                    return (
                      <TableRow key={job.id} className="border-[#1e293b]">
                        <TableCell className="text-sm font-medium">{photog?.name || '—'}</TableCell>
                        <TableCell className="text-sm">${job.price?.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-emerald-400">${job.commission_amount?.toLocaleString() || '0'}</TableCell>
                        <TableCell className="text-sm text-blue-400">${job.photographer_payout?.toLocaleString() || '0'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${job.payout_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                            {job.payout_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {jobs.filter(j => j.price).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No commission data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────

function ManualAssignButton({ requestId, photographers, onAssign }: { requestId: string; photographers: Photographer[]; onAssign: () => void }) {
  const [open, setOpen] = useState(false);

  const assign = async (photographerId: string) => {
    const photog = photographers.find(p => p.id === photographerId);
    const price = 500;
    const commRate = photog?.commission_rate || 20;
    const commission = price * (commRate / 100);
    const payout = price - commission;

    await supabase.from('photographer_jobs').insert({
      request_id: requestId,
      photographer_id: photographerId,
      price,
      commission_amount: commission,
      photographer_payout: payout,
    });

    await supabase.from('virtual_tour_requests').update({
      status: 'assigned',
      assigned_photographer_id: photographerId,
    }).eq('id', requestId);

    toast.success(`Manually assigned to ${photog?.name}`);
    setOpen(false);
    onAssign();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-blue-400 text-xs h-7">Manual</Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0a0f1a] border-[#1e293b] max-w-md">
        <DialogHeader><DialogTitle className="text-blue-400">Select Photographer</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {photographers.filter(p => p.is_active).map(p => (
            <button key={p.id} onClick={() => assign(p.id)} className="w-full text-left p-3 rounded-lg bg-[#0f172a] border border-[#1e293b] hover:border-blue-500/30 transition-all">
              <p className="font-medium text-sm">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.service_area} • {p.equipment_type.replace('_', ' ')} • ★{Number(p.rating).toFixed(1)}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompleteJobButton({ jobId, onComplete }: { jobId: string; onComplete: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7">Complete</Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0a0f1a] border-[#1e293b] max-w-md">
        <DialogHeader><DialogTitle className="text-emerald-400">Complete Job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Tour URL *</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="bg-[#0f172a] border-[#1e293b]" /></div>
          <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold" disabled={!url} onClick={() => { onComplete(url); setOpen(false); }}>
            Mark Complete & Upload Tour
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
