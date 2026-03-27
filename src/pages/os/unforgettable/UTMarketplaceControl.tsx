import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, ShieldCheck, Eye } from 'lucide-react';

export default function UTMarketplaceControl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Floor 4 — Marketplace Control</h1>
        <p className="text-muted-foreground">Manage public listings — only verified partners appear</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">Marketplace Gate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No Onboarding = No Listing. Only verified partners with complete profiles are published.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Store className="h-5 w-5 text-pink-500" />
            <CardTitle className="text-base">Active Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Review and manage all currently published marketplace listings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Partners awaiting profile review before going live</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
