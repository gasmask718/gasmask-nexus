import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { usePartnerAvailability } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

export default function UTPartnerAvailability({ partnerId }: Props) {
  const { data: slots = [] } = usePartnerAvailability(partnerId);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Availability</h3>
      {slots.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No availability set. Calendar management coming soon.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {slots.map(s => (
            <Card key={s.id} className="border-border/50">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{s.date}</span>
                  {s.time_start && <span className="text-xs text-muted-foreground">{s.time_start} - {s.time_end}</span>}
                </div>
                <Badge variant={s.status === 'available' ? 'default' : 'secondary'} className="text-[10px]">{s.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
