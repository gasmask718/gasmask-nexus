import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building, Users, MessageSquare, TrendingUp, Star, DollarSign } from 'lucide-react';

const COLORS = ['hsl(330,80%,60%)', 'hsl(200,80%,60%)', 'hsl(150,70%,50%)', 'hsl(40,90%,60%)', 'hsl(270,70%,60%)', 'hsl(10,80%,60%)'];

export default function UTPlatformStats() {
  const { data: halls = [] } = useQuery({
    queryKey: ['platform-halls'],
    queryFn: async () => {
      const { data } = await supabase.from('event_halls').select('*');
      return data || [];
    }
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['platform-staff'],
    queryFn: async () => {
      const { data } = await supabase.from('staff_members_ut').select('*');
      return data || [];
    }
  });

  const { data: hallInquiries = [] } = useQuery({
    queryKey: ['platform-hall-inquiries'],
    queryFn: async () => {
      const { data } = await supabase.from('hall_inquiries').select('*');
      return data || [];
    }
  });

  const { data: staffInquiries = [] } = useQuery({
    queryKey: ['platform-staff-inquiries'],
    queryFn: async () => {
      const { data } = await supabase.from('staff_inquiries').select('*');
      return data || [];
    }
  });

  const activeHalls = halls.filter((h: any) => h.status !== 'suspended');
  const activeStaff = staff.filter((s: any) => s.status !== 'suspended');
  const totalInquiries = hallInquiries.length + staffInquiries.length;

  // Halls by state
  const hallsByState: Record<string, number> = {};
  activeHalls.forEach((h: any) => { if (h.state) hallsByState[h.state] = (hallsByState[h.state] || 0) + 1; });
  const hallsByStateData = Object.entries(hallsByState).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([state, count]) => ({ state, count }));

  // Staff by role
  const staffByRole: Record<string, number> = {};
  activeStaff.forEach((s: any) => { if (s.role_category) staffByRole[s.role_category] = (staffByRole[s.role_category] || 0) + 1; });
  const staffByRoleData = Object.entries(staffByRole).map(([name, value]) => ({ name, value }));

  // Top halls
  const topHalls = [...halls].sort((a: any, b: any) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5);
  const topStaff = [...staff].sort((a: any, b: any) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5);

  const totalRevenue = staff.reduce((acc: number, s: any) => acc + Number(s.total_earnings || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6 text-pink-400" /> Platform Statistics</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6 text-center"><Building className="h-8 w-8 mx-auto text-pink-400 mb-2" /><p className="text-2xl font-bold">{activeHalls.length}</p><p className="text-xs text-muted-foreground">Active Halls</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Users className="h-8 w-8 mx-auto text-blue-400 mb-2" /><p className="text-2xl font-bold">{activeStaff.length}</p><p className="text-xs text-muted-foreground">Active Staff</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><MessageSquare className="h-8 w-8 mx-auto text-emerald-400 mb-2" /><p className="text-2xl font-bold">{totalInquiries}</p><p className="text-xs text-muted-foreground">Total Inquiries</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Star className="h-8 w-8 mx-auto text-amber-400 mb-2" /><p className="text-2xl font-bold">{halls.filter((h: any) => h.is_featured).length}</p><p className="text-xs text-muted-foreground">Featured Venues</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><DollarSign className="h-8 w-8 mx-auto text-emerald-400 mb-2" /><p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Platform Revenue</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Halls by State (Top 10)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hallsByStateData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="state" stroke="hsl(var(--muted-foreground))" /><YAxis stroke="hsl(var(--muted-foreground))" /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Staff by Role Category</CardTitle></CardHeader>
          <CardContent>
            {staffByRoleData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart><Pie data={staffByRoleData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {staffByRoleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">No staff data yet</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Top Performing Halls</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topHalls.map((h: any, i: number) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                    <div><p className="font-medium">{h.name}</p><p className="text-xs text-muted-foreground">{h.city}, {h.state}</p></div>
                  </div>
                  <div className="text-right"><p className="text-sm font-medium">{h.views_count} views</p><p className="text-xs text-amber-400">★ {Number(h.rating_avg || 0).toFixed(1)}</p></div>
                </div>
              ))}
              {topHalls.length === 0 && <p className="text-center text-muted-foreground">No halls yet</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Performing Staff</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topStaff.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                    <div><p className="font-medium">{s.full_name}</p><p className="text-xs text-muted-foreground">{s.role_category} • {s.city}, {s.state}</p></div>
                  </div>
                  <div className="text-right"><p className="text-sm font-medium">{s.views_count} views</p><p className="text-xs text-amber-400">★ {Number(s.rating_avg || 0).toFixed(1)}</p></div>
                </div>
              ))}
              {topStaff.length === 0 && <p className="text-center text-muted-foreground">No staff yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
