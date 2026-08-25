import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import statesTopo from 'us-atlas/states-10m.json';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Map as MapIcon, Mail, Phone, ExternalLink } from 'lucide-react';

// 23 target jurisdictions for attorney coverage
const TARGETS = ['NJ','MD','VA','NY','NC','GA','IL','MN','PA','KY','WV','DC','AZ','FL','NV','OH','SC','MI','MO','TN','MS','CA','CO'];

// us-atlas geography ids are state FIPS codes
const FIPS_TO_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL',
  '13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME',
  '24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH',
  '34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI',
  '56':'WY','60':'AS','66':'GU','69':'MP','72':'PR','78':'VI',
};

interface QueueRow {
  id: string;
  attorney_name: string | null;
  firm: string | null;
  jurisdiction: string | null;
  priority_tier: string | null;
  stage: string | null;
  phone: string | null;
  email: string | null;
}

const tierVariant = (t: string | null): 'default' | 'secondary' | 'outline' =>
  t === 'A1' ? 'default' : t === 'A2' ? 'secondary' : 'outline';

export default function SFCoverageMap() {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['sf-coverage-map-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sf_recruiting_queue')
        .select('id, attorney_name, firm, jurisdiction, priority_tier, stage, phone, email');
      if (error) throw error;
      return (data || []) as QueueRow[];
    },
  });

  const byState = useMemo(() => {
    const m: Record<string, QueueRow[]> = {};
    for (const r of queue) {
      const j = (r.jurisdiction || '').toUpperCase();
      if (!j) continue;
      (m[j] ||= []).push(r);
    }
    return m;
  }, [queue]);

  const covered = TARGETS.filter(s => (byState[s]?.length ?? 0) > 0);
  const uncovered = TARGETS.filter(s => !(byState[s]?.length));
  const selectedRows = selectedState ? byState[selectedState] ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
          <MapIcon className="h-6 w-6" /> Attorney Coverage Map
        </h1>
        <p className="text-sm text-muted-foreground">
          Recruiting-queue coverage across the 23 target jurisdictions — internal only
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-3xl font-bold text-amber-500">{covered.length}<span className="text-base text-muted-foreground"> / {TARGETS.length}</span></p>
            <p className="text-xs text-muted-foreground">target jurisdictions covered</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground mb-1">Uncovered targets ({uncovered.length})</p>
            <div className="flex flex-wrap gap-1">
              {uncovered.length === 0
                ? <span className="text-xs text-green-500">All target jurisdictions have at least one record</span>
                : uncovered.map(s => (
                    <Badge key={s} variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">{s}</Badge>
                  ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#22c55e' }} /> Covered</div>
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#3f3f46' }} /> No records</div>
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm border-2 border-amber-500" /> Target jurisdiction</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <ComposableMap projection="geoAlbersUsa" width={980} height={560} style={{ width: '100%', height: 'auto' }}>
              <Geographies geography={statesTopo as any}>
                {({ geographies }) =>
                  geographies.map((geo: any) => {
                    const abbr = FIPS_TO_ABBR[String(geo.id).padStart(2, '0')];
                    const count = abbr ? byState[abbr]?.length ?? 0 : 0;
                    const isTarget = abbr ? TARGETS.includes(abbr) : false;
                    const isSelected = abbr === selectedState;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => abbr && setSelectedState(abbr)}
                        style={{
                          default: {
                            fill: count > 0 ? '#22c55e' : '#3f3f46',
                            stroke: isSelected ? '#fbbf24' : isTarget ? '#f59e0b' : '#18181b',
                            strokeWidth: isSelected ? 2.5 : isTarget ? 1.4 : 0.5,
                            outline: 'none',
                          },
                          hover: { fill: count > 0 ? '#16a34a' : '#52525b', stroke: '#fbbf24', strokeWidth: 1.6, outline: 'none', cursor: 'pointer' },
                          pressed: { fill: '#facc15', outline: 'none' },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedState ? `${selectedState} — ${selectedRows.length} record${selectedRows.length === 1 ? '' : 's'}` : 'Select a state'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedState ? (
              <p className="text-sm text-muted-foreground">Click a state on the map to see its recruiting-queue records.</p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : selectedRows.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No recruiting-queue records in {selectedState}
                  {TARGETS.includes(selectedState) ? ' — this is an uncovered target jurisdiction.' : '.'}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/surplus-funds/attorney-crm">Open Attorney CRM <ExternalLink className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[460px] pr-3">
                <div className="space-y-3">
                  {selectedRows.map(r => (
                    <div key={r.id} className="rounded-md border border-border p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.attorney_name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.firm || '—'}</p>
                        </div>
                        <Badge variant={tierVariant(r.priority_tier)} className="text-[10px] shrink-0">{r.priority_tier || '—'}</Badge>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{(r.stage || 'identified').replace(/_/g, ' ')}</Badge>
                      <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                        {r.phone && <p className="flex items-center gap-1 truncate"><Phone className="h-3 w-3 shrink-0" />{r.phone}</p>}
                        {r.email && <p className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{r.email}</p>}
                      </div>
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                        <Link to="/surplus-funds/attorney-crm">Edit in Attorney CRM <ExternalLink className="h-3 w-3 ml-1" /></Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
