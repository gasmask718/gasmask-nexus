import { Card, CardContent } from '@/components/ui/card';

interface PipelineStatsProps {
  stats: { total: number; new: number; called: number; interested: number; booked: number; winRate: string };
  labels?: { total?: string; new?: string; called?: string; interested?: string; booked?: string };
}

export function PipelineStats({ stats, labels }: PipelineStatsProps) {
  const items = [
    { value: stats.total, label: labels?.total || 'Total Leads', color: 'text-foreground' },
    { value: stats.new, label: labels?.new || 'New', color: 'text-blue-500' },
    { value: stats.called, label: labels?.called || 'Called', color: 'text-muted-foreground' },
    { value: stats.interested, label: labels?.interested || 'Interested', color: 'text-teal-500' },
    { value: stats.booked, label: labels?.booked || 'Booked', color: 'text-green-500' },
    { value: `${stats.winRate}%`, label: 'Win Rate', color: 'text-[#0F6E56]' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {items.map(item => (
        <Card key={item.label} className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
