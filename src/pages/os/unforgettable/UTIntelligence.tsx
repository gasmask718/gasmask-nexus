import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, MapPin, Database } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UTIntelligence() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Floor 1 — Lead Intelligence</h1>
        <p className="text-muted-foreground">Find, score, and manage vendor leads before outreach</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/os/unforgettable/places">
          <Card className="hover:border-pink-500/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2">
              <Target className="h-5 w-5 text-pink-500" />
              <CardTitle className="text-base">Google Places Finder</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Search Google Places for vendors by category and location</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/os/unforgettable/territory">
          <Card className="hover:border-pink-500/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2">
              <MapPin className="h-5 w-5 text-pink-500" />
              <CardTitle className="text-base">Territory Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Map coverage, identify gaps, and prioritize markets</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">CSV / Outscraper Import</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Bulk import leads from external data sources</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
