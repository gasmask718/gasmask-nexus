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
import { Eye, MessageSquare, Star, CheckCircle, Send, DollarSign, UserCog, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function UTStaffMemberDashboard() {
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');
  const [replyInquiryId, setReplyInquiryId] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('staff_members_ut').select('*').eq('user_id', user.id);
      return data || [];
    }
  });

  const staff = staffProfiles[0];

  const { data: inquiries = [] } = useQuery({
    queryKey: ['staff-inquiries', staff?.id],
    queryFn: async () => {
      if (!staff) return [];
      const { data } = await supabase.from('staff_inquiries').select('*').eq('staff_id', staff.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!staff
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['staff-reviews', staff?.id],
    queryFn: async () => {
      if (!staff) return [];
      const { data } = await supabase.from('staff_reviews').select('*').eq('staff_id', staff.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!staff
  });

  useEffect(() => {
    if (!staff) return;
    const channel = supabase.channel('staff-inquiries-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_inquiries', filter: `staff_id=eq.${staff.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['staff-inquiries', staff.id] });
        toast.success('New booking inquiry received!');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [staff?.id]);

  const updateInquiry = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('staff_inquiries').update({ status }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-inquiries'] })
  });

  const replyToInquiry = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      await supabase.from('staff_inquiries').update({ reply, replied_at: new Date().toISOString(), status: 'responded' }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-inquiries'] });
      setReplyInquiryId(null);
      setReplyText('');
      toast.success('Reply sent!');
    }
  });

  const replyToReview = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      await supabase.from('staff_reviews').update({ reply, replied_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reviews'] });
      toast.success('Reply saved!');
    }
  });

  const completionChecks = staff ? [
    { label: 'Profile photo uploaded', done: !!staff.profile_photo },
    { label: 'Bio written', done: !!staff.bio },
    { label: 'Pricing set', done: !!staff.hourly_rate || !!staff.event_rate },
    { label: 'Portfolio photos added', done: (staff.portfolio_photos as string[])?.length > 0 },
    { label: 'Demo video added', done: !!staff.demo_video_url },
  ] : [];
  const completionPct = completionChecks.length ? Math.round((completionChecks.filter(c => c.done).length / completionChecks.length) * 100) : 0;

  const thisMonthInquiries = inquiries.filter((i: any) => new Date(i.created_at).getMonth() === new Date().getMonth());
  const bookedThisMonth = thisMonthInquiries.filter((i: any) => i.status === 'booked');
  const avgRating = staff?.rating_avg || 0;

  const earningsData = Array.from({ length: 6 }, (_, i) => ({
    month: format(new Date(2026, new Date().getMonth() - 5 + i, 1), 'MMM'),
    earnings: Math.floor(Math.random() * 3000) + 500,
    bookings: Math.floor(Math.random() * 10) + 1
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="h-6 w-6 text-pink-400" /> Staff Dashboard</h1>
          <p className="text-muted-foreground">{staff?.full_name || 'No profile registered'} {staff?.role_category && `• ${staff.role_category}`}</p>
        </div>
        {staff && (
          <Badge variant="outline" className={staff.status === 'verified' ? 'border-emerald-500 text-emerald-400' : 'border-amber-500 text-amber-400'}>
            {staff.status?.toUpperCase()}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Eye className="h-8 w-8 text-blue-400" /><div><p className="text-2xl font-bold">{staff?.views_count || 0}</p><p className="text-xs text-muted-foreground">Profile Views</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><MessageSquare className="h-8 w-8 text-pink-400" /><div><p className="text-2xl font-bold">{thisMonthInquiries.length}</p><p className="text-xs text-muted-foreground">Inquiries This Month</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Briefcase className="h-8 w-8 text-emerald-400" /><div><p className="text-2xl font-bold">{bookedThisMonth.length}</p><p className="text-xs text-muted-foreground">Bookings This Month</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-amber-400" /><div><p className="text-2xl font-bold">${Number(staff?.total_earnings || 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Earnings</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="inquiries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
          <TabsTrigger value="calendar">Availability</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="completion">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="inquiries">
          <Card>
            <CardHeader><CardTitle>Inquiries</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Requester</TableHead><TableHead>Event Date</TableHead>
                    <TableHead>Type</TableHead><TableHead>Hours</TableHead><TableHead>Budget</TableHead>
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
                      <TableCell>{inq.hours_needed || '—'}</TableCell>
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

        <TabsContent value="calendar">
          <Card>
            <CardHeader><CardTitle>Availability Calendar</CardTitle></CardHeader>
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
                      <Input placeholder="Write a reply..." className="flex-1" id={`srev-${rev.id}`} />
                      <Button size="sm" onClick={() => {
                        const input = document.getElementById(`srev-${rev.id}`) as HTMLInputElement;
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

        <TabsContent value="earnings">
          <Card>
            <CardHeader><CardTitle>Earnings & Bookings</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={earningsData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" /><YAxis stroke="hsl(var(--muted-foreground))" /><Tooltip /><Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Earnings ($)" /><Bar dataKey="bookings" fill="hsl(330 80% 60%)" radius={[4, 4, 0, 0]} name="Bookings" /></BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio">
          <Card>
            <CardHeader><CardTitle>Portfolio</CardTitle><CardDescription>Upload photos and videos to showcase your work</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(staff?.portfolio_photos as string[] || []).map((url: string, i: number) => (
                  <div key={i} className="aspect-square rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                    <img src={url} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
                <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-muted-foreground text-sm">+ Add Photo</span>
                </div>
              </div>
              {staff?.demo_video_url && (
                <div>
                  <h4 className="font-medium mb-2">Demo Video</h4>
                  <a href={staff.demo_video_url} target="_blank" rel="noreferrer" className="text-primary underline">{staff.demo_video_url}</a>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {staff ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-sm font-medium">Full Name</label><Input defaultValue={staff.full_name} /></div>
                    <div><label className="text-sm font-medium">Role/Category</label><Input defaultValue={staff.role_category || ''} /></div>
                    <div><label className="text-sm font-medium">Phone</label><Input defaultValue={staff.phone || ''} /></div>
                    <div><label className="text-sm font-medium">Email</label><Input defaultValue={staff.email || ''} /></div>
                    <div><label className="text-sm font-medium">City</label><Input defaultValue={staff.city || ''} /></div>
                    <div><label className="text-sm font-medium">State</label><Input defaultValue={staff.state || ''} /></div>
                    <div><label className="text-sm font-medium">Hourly Rate</label><Input type="number" defaultValue={staff.hourly_rate || ''} /></div>
                    <div><label className="text-sm font-medium">Event Rate</label><Input type="number" defaultValue={staff.event_rate || ''} /></div>
                    <div><label className="text-sm font-medium">Years Experience</label><Input type="number" defaultValue={staff.years_experience || ''} /></div>
                    <div><label className="text-sm font-medium">Instagram</label><Input defaultValue={staff.instagram_handle || ''} /></div>
                  </div>
                  <div><label className="text-sm font-medium">Bio</label><Textarea defaultValue={staff.bio || ''} rows={4} /></div>
                  <Button>Save Changes</Button>
                </>
              ) : <p className="text-muted-foreground">No staff profile registered yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

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
