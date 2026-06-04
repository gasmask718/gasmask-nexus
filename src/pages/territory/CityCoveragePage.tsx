import { useParams, Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import { CoverageScanPanel } from '@/components/territory/CoverageScanPanel';

/**
 * CityCoveragePage — per-city full-coverage intelligence view.
 * Route: /territory/city-coverage/:city/:state
 */
export default function CityCoveragePage() {
  const { city: rawCity, state: rawState } = useParams<{ city: string; state: string }>();
  const city = decodeURIComponent(rawCity || '');
  const state = decodeURIComponent(rawState || '');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Link to="/territory" className="hover:underline">Territory Intelligence</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/territory/coverage" className="hover:underline">Neighborhood Coverage</Link>
        <ChevronRight className="h-3 w-3" />
        <span>{city}, {state}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-7 w-7 text-primary" />
          {city}, {state} — City Coverage
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every smoke / tobacco / convenience store that exists across the whole city — what we have vs what we're missing.
        </p>
      </div>

      <CoverageScanPanel city={city} state={state} />
    </div>
  );
}
