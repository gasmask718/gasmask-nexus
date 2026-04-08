import { useState, useEffect, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Camera, MapPin, Users, DollarSign, CheckCircle, Clock, AlertTriangle,
  Plus, Eye, Star, Briefcase, Send, TrendingUp, Target, Search,
  FileText, Shield, UserPlus, Map, Zap, BarChart3, AlertCircle,
  ThumbsUp, ThumbsDown, RefreshCw, ChevronRight, Award, Globe
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface TourRequest {
  id: string; venue_id: string | null; venue_name: string; contact_name: string | null;
  phone: string | null; email: string | null; address: string | null;
  lat: number | null; lng: number | null; venue_size: string | null; venue_type: string | null;
  preferred_date: string | null; budget_range: string | null; status: string;
  assigned_photographer_id: string | null; notes: string | null; created_at: string;
  package_type?: string; venue_category?: string; guest_capacity?: number;
  room_count?: number; wants_360?: boolean; wants_matterport?: boolean; wants_video?: boolean;
  rush_requested?: boolean; pricing_status?: string; source_channel?: string;
}

interface Photographer {
  id: string; name: string; phone: string | null; email: string | null;
  service_area: string | null; lat: number | null; lng: number | null;
  radius_miles: number; equipment_type: string; rating: number;
  jobs_completed: number; is_active: boolean; commission_rate: number; created_at: string;
  photographer_tier?: string; verification_status?: string; onboarding_completed?: boolean;
  portfolio_url?: string; minimum_job_price?: number; internal_notes?: string;
}

interface PhotographerJob {
  id: string; request_id: string; photographer_id: string; status: string;
  price: number | null; commission_amount: number | null; photographer_payout?: number | null;
  payout_status?: string; scheduled_date: string | null; completed_at: string | null;
  tour_url?: string | null; created_at: string; assignment_score?: number; completed_upload_type?: string;
  distance_miles?: number; qa_status?: string; qa_notes?: string;
  quote_id?: string;
}

interface VirtualTour {
  id: string; venue_id: string | null; tour_type: string; tour_url: string;
  is_verified: boolean; created_at: string; media_quality_score?: number;
  verified_at?: string; verified_by?: string; source_job_id?: string;
}

interface Application {
  id: string; full_name: string; business_name: string | null; phone: string | null;
  email: string | null; city: string | null; state: string | null;
  equipment_types: any; capabilities: any; turnaround_speed: string;
  rush_available: boolean; weekend_available: boolean; minimum_job_price: number | null;
  sample_work_links: any; insurance_status: string; application_status: string;
  review_notes: string | null; created_at: string; service_radius_miles: number;
}

interface Quote {
  id: string; request_id: string | null; package_type: string; base_price: number;
  adjustment_amount: number; travel_fee: number; rush_fee: number; demand_fee: number;
  platform_fee: number; photographer_payout: number; final_price_min: number | null;
  final_price_max: number | null; final_price_exact: number | null;
  pricing_confidence_score: number; quote_status: string; quote_notes: string | null;
  created_at: string; sent_at: string | null; approved_at: string | null;
}

interface Territory {
  id: string; photographer_id: string; city: string | null; state: string | null;
  radius_miles: number; priority_weight: number; is_primary: boolean; is_active: boolean;
}

interface CoverageZone {
  id: string; city: string; state: string; demand_score: number;
  active_requests_count: number; completed_jobs_count: number;
  active_photographers_count: number; coverage_gap_score: number; avg_time_to_assign: number;
  average_quote_value: number; recruitment_priority: string;
}

interface Scorecard {
  id: string; photographer_id: string; jobs_completed: number; acceptance_rate: number;
  completion_rate: number; avg_turnaround_hours: number; avg_rating: number;
  cancellation_rate: number; on_time_rate: number; quality_score: number;
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
  under_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  waitlisted: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  estimated: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant="outline" className={`${statusColors[status] || 'bg-muted text-muted-foreground'} text-xs font-semibold uppercase tracking-wider`}>
    {status.replace(/_/g, ' ')}
  </Badge>
);

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

// ─── Manual Assign Button ────────────────────────────────────────────
const ManualAssignButton = ({ requestId, photographers, onAssign }: { requestId: string; photographers: Photographer[]; onAssign: () => void }) => {
  const [open, setOpen] = useState(false);
  const assign = async (photographerId: string) => {
    const p = photographers.find(x => x.id === photographerId);
    const price = 500;
    const cr = p?.commission_rate || 20;
    const comm = price * (cr / 100);
    await supabase.from('photographer_jobs').insert({ request_id: requestId, photographer_id: photographerId, price, commission_amount: comm } as any);
    await supabase.from('virtual_tour_requests').update({ status: 'assigned', assigned_photographer_id: photographerId } as any).eq('id', requestId);
    toast.success('Manually assigned');
    setOpen(false);
    onAssign();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost" className="text-blue-400 text-xs h-7">Manual</Button></DialogTrigger>
      <DialogContent className="bg-[#0a0f1a] border-[#1e293b]">
        <DialogHeader><DialogTitle>Select Photographer</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {photographers.filter(p => p.is_active).map(p => (
            <div key={p.id} className="flex items-center justify-between p-2 rounded bg-[#0f172a] border border-[#1e293b]">
              <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.service_area} • {p.rating}★</p></div>
              <Button size="sm" onClick={() => assign(p.id)} className="bg-amber-500 text-black text-xs">Assign</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function UTVirtualTours() {
  const [requests, setRequests] = useState<TourRequest[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [jobs, setJobs] = useState<PhotographerJob[]>([]);
  const [tours, setTours] = useState<VirtualTour[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [coverageZones, setCoverageZones] = useState<CoverageZone[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showNewPhotographer, setShowNewPhotographer] = useState(false);
  const [showNewApplication, setShowNewApplication] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
      supabase.from('virtual_tour_requests').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('photographers').select('*').order('rating', { ascending: false }),
      supabase.from('photographer_jobs').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('venue_virtual_tours').select('*').order('created_at', { ascending: false }),
      (supabase.from('photographer_applications' as any) as any).select('*').order('created_at', { ascending: false }),
      (supabase.from('virtual_tour_quotes' as any) as any).select('*').order('created_at', { ascending: false }),
      (supabase.from('photographer_territories' as any) as any).select('*'),
      (supabase.from('market_coverage_zones' as any) as any).select('*').order('demand_score', { ascending: false }),
      (supabase.from('photographer_scorecards' as any) as any).select('*'),
    ]);
    if (r1.data) setRequests(r1.data as any);
    if (r2.data) setPhotographers(r2.data as any);
    if (r3.data) setJobs(r3.data as any);
    if (r4.data) setTours(r4.data as any);
    if (r5.data) setApplications(r5.data as any);
    if (r6.data) setQuotes(r6.data as any);
    if (r7.data) setTerritories(r7.data as any);
    if (r8.data) setCoverageZones(r8.data as any);
    if (r9.data) setScorecards(r9.data as any);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ─── KPI Calculations ─────────────────────────────────────────────
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const completedRequests = requests.filter(r => r.status === 'completed').length;
  const activePhotographers = photographers.filter(p => p.is_active).length;
  const totalRevenue = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.commission_amount || 0), 0);
  const totalPayouts = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + ((j.photographer_payout as number) || 0), 0);
  const verifiedTours = tours.filter(t => t.is_verified).length;
  const avgRating = photographers.length ? (photographers.reduce((s, p) => s + Number(p.rating), 0) / photographers.length).toFixed(1) : '0';
  const pendingApps = applications.filter(a => a.application_status === 'pending').length;
  const activeQuotes = quotes.filter(q => ['estimated', 'sent'].includes(q.quote_status)).length;
  const avgMargin = quotes.length ? (quotes.reduce((s, q) => s + q.platform_fee, 0) / quotes.length) : 0;

  // ─── Auto-Assignment v2 ────────────────────────────────────────────
  const autoAssignV2 = async (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) { toast.error('Request not found'); return; }

    // Try v2 scoring first
    const { data: scored, error: scoreErr } = await supabase.rpc('vt_score_assignment' as any, { p_request_id: requestId });
    
    if (scoreErr || !scored || (scored as any[]).length === 0) {
      // Fallback to v1
      if (req.lat && req.lng) {
        const { data: matches } = await supabase.rpc('match_photographers_by_location', { req_lat: req.lat, req_lng: req.lng, equipment: null });
        if (!matches || matches.length === 0) {
          toast.warning('No photographers available — added to manual queue');
          return;
        }
        const best = matches[0] as any;
        const price = 500;
        const cr = photographers.find(p => p.id === best.photographer_id)?.commission_rate || 20;
        const comm = price * (cr / 100);
        await supabase.from('photographer_jobs').insert({ request_id: requestId, photographer_id: best.photographer_id, price, commission_amount: comm } as any);
        await supabase.from('virtual_tour_requests').update({ status: 'assigned', assigned_photographer_id: best.photographer_id } as any).eq('id', requestId);
        toast.success(`Auto-assigned to ${best.photographer_name}`);
      } else {
        toast.warning('No location data for auto-assignment');
      }
      fetchAll();
      return;
    }

    const best = (scored as any[])[0];
    // Generate quote first
    await supabase.rpc('vt_calculate_quote' as any, { p_request_id: requestId });
    
    const price = 500;
    const cr = photographers.find(p => p.id === best.photographer_id)?.commission_rate || 20;
    const comm = price * (cr / 100);
    const payout = price - comm;

    await supabase.from('photographer_jobs').insert({
      request_id: requestId,
      photographer_id: best.photographer_id,
      price,
      commission_amount: comm,
      assignment_score: best.assignment_score,
      distance_miles: best.distance_miles,
    } as any);

    await supabase.from('virtual_tour_requests').update({
      status: 'assigned',
      assigned_photographer_id: best.photographer_id,
    } as any).eq('id', requestId);

    toast.success(`Auto-assigned to ${best.photographer_name} (score: ${best.assignment_score?.toFixed(0)}, ${best.distance_miles?.toFixed(1)} mi)`);
    fetchAll();
  };

  // ─── Generate Quote ────────────────────────────────────────────────
  const generateQuote = async (requestId: string) => {
    const { data, error } = await supabase.rpc('vt_calculate_quote' as any, { p_request_id: requestId });
    if (error) { toast.error('Failed to generate quote'); return; }
    toast.success('Quote generated');
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
      preferred_date: (fd.get('preferred_date') as string) || null,
      budget_range: fd.get('budget_range') as string,
      lat: parseFloat(fd.get('lat') as string) || null,
      lng: parseFloat(fd.get('lng') as string) || null,
      package_type: fd.get('package_type') as string || 'standard',
      guest_capacity: parseInt(fd.get('guest_capacity') as string) || null,
      room_count: parseInt(fd.get('room_count') as string) || null,
      rush_requested: fd.get('rush_requested') === 'on',
    } as any);
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
    } as any);
    if (error) { toast.error('Failed to add photographer'); return; }
    toast.success('Photographer added');
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
    if (status === 'accepted') update.accepted_at = new Date().toISOString();
    if (status === 'en_route') update.en_route_at = new Date().toISOString();

    const { error } = await supabase.from('photographer_jobs').update(update).eq('id', jobId);
    if (error) { toast.error('Failed to update job'); return; }

    if (status === 'completed' && tourUrl) {
      const job = jobs.find(j => j.id === jobId);
      const req = requests.find(r => r.id === job?.request_id);
      await supabase.from('venue_virtual_tours').insert({
        venue_id: req?.venue_id, tour_url: tourUrl, tour_type: 'google',
        uploaded_by_photographer_id: job?.photographer_id, source_job_id: jobId,
      } as any);
      if (job) await supabase.from('virtual_tour_requests').update({ status: 'completed' } as any).eq('id', job.request_id);
      if (job) {
        const p = photographers.find(x => x.id === job.photographer_id);
        if (p) await supabase.from('photographers').update({ jobs_completed: p.jobs_completed + 1 } as any).eq('id', p.id);
      }
    }
    toast.success(`Job ${status}`);
    fetchAll();
  };

  // ─── Tour Verification ────────────────────────────────────────────
  const verifyTour = async (tourId: string) => {
    await supabase.from('venue_virtual_tours').update({ is_verified: true, verified_at: new Date().toISOString() } as any).eq('id', tourId);
    toast.success('Tour verified ✓');
    fetchAll();
  };

  // ─── Application Actions ──────────────────────────────────────────
  const updateApplicationStatus = async (appId: string, status: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;

    if (status === 'approved') {
      // Create photographer from application
      const { data: newP, error: pErr } = await supabase.from('photographers').insert({
        name: app.full_name,
        phone: app.phone,
        email: app.email,
        service_area: `${app.city}, ${app.state}`,
        lat: null, lng: null,
        radius_miles: app.service_radius_miles || 25,
        equipment_type: Array.isArray(app.equipment_types) ? app.equipment_types[0] || '360_camera' : '360_camera',
        application_source: 'application',
        photographer_tier: 'standard',
        onboarding_completed: false,
        verification_status: 'pending',
        minimum_job_price: app.minimum_job_price,
      } as any).select().single();

      if (pErr) { toast.error('Failed to create photographer'); return; }

      // Create territory
      if (newP) {
        await (supabase.from('photographer_territories' as any) as any).insert({
          photographer_id: (newP as any).id,
          city: app.city, state: app.state,
          radius_miles: app.service_radius_miles || 25,
          is_primary: true,
        });
      }

      await (supabase.from('photographer_applications' as any) as any).update({
        application_status: 'approved',
        approved_photographer_id: (newP as any)?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', appId);
      toast.success(`${app.full_name} approved and added to network`);
    } else {
      await (supabase.from('photographer_applications' as any) as any).update({
        application_status: status,
        reviewed_at: new Date().toISOString(),
      }).eq('id', appId);
      toast.success(`Application ${status}`);
    }
    setSelectedApp(null);
    fetchAll();
  };

  // ─── Quote Actions ────────────────────────────────────────────────
  const updateQuoteStatus = async (quoteId: string, status: string) => {
    const update: any = { quote_status: status };
    if (status === 'sent') update.sent_at = new Date().toISOString();
    if (status === 'approved') update.approved_at = new Date().toISOString();
    await (supabase.from('virtual_tour_quotes' as any) as any).update(update).eq('id', quoteId);
    toast.success(`Quote ${status}`);
    fetchAll();
  };

  // ─── QA Actions ───────────────────────────────────────────────────
  const updateQA = async (jobId: string, qaStatus: string, notes?: string) => {
    await supabase.from('photographer_jobs').update({ qa_status: qaStatus, qa_notes: notes || null } as any).eq('id', jobId);
    toast.success(`QA: ${qaStatus}`);
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
          <p className="text-sm text-muted-foreground mt-1">Recruitment • Dynamic Pricing • Territory Intelligence • QA</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"><Plus className="h-4 w-4 mr-1" /> New Request</Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0f1a] border-[#1e293b] max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-amber-400">New Virtual Tour Request</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateRequest} className="space-y-3">
                <div><Label>Venue Name *</Label><Input name="venue_name" required className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contact Name</Label><Input name="contact_name" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Phone</Label><Input name="phone" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div><Label>Email</Label><Input name="email" type="email" className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div><Label>Address</Label><Input name="address" className="bg-[#0f172a] border-[#1e293b]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Lat</Label><Input name="lat" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Lng</Label><Input name="lng" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Venue Size</Label><Input name="venue_size" placeholder="e.g. 2000 sqft" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Venue Type</Label><Input name="venue_type" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Package</Label>
                    <select name="package_type" className="w-full h-10 rounded-md border border-[#1e293b] bg-[#0f172a] px-3 text-sm text-foreground">
                      <option value="standard">Standard</option><option value="premium">Premium</option><option value="elite">Elite</option>
                    </select>
                  </div>
                  <div><Label>Guest Cap.</Label><Input name="guest_capacity" type="number" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Rooms</Label><Input name="room_count" type="number" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Preferred Date</Label><Input name="preferred_date" type="date" className="bg-[#0f172a] border-[#1e293b]" /></div>
                  <div><Label>Budget</Label><Input name="budget_range" className="bg-[#0f172a] border-[#1e293b]" /></div>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="rush_requested" /> Rush Requested</label>
                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">Create Request</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => setShowNewPhotographer(true)}>
            <Users className="h-4 w-4 mr-1" /> Add Photographer
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="bg-[#0a0f1a] border border-[#1e293b] p-1 w-max">
            {[
               { v: 'dashboard', l: 'Dashboard' }, { v: 'requests', l: 'Requests' }, { v: 'quotes', l: 'Quotes' },
               { v: 'photographers', l: 'Photographers' }, { v: 'applications', l: `Applications${pendingApps ? ` (${pendingApps})` : ''}` },
               { v: 'territories', l: 'Territories' }, { v: 'jobs', l: 'Jobs' }, { v: 'tours', l: 'Tours' },
               { v: 'commissions', l: 'Commissions' }, { v: 'payouts', l: 'Payouts' }, { v: 'recruitment', l: 'Recruitment Intel' }, { v: 'qa', l: 'QA' },
            ].map(t => (
              <TabsTrigger key={t.v} value={t.v} className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-xs">{t.l}</TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {/* ═══ TAB: Dashboard ═══ */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={Camera} label="Total Requests" value={totalRequests} sub={`${pendingRequests} pending`} color="text-amber-400" />
            <KPICard icon={Users} label="Photographers" value={activePhotographers} sub={`Avg ${avgRating}★`} color="text-blue-400" />
            <KPICard icon={CheckCircle} label="Completed" value={completedRequests} sub={`${verifiedTours} verified`} color="text-emerald-400" />
            <KPICard icon={DollarSign} label="Platform Revenue" value={`$${totalRevenue.toLocaleString()}`} sub={`$${totalPayouts.toLocaleString()} paid out`} color="text-purple-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={UserPlus} label="Pending Apps" value={pendingApps} color="text-amber-400" />
            <KPICard icon={FileText} label="Active Quotes" value={activeQuotes} sub={`Avg margin $${avgMargin.toFixed(0)}`} color="text-blue-400" />
            <KPICard icon={Map} label="Coverage Zones" value={coverageZones.length} sub={`${coverageZones.filter(z => z.recruitment_priority === 'critical').length} critical`} color="text-emerald-400" />
            <KPICard icon={Shield} label="QA Pending" value={jobs.filter(j => j.qa_status === 'pending' && j.status === 'completed').length} color="text-purple-400" />
          </div>

          {/* Recent + Manual Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
              <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">Recent Requests</CardTitle></CardHeader>
              <CardContent>
                {requests.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">No requests yet</p> : (
                  <div className="space-y-3">
                    {requests.slice(0, 5).map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0f172a]/60 border border-[#1e293b]">
                        <div>
                          <p className="font-medium text-sm">{req.venue_name}</p>
                          <p className="text-xs text-muted-foreground">{req.address || 'No address'} • {req.venue_type || 'Unknown'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={req.status} />
                          {req.status === 'pending' && (
                            <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 text-xs" onClick={() => autoAssignV2(req.id)}>
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
                          <Button size="sm" variant="outline" className="text-xs border-amber-500/30 text-amber-400" onClick={() => autoAssignV2(req.id)}>Retry</Button>
                          <ManualAssignButton requestId={req.id} photographers={photographers} onAssign={fetchAll} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TAB: Requests ═══ */}
        <TabsContent value="requests">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">All Tour Requests</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Venue</TableHead><TableHead>Contact</TableHead><TableHead>Package</TableHead>
                    <TableHead>Date</TableHead><TableHead>Budget</TableHead><TableHead>Pricing</TableHead>
                    <TableHead>Status</TableHead><TableHead>Actions</TableHead>
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
                      <TableCell><Badge variant="outline" className="text-xs">{req.package_type || 'standard'}</Badge></TableCell>
                      <TableCell className="text-sm">{req.preferred_date || '—'}</TableCell>
                      <TableCell className="text-sm">{req.budget_range || '—'}</TableCell>
                      <TableCell><StatusBadge status={req.pricing_status || 'not_priced'} /></TableCell>
                      <TableCell><StatusBadge status={req.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {req.status === 'pending' && (
                            <>
                              <Button size="sm" variant="ghost" className="text-amber-400 text-xs h-7" onClick={() => autoAssignV2(req.id)}>Assign</Button>
                              <Button size="sm" variant="ghost" className="text-cyan-400 text-xs h-7" onClick={() => generateQuote(req.id)}>Quote</Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No requests</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Quotes ═══ */}
        <TabsContent value="quotes">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-cyan-400 text-sm uppercase tracking-wider">Quote Engine</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Package</TableHead><TableHead>Base</TableHead><TableHead>Travel</TableHead>
                    <TableHead>Rush</TableHead><TableHead>Platform Fee</TableHead><TableHead>Payout</TableHead>
                    <TableHead>Range</TableHead><TableHead>Confidence</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map(q => (
                    <TableRow key={q.id} className="border-[#1e293b]">
                      <TableCell><Badge variant="outline" className="text-xs">{q.package_type}</Badge></TableCell>
                      <TableCell className="text-sm">${q.base_price}</TableCell>
                      <TableCell className="text-sm">${q.travel_fee}</TableCell>
                      <TableCell className="text-sm">${q.rush_fee}</TableCell>
                      <TableCell className="text-sm text-emerald-400">${q.platform_fee.toFixed(0)}</TableCell>
                      <TableCell className="text-sm">${q.photographer_payout.toFixed(0)}</TableCell>
                      <TableCell className="text-sm">${q.final_price_min?.toFixed(0)} - ${q.final_price_max?.toFixed(0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={q.pricing_confidence_score} className="w-16 h-2" />
                          <span className="text-xs">{q.pricing_confidence_score}%</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={q.quote_status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {q.quote_status === 'estimated' && (
                            <Button size="sm" variant="ghost" className="text-blue-400 text-xs h-7" onClick={() => updateQuoteStatus(q.id, 'sent')}>Send</Button>
                          )}
                          {q.quote_status === 'sent' && (
                            <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7" onClick={() => updateQuoteStatus(q.id, 'approved')}>Approve</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {quotes.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No quotes yet — generate from Requests tab</TableCell></TableRow>}
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
                    <TableHead>Name</TableHead><TableHead>Tier</TableHead><TableHead>Area</TableHead>
                    <TableHead>Equipment</TableHead><TableHead>Rating</TableHead><TableHead>Jobs</TableHead>
                    <TableHead>Commission</TableHead><TableHead>Verification</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {photographers.map(p => {
                    const sc = scorecards.find(s => s.photographer_id === p.id);
                    return (
                      <TableRow key={p.id} className="border-[#1e293b]">
                        <TableCell>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.email || p.phone || '—'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${p.photographer_tier === 'elite' ? 'text-amber-400 border-amber-500/30' : p.photographer_tier === 'premium' ? 'text-purple-400 border-purple-500/30' : 'text-gray-400 border-gray-500/30'}`}>
                            {p.photographer_tier || 'standard'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{p.service_area || '—'}</TableCell>
                        <TableCell className="text-sm">{p.equipment_type}</TableCell>
                        <TableCell className="text-sm">{sc ? sc.avg_rating.toFixed(1) : p.rating}★</TableCell>
                        <TableCell className="text-sm">{sc ? sc.jobs_completed : p.jobs_completed}</TableCell>
                        <TableCell className="text-sm">{p.commission_rate}%</TableCell>
                        <TableCell><StatusBadge status={p.verification_status || 'pending'} /></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${p.is_active ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {photographers.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No photographers</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Applications ═══ */}
        <TabsContent value="applications" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={UserPlus} label="Total Applications" value={applications.length} color="text-amber-400" />
            <KPICard icon={Clock} label="Pending Review" value={applications.filter(a => a.application_status === 'pending').length} color="text-blue-400" />
            <KPICard icon={CheckCircle} label="Approved" value={applications.filter(a => a.application_status === 'approved').length} color="text-emerald-400" />
            <KPICard icon={AlertCircle} label="Waitlisted" value={applications.filter(a => a.application_status === 'waitlisted').length} color="text-purple-400" />
          </div>

          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">Recruitment Pipeline</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Equipment</TableHead>
                    <TableHead>Rush</TableHead><TableHead>Weekend</TableHead><TableHead>Min Price</TableHead>
                    <TableHead>Insurance</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map(app => (
                    <TableRow key={app.id} className="border-[#1e293b]">
                      <TableCell>
                        <p className="font-medium text-sm">{app.full_name}</p>
                        <p className="text-xs text-muted-foreground">{app.business_name || app.email || '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm">{app.city}, {app.state}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(app.equipment_types) ? app.equipment_types.join(', ') : '—'}</TableCell>
                      <TableCell>{app.rush_available ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{app.weekend_available ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{app.minimum_job_price ? `$${app.minimum_job_price}` : '—'}</TableCell>
                      <TableCell><StatusBadge status={app.insurance_status || 'unknown'} /></TableCell>
                      <TableCell><StatusBadge status={app.application_status} /></TableCell>
                      <TableCell>
                        {app.application_status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="text-blue-400 text-xs h-7" onClick={() => updateApplicationStatus(app.id, 'under_review')}>Review</Button>
                          </div>
                        )}
                        {app.application_status === 'under_review' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7" onClick={() => updateApplicationStatus(app.id, 'approved')}>
                              <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="text-orange-400 text-xs h-7" onClick={() => updateApplicationStatus(app.id, 'waitlisted')}>Waitlist</Button>
                            <Button size="sm" variant="ghost" className="text-red-400 text-xs h-7" onClick={() => updateApplicationStatus(app.id, 'rejected')}>
                              <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {applications.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No applications yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Territories ═══ */}
        <TabsContent value="territories" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={Map} label="Total Zones" value={coverageZones.length} color="text-amber-400" />
            <KPICard icon={AlertTriangle} label="Critical Gaps" value={coverageZones.filter(z => z.recruitment_priority === 'critical').length} color="text-blue-400" />
            <KPICard icon={Users} label="Territories Assigned" value={territories.filter(t => t.is_active).length} color="text-emerald-400" />
            <KPICard icon={Target} label="High Priority" value={coverageZones.filter(z => z.recruitment_priority === 'high').length} color="text-purple-400" />
          </div>

          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-amber-400 text-sm uppercase tracking-wider">Market Coverage Zones</CardTitle>
                <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 text-xs" onClick={async () => {
                  const { data } = await supabase.rpc('vt_refresh_coverage_zones' as any);
                  toast.success(`Coverage zones refreshed`);
                  fetchAll();
                }}><RefreshCw className="h-3 w-3 mr-1" /> Refresh</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>City</TableHead><TableHead>Demand</TableHead><TableHead>Active Requests</TableHead>
                    <TableHead>Photographers</TableHead><TableHead>Coverage Gap</TableHead><TableHead>Avg Quote</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverageZones.map(z => (
                    <TableRow key={z.id} className="border-[#1e293b]">
                      <TableCell className="font-medium text-sm">{z.city}, {z.state}</TableCell>
                      <TableCell>
                        <Progress value={Math.min(z.demand_score * 10, 100)} className="w-16 h-2" />
                      </TableCell>
                      <TableCell className="text-sm">{z.active_requests_count}</TableCell>
                      <TableCell className="text-sm">{z.active_photographers_count}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${z.coverage_gap_score > 50 ? 'text-red-400 border-red-500/30' : z.coverage_gap_score > 20 ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                          {z.coverage_gap_score > 50 ? 'No Coverage' : z.coverage_gap_score > 20 ? 'Thin' : 'Covered'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">${z.average_quote_value.toFixed(0)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${z.recruitment_priority === 'critical' ? 'text-red-400 border-red-500/30 animate-pulse' : z.recruitment_priority === 'high' ? 'text-amber-400 border-amber-500/30' : 'text-gray-400 border-gray-500/30'}`}>
                          {z.recruitment_priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {coverageZones.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No coverage data — click Refresh</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Photographer Territories */}
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-emerald-400 text-sm uppercase tracking-wider">Photographer Territory Assignments</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Photographer</TableHead><TableHead>City</TableHead><TableHead>State</TableHead>
                    <TableHead>Radius</TableHead><TableHead>Primary</TableHead><TableHead>Priority</TableHead><TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {territories.map(t => {
                    const p = photographers.find(x => x.id === t.photographer_id);
                    return (
                      <TableRow key={t.id} className="border-[#1e293b]">
                        <TableCell className="font-medium text-sm">{p?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{t.city || '—'}</TableCell>
                        <TableCell className="text-sm">{t.state || '—'}</TableCell>
                        <TableCell className="text-sm">{t.radius_miles} mi</TableCell>
                        <TableCell>{t.is_primary ? <Star className="h-4 w-4 text-amber-400" /> : '—'}</TableCell>
                        <TableCell className="text-sm">{t.priority_weight}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${t.is_active ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                            {t.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {territories.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No territories assigned yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Jobs ═══ */}
        <TabsContent value="jobs">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-blue-400 text-sm uppercase tracking-wider">Photographer Jobs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Photographer</TableHead><TableHead>Score</TableHead><TableHead>Distance</TableHead>
                    <TableHead>Price</TableHead><TableHead>Payout</TableHead><TableHead>QA</TableHead>
                    <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(job => {
                    const p = photographers.find(x => x.id === job.photographer_id);
                    return (
                      <TableRow key={job.id} className="border-[#1e293b]">
                        <TableCell className="font-medium text-sm">{p?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{job.assignment_score?.toFixed(0) || '—'}</TableCell>
                        <TableCell className="text-sm">{job.distance_miles?.toFixed(1) || '—'} mi</TableCell>
                        <TableCell className="text-sm">${job.price || 0}</TableCell>
                        <TableCell className="text-sm">${job.photographer_payout || 0}</TableCell>
                        <TableCell><StatusBadge status={job.qa_status || 'pending'} /></TableCell>
                        <TableCell><StatusBadge status={job.status} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {job.status === 'assigned' && (
                              <Button size="sm" variant="ghost" className="text-cyan-400 text-xs h-7" onClick={() => updateJobStatus(job.id, 'accepted')}>Accept</Button>
                            )}
                            {job.status === 'accepted' && (
                              <Button size="sm" variant="ghost" className="text-indigo-400 text-xs h-7" onClick={() => updateJobStatus(job.id, 'en_route')}>En Route</Button>
                            )}
                            {(job.status === 'en_route' || job.status === 'in_progress') && (
                              <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7" onClick={() => {
                                const url = prompt('Enter tour URL:');
                                if (url) updateJobStatus(job.id, 'completed', url);
                              }}>Complete</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {jobs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No jobs</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Tours ═══ */}
        <TabsContent value="tours">
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-emerald-400 text-sm uppercase tracking-wider">Completed Tours</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Type</TableHead><TableHead>Tour URL</TableHead><TableHead>Quality</TableHead>
                    <TableHead>Verified</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tours.map(tour => (
                    <TableRow key={tour.id} className="border-[#1e293b]">
                      <TableCell><Badge variant="outline" className="text-xs">{tour.tour_type}</Badge></TableCell>
                      <TableCell>
                        <a href={tour.tour_url} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center gap-1">
                          <Eye className="h-3 w-3" /> View Tour
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">{tour.media_quality_score ? `${tour.media_quality_score}/10` : '—'}</TableCell>
                      <TableCell>
                        {tour.is_verified ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs"><CheckCircle className="h-3 w-3 mr-1" /> Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(tour.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {!tour.is_verified && (
                          <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7" onClick={() => verifyTour(tour.id)}>
                            <Shield className="h-3 w-3 mr-1" /> Verify
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {tours.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tours</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Commissions ═══ */}
        <TabsContent value="commissions" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} color="text-amber-400" />
            <KPICard icon={DollarSign} label="Total Payouts" value={`$${totalPayouts.toLocaleString()}`} color="text-blue-400" />
            <KPICard icon={TrendingUp} label="Net Margin" value={`$${(totalRevenue - totalPayouts).toLocaleString()}`} color="text-emerald-400" />
            <KPICard icon={BarChart3} label="Avg Margin/Job" value={jobs.filter(j => j.status === 'completed').length > 0 ? `$${((totalRevenue - totalPayouts) / jobs.filter(j => j.status === 'completed').length).toFixed(0)}` : '$0'} color="text-purple-400" />
          </div>

          {/* Margin alerts */}
          {(() => {
            const lowMarginQuotes = quotes.filter(q => q.platform_fee < q.photographer_payout * 0.15);
            const highFeeQuotes = quotes.filter(q => q.platform_fee > q.final_price_max! * 0.35);
            return (lowMarginQuotes.length > 0 || highFeeQuotes.length > 0) ? (
              <Card className="bg-red-500/5 border-red-500/20">
                <CardContent className="p-4">
                  <p className="text-red-400 font-semibold text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Margin Alerts</p>
                  {lowMarginQuotes.length > 0 && <p className="text-xs text-muted-foreground mt-1">⚠️ {lowMarginQuotes.length} quotes below minimum margin threshold</p>}
                  {highFeeQuotes.length > 0 && <p className="text-xs text-muted-foreground mt-1">⚠️ {highFeeQuotes.length} quotes exceed max platform fee threshold</p>}
                </CardContent>
              </Card>
            ) : null;
          })()}

          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-emerald-400 text-sm uppercase tracking-wider">Commission Breakdown by Photographer</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Photographer</TableHead><TableHead>Tier</TableHead><TableHead>Jobs Done</TableHead>
                    <TableHead>Total Earned</TableHead><TableHead>Platform Fees</TableHead><TableHead>Payout Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {photographers.map(p => {
                    const pJobs = jobs.filter(j => j.photographer_id === p.id && j.status === 'completed');
                    const earned = pJobs.reduce((s, j) => s + ((j.photographer_payout as number) || 0), 0);
                    const fees = pJobs.reduce((s, j) => s + (j.commission_amount || 0), 0);
                    if (pJobs.length === 0) return null;
                    return (
                      <TableRow key={p.id} className="border-[#1e293b]">
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.photographer_tier || 'standard'}</Badge></TableCell>
                        <TableCell className="text-sm">{pJobs.length}</TableCell>
                        <TableCell className="text-sm text-emerald-400">${earned.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-amber-400">${fees.toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={pJobs.some(j => j.payout_status === 'pending') ? 'pending' : 'completed'} /></TableCell>
                      </TableRow>
                    );
                  }).filter(Boolean)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Recruitment Intelligence ═══ */}
        <TabsContent value="recruitment" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={Globe} label="Uncovered Markets" value={coverageZones.filter(z => z.active_photographers_count === 0).length} color="text-amber-400" />
            <KPICard icon={Clock} label="Slow Assignment" value={coverageZones.filter(z => z.avg_time_to_assign > 48).length} sub="Markets >48h" color="text-blue-400" />
            <KPICard icon={Award} label="High-Value Gaps" value={coverageZones.filter(z => z.average_quote_value > 700 && z.active_photographers_count < 2).length} color="text-emerald-400" />
            <KPICard icon={AlertCircle} label="Low Accept Rate" value={scorecards.filter(s => s.acceptance_rate < 60).length} sub="Photographers" color="text-purple-400" />
          </div>

          {/* Priority Recruitment Targets */}
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">🎯 Priority Recruitment Targets</CardTitle></CardHeader>
            <CardContent>
              {coverageZones.filter(z => z.recruitment_priority !== 'low').length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No priority recruitment targets — refresh coverage zones</p>
              ) : (
                <div className="space-y-3">
                  {coverageZones.filter(z => z.recruitment_priority !== 'low').sort((a, b) => {
                    const pri: Record<string, number> = { critical: 3, high: 2, medium: 1 };
                    return (pri[b.recruitment_priority] || 0) - (pri[a.recruitment_priority] || 0);
                  }).map(z => (
                    <div key={z.id} className={`p-4 rounded-lg border ${z.recruitment_priority === 'critical' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{z.city}, {z.state}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {z.active_requests_count} active requests • {z.active_photographers_count} photographers •
                            Avg quote ${z.average_quote_value.toFixed(0)}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-xs ${z.recruitment_priority === 'critical' ? 'text-red-400 border-red-500/30 animate-pulse' : 'text-amber-400 border-amber-500/30'}`}>
                          {z.recruitment_priority} priority
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Churn Risk */}
          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-red-400 text-sm uppercase tracking-wider">⚠️ Photographer Risk Signals</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scorecards.filter(s => s.acceptance_rate < 60 || s.cancellation_rate > 20 || s.quality_score < 3).map(s => {
                  const p = photographers.find(x => x.id === s.photographer_id);
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div>
                        <p className="font-medium text-sm">{p?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          Accept: {s.acceptance_rate}% • Cancel: {s.cancellation_rate}% • Quality: {s.quality_score}/5
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {s.acceptance_rate < 60 && <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">Low Accept</Badge>}
                        {s.cancellation_rate > 20 && <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">High Cancel</Badge>}
                        {s.quality_score < 3 && <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">Low Quality</Badge>}
                      </div>
                    </div>
                  );
                })}
                {scorecards.filter(s => s.acceptance_rate < 60 || s.cancellation_rate > 20 || s.quality_score < 3).length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">No risk signals detected</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: QA ═══ */}
        <TabsContent value="qa" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={Shield} label="Pending QA" value={jobs.filter(j => j.qa_status === 'pending' && j.status === 'completed').length} color="text-amber-400" />
            <KPICard icon={CheckCircle} label="Approved" value={jobs.filter(j => j.qa_status === 'approved').length} color="text-emerald-400" />
            <KPICard icon={RefreshCw} label="Reshoot Needed" value={jobs.filter(j => j.qa_status === 'reshoot').length} color="text-blue-400" />
            <KPICard icon={AlertCircle} label="Failed" value={jobs.filter(j => j.qa_status === 'failed').length} color="text-purple-400" />
          </div>

          <Card className="bg-[#0a0f1a]/80 border-[#1e293b]">
            <CardHeader><CardTitle className="text-amber-400 text-sm uppercase tracking-wider">Quality Assurance Queue</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b]">
                    <TableHead>Photographer</TableHead><TableHead>Venue</TableHead><TableHead>Completed</TableHead>
                    <TableHead>Upload Type</TableHead><TableHead>QA Status</TableHead><TableHead>Notes</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.filter(j => j.status === 'completed').map(job => {
                    const p = photographers.find(x => x.id === job.photographer_id);
                    const req = requests.find(r => r.id === job.request_id);
                    return (
                      <TableRow key={job.id} className="border-[#1e293b]">
                        <TableCell className="font-medium text-sm">{p?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{req?.venue_name || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{job.completed_at ? new Date(job.completed_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-sm">{job.completed_upload_type || 'standard'}</TableCell>
                        <TableCell><StatusBadge status={job.qa_status || 'pending'} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{job.qa_notes || '—'}</TableCell>
                        <TableCell>
                          {(!job.qa_status || job.qa_status === 'pending') && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="text-emerald-400 text-xs h-7" onClick={() => updateQA(job.id, 'approved')}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="text-amber-400 text-xs h-7" onClick={() => {
                                const notes = prompt('Reshoot reason:');
                                if (notes) updateQA(job.id, 'reshoot', notes);
                              }}>Reshoot</Button>
                              <Button size="sm" variant="ghost" className="text-red-400 text-xs h-7" onClick={() => {
                                const notes = prompt('Failure reason:');
                                if (notes) updateQA(job.id, 'failed', notes);
                              }}>Fail</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {jobs.filter(j => j.status === 'completed').length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No completed jobs to review</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Photographer Dialog */}
      <Dialog open={showNewPhotographer} onOpenChange={setShowNewPhotographer}>
        <DialogContent className="bg-[#0a0f1a] border-[#1e293b] max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-emerald-400">Add Photographer</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePhotographer} className="space-y-3">
            <div><Label>Name *</Label><Input name="name" required className="bg-[#0f172a] border-[#1e293b]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input name="phone" className="bg-[#0f172a] border-[#1e293b]" /></div>
              <div><Label>Email</Label><Input name="email" type="email" className="bg-[#0f172a] border-[#1e293b]" /></div>
            </div>
            <div><Label>Service Area</Label><Input name="service_area" placeholder="e.g. Miami, FL" className="bg-[#0f172a] border-[#1e293b]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Lat</Label><Input name="lat" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
              <div><Label>Lng</Label><Input name="lng" type="number" step="any" className="bg-[#0f172a] border-[#1e293b]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Radius (mi)</Label><Input name="radius_miles" type="number" defaultValue={25} className="bg-[#0f172a] border-[#1e293b]" /></div>
              <div>
                <Label>Equipment</Label>
                <select name="equipment_type" className="w-full h-10 rounded-md border border-[#1e293b] bg-[#0f172a] px-3 text-sm text-foreground">
                  <option value="360_camera">360° Camera</option><option value="matterport">Matterport</option><option value="video">Video</option>
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">Add to Network</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
