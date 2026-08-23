import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Car, CheckCircle, AlertTriangle, X, Check, Pencil, UserPlus, Users } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface Vehicle {
  id: string;
  name: string;
  category: string;
  photo_url?: string;
  base_rate?: number;
  daily_rate?: number;
  partner_id?: string;
  partner_name?: string;
  partner_phone?: string;
  dispatch_phone?: string;
  dispatch_notes?: string;
  auto_dispatch?: boolean;
  is_active?: boolean;
  is_available?: boolean;
  response_time_minutes?: number;
  backup_partner_id?: string;
  deposit_amount?: number;
}

interface PartnerOption {
  id: string;
  name: string;
  type: string;
  phone?: string;
}

function KPICard({ label, value, color = 'text-[#C9A84C]' }: { label: string; value: number; color?: string }) {
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardContent className="p-4">
        <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function TTFleet() {
  const qc = useQueryClient();
  const location = useLocation();
  // Path-aware split: /os/toptier/fleet = vehicles, /os/toptier/drivers = partner roster
  const isDrivers = location.pathname.includes('/drivers');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Form state for assign modal
  const [formPartnerId, setFormPartnerId] = useState('');
  const [formPartnerName, setFormPartnerName] = useState('');
  const [formDispatchPhone, setFormDispatchPhone] = useState('');
  const [formBackupId, setFormBackupId] = useState('');
  const [formAutoDispatch, setFormAutoDispatch] = useState(true);
  const [formResponseTime, setFormResponseTime] = useState('30');
  const [formDispatchNotes, setFormDispatchNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch vehicles from public site via proxy
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: async () => {
      const response = await supabase.functions.invoke('proxy-public-data', {
        body: { action: 'get_vehicles_with_partners' },
      });
      return (response.data?.data || []) as Vehicle[];
    },
    refetchInterval: 60000,
  });

  // Fetch partner options for dropdown
  const { data: partnerOptions = [] } = useQuery({
    queryKey: ['fleet-partner-options'],
    queryFn: async () => {
      // Local tt_partner_assets
      const { data: local } = await supabase
        .from('tt_partner_assets')
        .select('id, partner_name, partner_type, partner_phone')
        .order('partner_name');
      const localOpts: PartnerOption[] = (local || []).map((p: any) => ({
        id: p.id,
        name: p.partner_name,
        type: p.partner_type,
        phone: p.partner_phone,
      }));

      // Public site partners
      try {
        const res = await supabase.functions.invoke('proxy-public-data', {
          body: { table: 'partners', select: 'id,business_name,partner_type,phone', filters: { status: 'eq.approved', is_active: 'eq.true' } },
        });
        const pub = (res.data?.data || res.data || []) as any[];
        const pubOpts: PartnerOption[] = pub.map((p: any) => ({
          id: p.id,
          name: p.business_name,
          type: p.partner_type || 'partner',
          phone: p.phone,
        }));
        // Deduplicate by id
        const seen = new Set(localOpts.map(o => o.id));
        return [...localOpts, ...pubOpts.filter(o => !seen.has(o.id))];
      } catch {
        return localOpts;
      }
    },
  });

  // Drivers view: local tt_partners roster (40 rows) — only fetched on /os/toptier/drivers
  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['tt-drivers-roster'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tt_partners')
        .select('id, name, business_name, phone, email, service_category, partner_type, status, is_active, trust_score, total_bookings, total_earnings, last_active_at, city, state')
        .order('name');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isDrivers,
  });

  // Metrics
  const totalVehicles = vehicles.length;
  const assigned = vehicles.filter(v => v.partner_id).length;
  const unassigned = vehicles.filter(v => !v.partner_id).length;
  const available = vehicles.filter(v => v.is_available !== false).length;

  // Sort: unassigned first, then by name
  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      if (!a.partner_id && b.partner_id) return -1;
      if (a.partner_id && !b.partner_id) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [vehicles]);

  const openModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormPartnerId(vehicle.partner_id || '');
    setFormPartnerName(vehicle.partner_name || '');
    setFormDispatchPhone(vehicle.dispatch_phone || vehicle.partner_phone || '');
    setFormBackupId(vehicle.backup_partner_id || '');
    setFormAutoDispatch(vehicle.auto_dispatch !== false);
    setFormResponseTime(String(vehicle.response_time_minutes || 30));
    setFormDispatchNotes(vehicle.dispatch_notes || '');
    setModalOpen(true);
  };

  const handlePartnerSelect = (partnerId: string) => {
    setFormPartnerId(partnerId);
    const partner = partnerOptions.find(p => p.id === partnerId);
    if (partner) {
      setFormPartnerName(partner.name);
      if (partner.phone) setFormDispatchPhone(partner.phone);
    }
  };

  const handleSave = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('proxy-public-data', {
        body: {
          action: 'update_vehicle_partner',
          vehicle_id: selectedVehicle.id,
          partner_id: formPartnerId || null,
          partner_name: formPartnerName || null,
          dispatch_phone: formDispatchPhone || null,
          backup_partner_id: formBackupId || null,
          auto_dispatch: formAutoDispatch,
          response_time_minutes: parseInt(formResponseTime) || 30,
          dispatch_notes: formDispatchNotes || null,
        },
      });
      if (response.error) throw new Error(response.error.message);
      toast.success(`Partner assigned to ${selectedVehicle.name}`);
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ─── Drivers view (/os/toptier/drivers) ───────────────────────────────────
  if (isDrivers) {
    const activeDrivers = drivers.filter((d: any) => d.is_active !== false).length;
    const avgTrust = drivers.length
      ? Math.round(drivers.reduce((s: number, d: any) => s + (d.trust_score || 0), 0) / drivers.length)
      : 0;
    const totalBookings = drivers.reduce((s: number, d: any) => s + (d.total_bookings || 0), 0);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Drivers & Partners</h1>
          <p className="text-white/40 text-sm">TopTier partner and driver roster</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Total Partners" value={drivers.length} />
          <KPICard label="Active" value={activeDrivers} color="text-emerald-400" />
          <KPICard label="Avg Trust Score" value={avgTrust} color="text-emerald-400" />
          <KPICard label="Total Bookings" value={totalBookings} />
        </div>

        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/40">Partner</TableHead>
                <TableHead className="text-white/40">Category</TableHead>
                <TableHead className="text-white/40">Phone</TableHead>
                <TableHead className="text-white/40">Location</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Trust</TableHead>
                <TableHead className="text-white/40">Bookings</TableHead>
                <TableHead className="text-white/40">Earnings</TableHead>
                <TableHead className="text-white/40">Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-white/5">
              {driversLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-white/40 py-12">Loading roster...</TableCell>
                </TableRow>
              ) : drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-white/40 py-12">No partners found.</TableCell>
                </TableRow>
              ) : (
                drivers.map((d: any) => (
                  <TableRow key={d.id} className="border-white/5">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-white/30" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{d.name || d.business_name || 'Unnamed'}</p>
                          {d.business_name && d.name && (
                            <p className="text-white/40 text-xs">{d.business_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-white/5 text-white/60 text-[10px]">
                        {d.service_category || d.partner_type || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/60 text-sm">{d.phone || '—'}</TableCell>
                    <TableCell className="text-white/60 text-sm">
                      {[d.city, d.state].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      {d.is_active !== false ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400">{d.status || 'active'}</Badge>
                      ) : (
                        <Badge className="bg-white/10 text-white/40">inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[#C9A84C] font-bold">{d.trust_score ?? '—'}</TableCell>
                    <TableCell className="text-white/60 text-sm">{d.total_bookings ?? 0}</TableCell>
                    <TableCell className="text-white/60 text-sm">
                      {d.total_earnings ? `$${Number(d.total_earnings).toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className="text-white/40 text-xs">
                      {d.last_active_at ? new Date(d.last_active_at).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  // ─── Fleet view (/os/toptier/fleet) ───────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fleet Management</h1>
        <p className="text-white/40 text-sm">Vehicle inventory with partner assignments</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Total Vehicles" value={totalVehicles} />
        <KPICard label="Assigned" value={assigned} color="text-emerald-400" />
        <KPICard label="Unassigned" value={unassigned} color={unassigned > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <KPICard label="Available" value={available} color="text-emerald-400" />
      </div>

      {/* Unassigned warning */}
      {unassigned > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-red-400 text-sm font-medium">
            ⚠️ {unassigned} vehicle{unassigned > 1 ? 's have' : ' has'} no partner. Bookings cannot be auto-dispatched.
          </p>
        </div>
      )}

      {/* Fleet Table */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-white/40">Photo</TableHead>
              <TableHead className="text-white/40">Vehicle</TableHead>
              <TableHead className="text-white/40">Category</TableHead>
              <TableHead className="text-white/40">Daily Rate</TableHead>
              <TableHead className="text-white/40">Partner</TableHead>
              <TableHead className="text-white/40">Dispatch Phone</TableHead>
              <TableHead className="text-white/40">Auto</TableHead>
              <TableHead className="text-white/40">Available</TableHead>
              <TableHead className="text-white/40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/5">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-white/40 py-12">Loading fleet...</TableCell>
              </TableRow>
            ) : sortedVehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-white/40 py-12">No vehicles found.</TableCell>
              </TableRow>
            ) : (
              sortedVehicles.map((v) => (
                <TableRow key={v.id} className={`border-white/5 ${!v.partner_id ? 'bg-red-500/[0.03]' : ''}`}>
                  {/* Photo */}
                  <TableCell>
                    {v.photo_url ? (
                      <img src={v.photo_url} alt={v.name} className="w-16 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-10 bg-white/5 rounded flex items-center justify-center">
                        <Car className="h-4 w-4 text-white/20" />
                      </div>
                    )}
                  </TableCell>
                  {/* Vehicle name */}
                  <TableCell className="text-white font-medium text-sm">{v.name || 'Unnamed'}</TableCell>
                  {/* Category */}
                  <TableCell>
                    <Badge className="bg-white/5 text-white/60 text-[10px]">{v.category || '—'}</Badge>
                  </TableCell>
                  {/* Daily Rate */}
                  <TableCell className="text-[#C9A84C] font-bold">
                    {v.daily_rate || v.base_rate ? `$${Number(v.daily_rate || v.base_rate || 0).toLocaleString()}` : '—'}
                  </TableCell>
                  {/* Partner */}
                  <TableCell>
                    {v.partner_id ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400">{v.partner_name || 'Assigned'}</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400">⚠️ Unassigned</Badge>
                    )}
                  </TableCell>
                  {/* Dispatch Phone */}
                  <TableCell className="text-white/60 text-sm">{v.dispatch_phone || v.partner_phone || '—'}</TableCell>
                  {/* Auto */}
                  <TableCell>
                    {v.auto_dispatch ? (
                      <div className="flex items-center gap-1">
                        <Check className="h-4 w-4 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <X className="h-4 w-4 text-red-400" />
                        <span className="text-red-400 text-xs">Manual</span>
                      </div>
                    )}
                  </TableCell>
                  {/* Available */}
                  <TableCell>
                    <div className={`h-3 w-3 rounded-full ${v.is_available !== false ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  </TableCell>
                  {/* Actions */}
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-7 text-xs ${v.partner_id ? 'text-[#C9A84C]' : 'text-red-400'}`}
                      onClick={() => openModal(v)}
                    >
                      {v.partner_id ? (
                        <><Pencil className="h-3 w-3 mr-1" />Edit</>
                      ) : (
                        <><UserPlus className="h-3 w-3 mr-1" />Assign Partner</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Assign Partner Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">
              {selectedVehicle?.partner_id ? 'Edit Partner Assignment' : 'Assign Partner'}
            </DialogTitle>
            <DialogDescription className="text-white/40">
              Configure dispatch partner for this vehicle
            </DialogDescription>
          </DialogHeader>

          {selectedVehicle && (
            <div className="space-y-4">
              {/* Vehicle info */}
              <div className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg">
                {selectedVehicle.photo_url ? (
                  <img src={selectedVehicle.photo_url} alt={selectedVehicle.name} className="w-20 h-14 object-cover rounded" />
                ) : (
                  <div className="w-20 h-14 bg-white/5 rounded flex items-center justify-center">
                    <Car className="h-6 w-6 text-white/20" />
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{selectedVehicle.name}</p>
                  <p className="text-white/40 text-xs">{selectedVehicle.category}</p>
                </div>
              </div>

              {selectedVehicle.partner_name && (
                <div className="text-sm text-white/50">
                  Current partner: <span className="text-emerald-400">{selectedVehicle.partner_name}</span>
                </div>
              )}

              {/* Partner selector */}
              <div>
                <Label className="text-white/60">Partner</Label>
                <Select value={formPartnerId} onValueChange={handlePartnerSelect}>
                  <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white">
                    <SelectValue placeholder="Select a partner..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-white/10 max-h-60">
                    {partnerOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-white">
                        {p.name} <span className="text-white/40 ml-1">({p.type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Partner name */}
              <div>
                <Label className="text-white/60">Partner Name</Label>
                <Input
                  className="bg-[#0A0A0A] border-white/10 text-white"
                  value={formPartnerName}
                  onChange={(e) => setFormPartnerName(e.target.value)}
                />
              </div>

              {/* Dispatch phone */}
              <div>
                <Label className="text-white/60">Dispatch Phone</Label>
                <Input
                  className="bg-[#0A0A0A] border-white/10 text-white"
                  value={formDispatchPhone}
                  onChange={(e) => setFormDispatchPhone(e.target.value)}
                  placeholder="+1..."
                />
              </div>

              {/* Backup partner */}
              <div>
                <Label className="text-white/60">Backup Partner (optional)</Label>
                <Select value={formBackupId} onValueChange={setFormBackupId}>
                  <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-white/10 max-h-60">
                    <SelectItem value="none" className="text-white/40">None</SelectItem>
                    {partnerOptions.filter(p => p.id !== formPartnerId).map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-white">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-dispatch toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-white/60">Auto-Dispatch</Label>
                <Switch checked={formAutoDispatch} onCheckedChange={setFormAutoDispatch} />
              </div>

              {/* Response time */}
              <div>
                <Label className="text-white/60">Response Time Window</Label>
                <Select value={formResponseTime} onValueChange={setFormResponseTime}>
                  <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-white/10">
                    <SelectItem value="15" className="text-white">15 minutes</SelectItem>
                    <SelectItem value="30" className="text-white">30 minutes</SelectItem>
                    <SelectItem value="60" className="text-white">60 minutes</SelectItem>
                    <SelectItem value="120" className="text-white">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dispatch notes */}
              <div>
                <Label className="text-white/60">Dispatch Notes</Label>
                <Textarea
                  className="bg-[#0A0A0A] border-white/10 text-white"
                  value={formDispatchNotes}
                  onChange={(e) => setFormDispatchNotes(e.target.value)}
                  placeholder="Special instructions for this vehicle's dispatch..."
                  rows={3}
                />
              </div>

              {/* Save */}
              <Button
                className="w-full bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Partner Assignment'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
