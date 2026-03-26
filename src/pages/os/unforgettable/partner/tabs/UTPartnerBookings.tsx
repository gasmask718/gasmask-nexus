import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Users } from 'lucide-react';
import { usePartnerBookings } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-500/10 text-blue-600',
  quoted: 'bg-purple-500/10 text-purple-600',
  confirmed: 'bg-emerald-500/10 text-emerald-600',
  deposit_paid: 'bg-green-500/10 text-green-600',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/10 text-red-600',
};

export default function UTPartnerBookings({ partnerId }: Props) {
  const { data: bookings = [] } = usePartnerBookings(partnerId);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Bookings ({bookings.length})</h3>
      {bookings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No bookings yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <Card key={b.id} className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{b.customer_name || 'Customer'}</h4>
                    <p className="text-xs text-muted-foreground">{b.event_type} • {b.event_date}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {b.guest_count && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {b.guest_count} guests</span>}
                      {b.total && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${Number(b.total).toLocaleString()}</span>}
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${STATUS_COLORS[b.status || 'inquiry']}`}>{b.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
