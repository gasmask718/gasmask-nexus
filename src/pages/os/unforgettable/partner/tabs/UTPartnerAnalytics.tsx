import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Eye, MessageSquare, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { usePartnerAnalytics } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

export default function UTPartnerAnalytics({ partnerId }: Props) {
  const { data: analytics = [] } = usePartnerAnalytics(partnerId);

  const totals = analytics.reduce((acc, a) => ({
    views: acc.views + (a.views || 0),
    inquiries: acc.inquiries + (a.inquiries || 0),
    bookings: acc.bookings + (a.bookings || 0),
    revenue: acc.revenue + (Number(a.revenue) || 0),
  }), { views: 0, inquiries: 0, bookings: 0, revenue: 0 });

  const convRate = totals.views > 0 ? ((totals.bookings / totals.views) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">Analytics (Last 30 Days)</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Views', value: totals.views, icon: Eye, color: 'text-blue-500' },
          { label: 'Inquiries', value: totals.inquiries, icon: MessageSquare, color: 'text-purple-500' },
          { label: 'Bookings', value: totals.bookings, icon: Calendar, color: 'text-emerald-500' },
          { label: 'Revenue', value: `$${totals.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-500' },
          { label: 'Conv Rate', value: `${convRate}%`, icon: TrendingUp, color: 'text-amber-500' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {analytics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.slice(0, 10).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                  <span className="text-muted-foreground">{a.metric_date}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span>{a.views} views</span>
                    <span>{a.inquiries} inq</span>
                    <span>{a.bookings} book</span>
                    <span className="font-medium">${Number(a.revenue).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
