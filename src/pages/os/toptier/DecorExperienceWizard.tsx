import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LocationAutocomplete } from '@/components/territory/LocationAutocomplete';
import {
  MapPin, Calendar, Clock, ChevronRight, ChevronLeft, Check, Car, Palette,
  Sparkles, User, Package, Star, Navigation, Loader2, PartyPopper
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────
interface WizardState {
  // Step 1: Location
  location: string;
  city: string;
  zip: string;
  eventDate: string;
  timeWindow: string;
  // Step 2: matched data (derived)
  // Step 3: Experience path
  experiencePath: 'byov' | 'full' | '';
  // Step 4: Style
  selectedStyleId: string;
  // Step 5: Designer
  selectedProviderId: string;
  // Step 6: Vehicle
  selectedVehicleId: string;
  externalVehicle: string;
  // Step 7: Add-ons
  selectedAddons: Record<string, number>; // addon_id -> qty
}

const STEPS = [
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'matching', label: 'Available Near You', icon: Navigation },
  { key: 'path', label: 'Experience', icon: Sparkles },
  { key: 'style', label: 'Decor Style', icon: Palette },
  { key: 'designer', label: 'Designer Match', icon: User },
  { key: 'vehicle', label: 'Vehicle', icon: Car },
  { key: 'addons', label: 'Add-Ons', icon: Package },
  { key: 'summary', label: 'Summary', icon: Check },
];

const TIME_WINDOWS = ['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–9pm)', 'Late Night (9pm+)'];

// ─── Utility: extract city from location string ─────────
function extractCity(loc: string): string {
  const parts = loc.split(',').map(s => s.trim());
  // Typically "City, State, Country" or "Addr, City, State ZIP, Country"
  if (parts.length >= 2) return parts[parts.length >= 3 ? parts.length - 3 : 0];
  return loc;
}

