import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Eye, Calendar, DollarSign, Star, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, MessageSquare, Package
} from 'lucide-react';
import { usePartnerById, usePartnerListings, usePartnerBookings } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; category: string; }

export default function UTPartnerOverview({ partnerId, category }: Props) {
  const { data: partner } = usePartnerById(partnerId);
  const { data: listings = [] } = usePartnerListings(partnerId);
  const { data: bookings = [] } = usePartnerBookings(partnerId);

  const published = listings.filter(l => l.status === 'published').length;
  const drafts = listings.filter(l => l.status === 'draft').length;
  const activeBookings = bookings.filter(b => !['completed', 'cancelled'].includes(b.status || '')).length;
  const totalRevenue = bookings.reduce((s, b) => s + (Number(b.total) || 0), 0);

  const completeness = partner?.profile_completeness || 0;
  const missingFields: string[] = [];
  if (!partner?.description) missingFields.push('Business description');
  if (!partner?.logo_url) missingFields.push('Logo');
  if (!partner?.cover_image_url) missingFields.push('Cover image');
  if (!partner?.phone) missingFields.push('Phone number');
  if (!partner?.website) missingFields.push('Website');

  return (
    <div className="space-y-6">
      {/* Profile Completeness */}
      {completeness < 100 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Profile Completeness</span>
              </div>
              <span className="text-sm font-bold">{completeness}%</span>
            </div>
            <Progress value={completeness} className="h-2 mb-3" />
            {missingFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {missingFields.map(f => (
                  <Badge key={f} variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                    Missing: {f}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Published Listings', value: published, icon: Package, color: 'text-blue-500' },
          { label: 'Active Bookings', value: activeBookings, icon: Calendar, color: 'text-emerald-500' },
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-500' },
          { label: 'Avg Rating', value: partner?.avg_rating || '—', icon: Star, color: 'text-amber-500' },
        ].map(stat => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-7 w-7 ${stat.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No bookings yet</p>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{b.customer_name || 'Customer'}</p>
                      <p className="text-xs text-muted-foreground">{b.event_type} • {b.event_date}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Listings</CardTitle>
          </CardHeader>
          <CardContent>
            {listings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No listings yet</p>
            ) : (
              <div className="space-y-3">
                {listings.slice(0, 5).map(l => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground">{l.listing_type}</p>
                    </div>
                    <Badge variant={l.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                      {l.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
