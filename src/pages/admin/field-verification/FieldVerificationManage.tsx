import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Settings, Plus, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  verifiedInsert, verifiedUpdate, mutationErrorMessage,
} from '@/lib/verifiedMutation';
import {
  useCrewProfiles, useCrewZones, type CrewProfileRow, type CrewZoneRow,
} from '@/hooks/useFieldVerification';

const CREW_ROLE = 'verification_crew';
const STATUSES = ['active', 'paused', 'inactive'] as const;

interface CrewRoleHolder {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Everyone holding the verification_crew role, with their display info pulled
 * from `profiles` — the same two-query pattern used by useUserRolesAdmin,
 * because there is no FK between user_roles and profiles.
 */
function useCrewRoleHolders() {
  return useQuery({
    queryKey: ['fv-crew-role-holders'],
    queryFn: async (): Promise<CrewRoleHolder[]> => {
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', CREW_ROLE as never);
      if (rolesErr) throw rolesErr;

      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, email, phone')
        .in('id', ids);
      if (profErr) throw profErr;

      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return ids.map((id) => {
        const p = map.get(id);
        return {
          user_id: id,
          name: p?.name ?? null,
          email: p?.email ?? null,
          phone: p?.phone ?? null,
        };
      });
    },
  });
}

function displayName(h: CrewRoleHolder) {
  return h.name || h.email || `User ${h.user_id.slice(0, 8)}…`;
}

// ─── Zones ──────────────────────────────────────────────────────────────────

function ZoneRow({ zone, onSaved }: { zone: CrewZoneRow; onSaved: () => void }) {
  const [name, setName] = useState(zone.name ?? '');
  const [city, setCity] = useState(zone.city ?? '');
  const [state, setState] = useState(zone.state ?? '');
  const [target, setTarget] = useState(String(zone.target_drops ?? 0));
  const [active, setActive] = useState(zone.is_active !== false);
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== (zone.name ?? '') ||
    city !== (zone.city ?? '') ||
    state !== (zone.state ?? '') ||
    target !== String(zone.target_drops ?? 0) ||
    active !== (zone.is_active !== false);

  const save = async () => {
    setSaving(true);
    try {
      await verifiedUpdate('update zone', () =>
        supabase
          .from('crew_zones')
          .update({
            name: name.trim(),
            city: city.trim() || null,
            state: state.trim() || null,
            target_drops: Number(target) || 0,
            is_active: active,
          })
          .eq('id', zone.id),
      );
      toast.success('Zone updated');
      onSaved();
    } catch (e) {
      toast.error(mutationErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_80px_100px_auto_auto] items-center border-b border-border py-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zone name" />
      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
      <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="ST" />
      <Input
        type="number" min={0} value={target}
        onChange={(e) => setTarget(e.target.value)} placeholder="Target"
      />
      <div className="flex items-center gap-2">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">{active ? 'Active' : 'Inactive'}</span>
      </div>
      <Button size="sm" disabled={!dirty || saving || !name.trim()} onClick={save}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function AddZoneForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [target, setTarget] = useState('0');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    try {
      await verifiedInsert('create zone', () =>
        supabase.from('crew_zones').insert({
          name: name.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          target_drops: Number(target) || 0,
          is_active: active,
        }),
      );
      toast.success('Zone created');
      setName(''); setCity(''); setState(''); setTarget('0'); setActive(true);
      onSaved();
    } catch (e) {
      toast.error(mutationErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_80px_100px_auto_auto] items-end">
      <div className="space-y-1">
        <Label className="text-xs">Zone name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bushwick North" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">City</Label>
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Brooklyn" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">State</Label>
        <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Target drops</Label>
        <Input type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">Active</span>
      </div>
      <Button disabled={!name.trim() || saving} onClick={add}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
        Add zone
      </Button>
    </div>
  );
}

// ─── Crew roster ────────────────────────────────────────────────────────────

function SetupRow({
  holder, zones, onSaved,
}: { holder: CrewRoleHolder; zones: CrewZoneRow[]; onSaved: () => void }) {
  const [fullName, setFullName] = useState(holder.name ?? '');
  const [phone, setPhone] = useState(holder.phone ?? '');
  const [zoneId, setZoneId] = useState<string>('');
  const [rate, setRate] = useState('0');
  const [status, setStatus] = useState<string>('active');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    try {
      await verifiedInsert('set up crew member', () =>
        supabase.from('crew_profiles').insert({
          user_id: holder.user_id,
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          zone_id: zoneId || null,
          rate_per_drop: Number(rate) || 0,
          status,
        }),
      );
      toast.success('Crew member set up');
      onSaved();
    } catch (e) {
      toast.error(mutationErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">{displayName(holder)}</p>
          {holder.email && <p className="text-xs text-muted-foreground">{holder.email}</p>}
        </div>
        <Badge variant="secondary">Needs setup</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1.2fr_110px_130px_auto] items-end">
        <div className="space-y-1">
          <Label className="text-xs">Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Zone</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name || 'Unnamed zone'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rate / drop</Label>
          <Input type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={saving} onClick={create}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
          Set up
        </Button>
      </div>
    </div>
  );
}

function RosterRow({
  profile, zones, holder, onSaved,
}: {
  profile: CrewProfileRow;
  zones: CrewZoneRow[];
  holder?: CrewRoleHolder;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [zoneId, setZoneId] = useState(profile.zone_id ?? '');
  const [rate, setRate] = useState(String(profile.rate_per_drop ?? 0));
  const [status, setStatus] = useState(profile.status ?? 'active');
  const [saving, setSaving] = useState(false);

  const dirty =
    fullName !== (profile.full_name ?? '') ||
    phone !== (profile.phone ?? '') ||
    zoneId !== (profile.zone_id ?? '') ||
    rate !== String(profile.rate_per_drop ?? 0) ||
    status !== (profile.status ?? 'active');

  const save = async () => {
    setSaving(true);
    try {
      await verifiedUpdate('update crew member', () =>
        supabase
          .from('crew_profiles')
          .update({
            full_name: fullName.trim() || null,
            phone: phone.trim() || null,
            zone_id: zoneId || null,
            rate_per_drop: Number(rate) || 0,
            status,
          })
          .eq('id', profile.id),
      );
      toast.success('Crew member updated');
      onSaved();
    } catch (e) {
      toast.error(mutationErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {holder?.email || `User ${profile.user_id.slice(0, 8)}…`}
        </p>
        {!holder && <Badge variant="destructive">Role removed</Badge>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1.2fr_110px_130px_auto] items-end">
        <div className="space-y-1">
          <Label className="text-xs">Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Zone</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger><SelectValue placeholder="No zone" /></SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name || 'Unnamed zone'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rate / drop</Label>
          <Input type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function FieldVerificationManage() {
  const qc = useQueryClient();
  const zonesQ = useCrewZones();
  const profilesQ = useCrewProfiles();
  const holdersQ = useCrewRoleHolders();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['fv-crew-zones'] });
    qc.invalidateQueries({ queryKey: ['fv-crew-profiles'] });
    qc.invalidateQueries({ queryKey: ['fv-crew-role-holders'] });
  };

  const zones = zonesQ.data ?? [];
  const profiles = profilesQ.data ?? [];
  const holders = holdersQ.data ?? [];

  const profileByUser = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p])),
    [profiles],
  );
  const holderByUser = useMemo(
    () => new Map(holders.map((h) => [h.user_id, h])),
    [holders],
  );
  const needsSetup = holders.filter((h) => !profileByUser.has(h.user_id));

  const loading = zonesQ.isLoading || profilesQ.isLoading || holdersQ.isLoading;
  const error = zonesQ.error || profilesQ.error || holdersQ.error;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Manage Crew &amp; Zones
        </h1>
        <p className="text-sm text-muted-foreground">
          Create zones and finish setting up crew members after they accept their invite.
        </p>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent></Card>
      )}
      {loading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!loading && !error && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Zones</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <AddZoneForm onSaved={refresh} />
              <div className="pt-2">
                {zones.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No zones yet — add the first one above.
                  </p>
                ) : (
                  zones.map((z) => <ZoneRow key={z.id} zone={z} onSaved={refresh} />)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Needs setup
                {needsSetup.length > 0 && <Badge variant="secondary">{needsSetup.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {needsSetup.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Everyone with the field verification role has a crew record.
                </p>
              ) : (
                needsSetup.map((h) => (
                  <SetupRow key={h.user_id} holder={h} zones={zones} onSaved={refresh} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Active roster
                {profiles.length > 0 && <Badge variant="secondary">{profiles.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No crew members set up yet.</p>
              ) : (
                profiles.map((p) => (
                  <RosterRow
                    key={p.id}
                    profile={p}
                    zones={zones}
                    holder={holderByUser.get(p.user_id)}
                    onSaved={refresh}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