// ─── Component ──────────────────────────────────────────
export default function DecorExperienceWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    location: '', city: '', zip: '', eventDate: '', timeWindow: '',
    experiencePath: '', selectedStyleId: '', selectedProviderId: '',
    selectedVehicleId: '', externalVehicle: '',
    selectedAddons: {},
  });

  const derivedCity = useMemo(() => {
    if (state.city) return state.city;
    if (state.location) return extractCity(state.location);
    return '';
  }, [state.city, state.location]);

  const hasLocation = !!(state.location || state.city || state.zip);

  // ─── Data Queries ──────────────────────────────────────
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['decor-providers-match', derivedCity],
    queryFn: async () => {
      if (!derivedCity) return [];
      const { data } = await supabase
        .from('decor_providers')
        .select('*')
        .eq('is_active', true)
        .ilike('city', `%${derivedCity}%`);
      return data || [];
    },
    enabled: hasLocation,
  });

  const { data: allStyles = [] } = useQuery({
    queryKey: ['decor-styles-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicle_decor_styles')
        .select('*')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({
    queryKey: ['fleet-vehicles-decor', derivedCity],
    queryFn: async () => {
      if (!derivedCity) return [];
      const { data } = await supabase
        .from('fleet_vehicles')
        .select('*')
        .eq('is_active', true)
        .eq('available_for_decor', true)
        .ilike('city', `%${derivedCity}%`);
      return data || [];
    },
    enabled: hasLocation,
  });

  const { data: addons = [] } = useQuery({
    queryKey: ['experience-addons-decor'],
    queryFn: async () => {
      const { data } = await supabase
        .from('experience_addons')
        .select('*, experience_addon_categories(name)')
        .eq('is_active', true)
        .order('name');
      return (data || []).filter((a: any) => {
        const catName = (a.experience_addon_categories?.name || '').toLowerCase();
        // Only show decor-relevant categories
        return ['decor', 'photography', 'vehicle', 'vip'].some(k => catName.includes(k))
          || !catName; // include uncategorized
      });
    },
  });

  // ─── Derived ───────────────────────────────────────────
  const selectedProvider = providers.find((p: any) => p.id === state.selectedProviderId);
  const selectedStyle = allStyles.find((s: any) => s.id === state.selectedStyleId);
  const selectedVehicle = vehicles.find((v: any) => v.id === state.selectedVehicleId);

  const addonTotal = useMemo(() => {
    return Object.entries(state.selectedAddons).reduce((sum, [id, qty]) => {
      const addon = addons.find((a: any) => a.id === id);
      return sum + (addon ? Number(addon.price) * qty : 0);
    }, 0);
  }, [state.selectedAddons, addons]);

  const grandTotal = useMemo(() => {
    let t = 0;
    if (selectedStyle) t += Number(selectedStyle.base_price || 0);
    if (selectedVehicle) t += Number(selectedVehicle.decor_price_override || selectedVehicle.hourly_rate || 0);
    t += addonTotal;
    return t;
  }, [selectedStyle, selectedVehicle, addonTotal]);

  // ─── Navigation ────────────────────────────────────────
  const canNext = (): boolean => {
    switch (step) {
      case 0: return hasLocation;
      case 1: return true; // info step
      case 2: return !!state.experiencePath;
      case 3: return !!state.selectedStyleId;
      case 4: return !!state.selectedProviderId;
      case 5: return state.experiencePath === 'byov' ? !!state.externalVehicle : !!state.selectedVehicleId;
      case 6: return true;
      default: return true;
    }
  };

  const next = () => { if (canNext() && step < STEPS.length - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  const update = (partial: Partial<WizardState>) => setState(prev => ({ ...prev, ...partial }));

  // ─── Step Renderers ────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return <StepLocation state={state} update={update} />;
      case 1: return <StepMatching providers={providers} vehicles={vehicles} loading={loadingProviders || loadingVehicles} city={derivedCity} />;
      case 2: return <StepPath state={state} update={update} vehicles={vehicles} providers={providers} />;
      case 3: return <StepStyle styles={allStyles} state={state} update={update} />;
      case 4: return <StepDesigner providers={providers} state={state} update={update} city={derivedCity} />;
      case 5: return <StepVehicle vehicles={vehicles} state={state} update={update} />;
      case 6: return <StepAddons addons={addons} state={state} update={update} />;
      case 7: return (
        <StepSummary
          state={state}
          provider={selectedProvider}
          style={selectedStyle}
          vehicle={selectedVehicle}
          addons={addons}
          total={grandTotal}
        />
      );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#C9A84C]">Vehicle Decor Experience</h1>
        <p className="text-sm text-muted-foreground">Build your custom decor package — location-matched & coordinated</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={s.key}
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                isActive ? 'bg-primary text-primary-foreground' :
                isDone ? 'bg-primary/20 text-primary cursor-pointer' :
                'bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
              {isDone && <Check className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6 min-h-[300px]">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prev} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canNext()}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button className="bg-[#C9A84C] hover:bg-[#b8973e] text-black">
            <Check className="h-4 w-4 mr-1" /> Confirm Booking
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── STEP 1: Location ───────────────────────────────────
function StepLocation({ state, update }: { state: WizardState; update: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" /> Where is your experience?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">We'll match decorators, vehicles, and services available in your area.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Address or City</Label>
          <LocationAutocomplete
            value={state.location}
            onChange={v => update({ location: v, city: extractCity(v) })}
            placeholder="Start typing an address or city…"
          />
        </div>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>City</Label>
            <Input value={state.city} onChange={e => update({ city: e.target.value })} placeholder="e.g. Miami" />
          </div>
          <div>
            <Label>Zip Code</Label>
            <Input value={state.zip} onChange={e => update({ zip: e.target.value })} placeholder="e.g. 33101" />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Event Date</Label>
            <Input type="date" value={state.eventDate} onChange={e => update({ eventDate: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Time Window</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={state.timeWindow}
              onChange={e => update({ timeWindow: e.target.value })}
            >
              <option value="">Select…</option>
              {TIME_WINDOWS.map(tw => <option key={tw} value={tw}>{tw}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── STEP 2: Matching ───────────────────────────────────
function StepMatching({ providers, vehicles, loading, city }: { providers: any[]; vehicles: any[]; loading: boolean; city: string }) {
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Finding services near {city}…</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" /> Available in Your Area
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          We found the following services near <span className="font-medium text-foreground">{city}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Palette className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{providers.length}</p>
            <p className="text-xs text-muted-foreground">Decorators</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Car className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{vehicles.length}</p>
            <p className="text-xs text-muted-foreground">Vehicles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Check className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-500">Ready to Book</p>
            <p className="text-xs text-muted-foreground">All services matched</p>
          </CardContent>
        </Card>
      </div>

      {providers.length === 0 && vehicles.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <p>No services found in this area yet. Try a different city or expand your search.</p>
        </div>
      )}
    </div>
  );
}

// ─── STEP 3: Experience Path ────────────────────────────
function StepPath({ state, update, vehicles, providers }: { state: WizardState; update: (p: Partial<WizardState>) => void; vehicles: any[]; providers: any[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Choose Your Experience
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Select how you'd like your vehicle decorated.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          className={`text-left p-5 rounded-lg border-2 transition-all ${
            state.experiencePath === 'byov'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => update({ experiencePath: 'byov', selectedVehicleId: '' })}
        >
          <Car className="h-8 w-8 mb-3 text-primary" />
          <h3 className="font-semibold">Bring Your Own Vehicle</h3>
          <p className="text-sm text-muted-foreground mt-1">We'll decorate your personal vehicle. Our decorator comes to you.</p>
          <Badge variant="outline" className="mt-3">{providers.length} decorators available</Badge>
        </button>

        <button
          className={`text-left p-5 rounded-lg border-2 transition-all ${
            state.experiencePath === 'full'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => update({ experiencePath: 'full', externalVehicle: '' })}
        >
          <PartyPopper className="h-8 w-8 mb-3 text-primary" />
          <h3 className="font-semibold">Full Experience Package</h3>
          <p className="text-sm text-muted-foreground mt-1">Select from our decorated fleet — vehicle + decor + driver included.</p>
          <Badge variant="outline" className="mt-3">{vehicles.length} vehicles available</Badge>
        </button>
      </div>
    </div>
  );
}

// ─── STEP 4: Decor Style ────────────────────────────────
function StepStyle({ styles, state, update }: { styles: any[]; state: WizardState; update: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" /> Choose Your Decor Style
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Select a transformation theme.</p>
      </div>

      {styles.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No styles available at this time.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {styles.map((s: any) => (
            <button
              key={s.id}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                state.selectedStyleId === s.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => update({ selectedStyleId: s.id })}
            >
              <h3 className="font-medium">{s.name}</h3>
              {s.category && <Badge variant="secondary" className="mt-1 text-[10px]">{s.category}</Badge>}
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.description || 'Classic decor style'}</p>
              <p className="text-primary font-semibold mt-2">${Number(s.base_price || 0).toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STEP 5: Designer Match ─────────────────────────────
function StepDesigner({ providers, state, update, city }: { providers: any[]; state: WizardState; update: (p: Partial<WizardState>) => void; city: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> Select Your Decorator
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Matched decorators in {city}</p>
      </div>

      {providers.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No decorators found in this area.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {providers.map((p: any) => (
            <button
              key={p.id}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                state.selectedProviderId === p.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => update({ selectedProviderId: p.id })}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {p.city}
                  </p>
                </div>
                {p.rating && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                    <Star className="h-3 w-3 mr-0.5 fill-amber-500" /> {Number(p.rating).toFixed(1)}
                  </Badge>
                )}
              </div>
              {p.specialties?.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {p.specialties.slice(0, 3).map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              )}
              {p.price_range && <p className="text-xs text-muted-foreground mt-2">{p.price_range}</p>}
              {p.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.bio}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STEP 6: Vehicle ────────────────────────────────────
function StepVehicle({ vehicles, state, update }: { vehicles: any[]; state: WizardState; update: (p: Partial<WizardState>) => void }) {
  if (state.experiencePath === 'byov') {
    return (
      <div className="space-y-5 max-w-lg">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" /> Your Vehicle Details
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Tell us about the vehicle we'll be decorating.</p>
        </div>
        <div>
          <Label>Vehicle Description</Label>
          <Input
            value={state.externalVehicle}
            onChange={e => update({ externalVehicle: e.target.value })}
            placeholder="e.g. 2024 Mercedes S-Class, White"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" /> Select Your Vehicle
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Decor-ready vehicles available in your area.</p>
      </div>

      {vehicles.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No decor-ready vehicles in this area.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.map((v: any) => (
            <button
              key={v.id}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                state.selectedVehicleId === v.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => update({ selectedVehicleId: v.id })}
            >
              <h3 className="font-medium">{v.name}</h3>
              <div className="flex gap-1 mt-1">
                <Badge variant="secondary" className="text-[10px] capitalize">{v.category}</Badge>
                <Badge variant="outline" className="text-[10px]">{v.capacity} seats</Badge>
              </div>
              {v.decor_tags?.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {v.decor_tags.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px] capitalize text-primary border-primary/30">{t}</Badge>
                  ))}
                </div>
              )}
              <p className="text-primary font-semibold mt-2">
                ${Number(v.decor_price_override || v.hourly_rate || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" /> {v.city}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STEP 7: Add-Ons ────────────────────────────────────
function StepAddons({ addons, state, update }: { addons: any[]; state: WizardState; update: (p: Partial<WizardState>) => void }) {
  const toggle = (id: string) => {
    const current = { ...state.selectedAddons };
    if (current[id]) { delete current[id]; }
    else { current[id] = 1; }
    update({ selectedAddons: current });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Experience Add-Ons
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Enhance your decor experience with these optional upgrades.</p>
      </div>

      {addons.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No add-ons available for this experience.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addons.map((a: any) => {
            const selected = !!state.selectedAddons[a.id];
            return (
              <button
                key={a.id}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggle(a.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{a.name}</h3>
                    <Badge variant="secondary" className="text-[10px] mt-1 capitalize">{a.type}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-primary font-semibold">${Number(a.price).toLocaleString()}</p>
                    {selected && <Check className="h-4 w-4 text-primary ml-auto mt-1" />}
                  </div>
                </div>
                {a.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.description}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── STEP 8: Summary ────────────────────────────────────
function StepSummary({ state, provider, style, vehicle, addons, total }: {
  state: WizardState; provider: any; style: any; vehicle: any; addons: any[]; total: number;
}) {
  const selectedAddonItems = addons.filter((a: any) => state.selectedAddons[a.id]);

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Check className="h-5 w-5 text-primary" /> Booking Summary
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Review your coordinated decor experience.</p>
      </div>

      <div className="space-y-3">
        <SummaryRow label="Location" value={state.location || state.city || state.zip} icon={<MapPin className="h-4 w-4" />} />
        {state.eventDate && <SummaryRow label="Date" value={format(new Date(state.eventDate), 'MMM d, yyyy')} icon={<Calendar className="h-4 w-4" />} />}
        {state.timeWindow && <SummaryRow label="Time" value={state.timeWindow} icon={<Clock className="h-4 w-4" />} />}

        <Separator />

        <SummaryRow label="Experience" value={state.experiencePath === 'byov' ? 'Bring Your Own Vehicle' : 'Full Package'} icon={<Sparkles className="h-4 w-4" />} />
        {style && <SummaryRow label="Decor Style" value={`${style.name} — $${Number(style.base_price).toLocaleString()}`} icon={<Palette className="h-4 w-4" />} />}
        {provider && <SummaryRow label="Decorator" value={provider.name} icon={<User className="h-4 w-4" />} />}
        {vehicle && <SummaryRow label="Vehicle" value={`${vehicle.name} — $${Number(vehicle.decor_price_override || vehicle.hourly_rate).toLocaleString()}`} icon={<Car className="h-4 w-4" />} />}
        {state.externalVehicle && <SummaryRow label="Your Vehicle" value={state.externalVehicle} icon={<Car className="h-4 w-4" />} />}

        {selectedAddonItems.length > 0 && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add-Ons</p>
            {selectedAddonItems.map((a: any) => (
              <SummaryRow key={a.id} label={a.name} value={`$${Number(a.price).toLocaleString()}`} icon={<Package className="h-4 w-4" />} />
            ))}
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold text-primary">${total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground flex items-center gap-2">{icon} {label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
