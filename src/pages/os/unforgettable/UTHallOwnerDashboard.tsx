import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, MessageSquare, Star, CheckCircle, Send, Calendar as CalendarIcon, Building } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function UTHallOwnerDashboard() {
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');
  const [replyInquiryId, setReplyInquiryId] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  // Fetch halls owned by current user
  const { data: halls = [] } = useQuery({
    queryKey: ['my-halls'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('event_halls').select('*').eq('owner_user_id', user.id);
      return data || [];
    }
  });

  const hall = halls[0]; // Primary hall

  // Fetch inquiries
  const { data: inquiries = [] } = useQuery({
    queryKey: ['hall-inquiries', hall?.id],
    queryFn: async () => {
      if (!hall) return [];
      const { data } = await supabase.from('hall_inquiries').select('*').eq('hall_id', hall.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!hall
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['hall-reviews', hall?.id],
    queryFn: async () => {
      if (!hall) return [];
      const { data } = await supabase.from('hall_reviews').select('*').eq('hall_id', hall.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!hall
  });

  // Realtime subscription for new inquiries
  useEffect(() => {
    if (!hall) return;
    const channel = supabase.channel('hall-inquiries-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hall_inquiries', filter: `hall_id=eq.${hall.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['hall-inquiries', hall.id] });
        toast.success('New inquiry received!');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hall?.id]);

  // Update inquiry status
  const updateInquiry = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('hall_inquiries').update({ status }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hall-inquiries'] })
  });

  // Reply to inquiry
  const replyToInquiry = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      await supabase.from('hall_inquiries').update({ reply, replied_at: new Date().toISOString(), status: 'responded' }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-inquiries'] });
      setReplyInquiryId(null);
      setReplyText('');
      toast.success('Reply sent!');
    }
  });

  // Reply to review
  const replyToReview = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      await supabase.from('hall_reviews').update({ reply, replied_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-reviews'] });
      toast.success('Review reply saved!');
    }
  });

  // Profile completion
  const completionChecks = hall ? [
    { label: 'Photos uploaded', done: (hall.photos as string[])?.length > 0 },
    { label: 'Description filled', done: !!hall.description },
    { label: 'Pricing set', done: !!hall.price_per_hour || !!hall.price_per_event },
    { label: 'Amenities selected', done: (hall.amenities as string[])?.length > 0 },
    { label: 'Event types selected', done: (hall.event_types as string[])?.length > 0 },
    { label: 'Contact info complete', done: !!hall.phone && !!hall.email },
  ] : [];
  const completionPct = completionChecks.length ? Math.round((completionChecks.filter(c => c.done).length / completionChecks.length) * 100) : 0;

  const thisMonthInquiries = inquiries.filter((i: any) => new Date(i.created_at).getMonth() === new Date().getMonth());
  const avgRating = hall?.rating_avg || 0;

  // Mock chart data
  const viewsData = Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 1}`, views: Math.floor(Math.random() * 200) + 50 }));
  const inquiryTypeData = ['Wedding', 'Birthday', 'Corporate', 'Baby Shower', 'Quinceañera'].map(t => ({
    type: t, count: inquiries.filter((i: any) => i.event_type === t).length || Math.floor(Math.random() * 15)
  }));

  const statusColor = (s: string) => {
    if (s === 'booked') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (s === 'pending') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building className="h-6 w-6 text-pink-400" /> Hall Owner Dashboard</h1>
          <p className="text-muted-foreground">{hall?.name || 'No hall registered'}</p>
        </div>
        {hall && (
          <Badge variant="outline" className={hall.status === 'verified' ? 'border-emerald-500 text-emerald-400' : hall.status === 'featured' ? 'border-pink-500 text-pink-400' : 'border-amber-500 text-amber-400'}>
            {hall.status?.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Eye className="h-8 w-8 text-blue-400" /><div><p className="text-2xl font-bold">{hall?.views_count || 0}</p><p className="text-xs text-muted-foreground">Total Views</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><MessageSquare className="h-8 w-8 text-pink-400" /><div><p className="text-2xl font-bold">{thisMonthInquiries.length}</p><p className="text-xs text-muted-foreground">Inquiries This Month</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Star className="h-8 w-8 text-amber-400" /><div><p className="text-2xl font-bold">{Number(avgRating).toFixed(1)}</p><p className="text-xs text-muted-foreground">Avg Rating</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-emerald-400" /><div><p className="text-2xl font-bold">{completionPct}%</p><p className="text-xs text-muted-foreground">Profile Complete</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="inquiries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
          <TabsTrigger value="calendar">Availability</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="completion">Checklist</TabsTrigger>
        </TabsList>

        {/* Inquiries Tab */}
        <TabsContent value="inquiries">
          <Card>
            <CardHeader><CardTitle>Inquiries</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Requester</TableHead><TableHead>Event Date</TableHead>
                    <TableHead>Type</TableHead><TableHead>Guests</TableHead><TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiries.map((inq: any) => (
                    <TableRow key={inq.id}>
                      <TableCell>{format(new Date(inq.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{inq.requester_name}</TableCell>
                      <TableCell>{inq.event_date ? format(new Date(inq.event_date), 'MMM d, yyyy') : '—'}</TableCell>
                      <TableCell>{inq.event_type || '—'}</TableCell>
                      <TableCell>{inq.guest_count || '—'}</TableCell>
                      <TableCell>{inq.budget ? `$${inq.budget}` : '—'}</TableCell>
                      <TableCell>
                        <Select value={inq.status} onValueChange={(v) => updateInquiry.mutate({ id: inq.id, status: v })}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="responded">Responded</SelectItem>
                            <SelectItem value="booked">Booked</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Dialog open={replyInquiryId === inq.id} onOpenChange={(o) => !o && setReplyInquiryId(null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => setReplyInquiryId(inq.id)}><Send className="h-3 w-3 mr-1" />Reply</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Reply to {inq.requester_name}</DialogTitle></DialogHeader>
                            <Textarea placeholder="Your reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                            <Button onClick={() => replyToInquiry.mutate({ id: inq.id, reply: replyText })}>Send Reply</Button>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inquiries.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No inquiries yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader><CardTitle>Availability Calendar</CardTitle><CardDescription>Click dates to toggle availability</CardDescription></CardHeader>
            <CardContent className="flex gap-4">
              <Calendar mode="multiple" selected={selectedDates} onSelect={(dates) => setSelectedDates(dates || [])} className="rounded-md border" />
              <div className="space-y-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Available</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Booked</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-muted" /> Blocked</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <Card>
            <CardHeader><CardTitle>Reviews ({reviews.length})</CardTitle><CardDescription>Average: {Number(avgRating).toFixed(1)} ⭐</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {reviews.map((rev: any) => (
                <div key={rev.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rev.reviewer_name}</span>
                      <span className="text-amber-400">{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(rev.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  <p className="text-sm">{rev.body}</p>
                  {rev.reply && <div className="bg-muted/50 rounded p-3 text-sm"><strong>Your reply:</strong> {rev.reply}</div>}
                  {!rev.reply && (
                    <div className="flex gap-2">
                      <Input placeholder="Write a reply..." className="flex-1" id={`rev-${rev.id}`} />
                      <Button size="sm" onClick={() => {
                        const input = document.getElementById(`rev-${rev.id}`) as HTMLInputElement;
                        if (input?.value) replyToReview.mutate({ id: rev.id, reply: input.value });
                      }}>Reply</Button>
                    </div>
                  )}
                </div>
              ))}
              {reviews.length === 0 && <p className="text-center text-muted-foreground py-8">No reviews yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Views Per Week</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={viewsData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" /><YAxis stroke="hsl(var(--muted-foreground))" /><Tooltip /><Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} /></LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Inquiries by Event Type</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={inquiryTypeData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" /><YAxis stroke="hsl(var(--muted-foreground))" /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {hall ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-sm font-medium">Hall Name</label><Input defaultValue={hall.name} /></div>
                    <div><label className="text-sm font-medium">Contact Name</label><Input defaultValue={hall.contact_name || ''} /></div>
                    <div><label className="text-sm font-medium">Phone</label><Input defaultValue={hall.phone || ''} /></div>
                    <div><label className="text-sm font-medium">Email</label><Input defaultValue={hall.email || ''} /></div>
                    <div><label className="text-sm font-medium">City</label><Input defaultValue={hall.city || ''} /></div>
                    <div><label className="text-sm font-medium">State</label><Input defaultValue={hall.state || ''} /></div>
                    <div><label className="text-sm font-medium">Price/Hour</label><Input type="number" defaultValue={hall.price_per_hour || ''} /></div>
                    <div><label className="text-sm font-medium">Price/Event</label><Input type="number" defaultValue={hall.price_per_event || ''} /></div>
                    <div><label className="text-sm font-medium">Capacity Min</label><Input type="number" defaultValue={hall.capacity_min || ''} /></div>
                    <div><label className="text-sm font-medium">Capacity Max</label><Input type="number" defaultValue={hall.capacity_max || ''} /></div>
                  </div>
                  <div><label className="text-sm font-medium">Description</label><Textarea defaultValue={hall.description || ''} rows={4} /></div>
                  <div><label className="text-sm font-medium">Address</label><Input defaultValue={hall.address || ''} /></div>
                  <Button>Save Changes</Button>
                </>
              ) : <p className="text-muted-foreground">No hall registered yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Completion Checklist */}
        <TabsContent value="completion">
          <Card>
            <CardHeader><CardTitle>Profile Completion</CardTitle><CardDescription>{completionPct}% complete</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Progress value={completionPct} className="h-3" />
              <div className="space-y-2">
                {completionChecks.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className={`h-5 w-5 ${c.done ? 'text-emerald-400' : 'text-muted-foreground/30'}`} />
                    <span className={c.done ? '' : 'text-muted-foreground'}>{c.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
