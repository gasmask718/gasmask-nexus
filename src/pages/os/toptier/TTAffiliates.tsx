import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pubFetch, pubPatch } from '@/lib/publicSiteApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, LinkIcon, DollarSign, TrendingUp, Copy, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function KPICard({ label, value, icon: Icon, color = 'text-[#C9A84C]' }: any) {
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center"><Icon className={`h-5 w-5 ${color}`} /></div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#C9A84C]" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export default function TTAffiliates() {
  const qc = useQueryClient();
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateVal, setRateVal] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: affiliates = [], isError } = useQuery({ queryKey: ['pub-affiliates'], queryFn: () => pubFetch('affiliates') });
  const { data: applications = [] } = useQuery({ queryKey: ['pub-aff-apps'], queryFn: () => pubFetch('affiliate_applications') });
  const { data: commissions = [] } = useQuery({ queryKey: ['pub-aff-comm'], queryFn: () => pubFetch('affiliate_commissions') });

  const activeAffiliates = affiliates.filter((a: any) => (a.status || '').toLowerCase() === 'active' || (a.status || '').toLowerCase() === 'approved');
  const totalReferrals = commissions.length;
  const totalEarned = commissions.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

  const handleApprove = async (app: any) => {
    setActionLoading(app.id);
    const code = 'TT' + (app.name || 'XX').slice(0, 2).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const ok = await pubPatch('affiliate_applications', app.id, { status: 'approved', referral_code: code });
    if (ok) { toast.success(`Approved! Code: ${code}`); qc.invalidateQueries({ queryKey: ['pub-aff-apps'] }); qc.invalidateQueries({ queryKey: ['pub-affiliates'] }); }
    else toast.error('Update failed. Try again.');
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    const ok = await pubPatch('affiliate_applications', id, { status: 'rejected' });
    if (ok) { toast.success('Rejected'); qc.invalidateQueries({ queryKey: ['pub-aff-apps'] }); }
    else toast.error('Update failed.');
    setActionLoading(null);
  };

  const handleRateSave = async (aff: any) => {
    const val = parseFloat(rateVal);
    if (isNaN(val)) { setEditingRate(null); return; }
    const ok = await pubPatch('affiliates', aff.id, { commission_rate: val });
    if (ok) { toast.success('Rate updated'); qc.invalidateQueries({ queryKey: ['pub-affiliates'] }); }
    else toast.error('Update failed.');
    setEditingRate(null);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Affiliate Command Center</h1><p className="text-white/40 text-sm">Manage affiliate network and referral programs</p></div>

      {isError && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">Could not load data from public site. Check Settings &gt; Public Site Connection.</div>}

      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Total Affiliates" value={activeAffiliates.length} icon={Users} />
        <KPICard label="Total Referrals" value={totalReferrals} icon={LinkIcon} />
        <KPICard label="Total Earned" value={`$${totalEarned.toLocaleString()}`} icon={DollarSign} />
        <KPICard label="Conversion Rate" value="—" icon={TrendingUp} />
      </div>

      <Tabs defaultValue="active">
        <TabsList className="bg-white/5">
          <TabsTrigger value="active" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Active Affiliates ({activeAffiliates.length})</TabsTrigger>
          <TabsTrigger value="applications" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Applications ({applications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="bg-[#111111] border-[#C9A84C]/10 mt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/40">Affiliate</TableHead>
                  <TableHead className="text-white/40">Referral Code</TableHead>
                  <TableHead className="text-white/40">Bookings</TableHead>
                  <TableHead className="text-white/40">Total Earned</TableHead>
                  <TableHead className="text-white/40">Rate %</TableHead>
                  <TableHead className="text-white/40">Status</TableHead>
                  <TableHead className="text-white/40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-white/5">
                {activeAffiliates.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-12">No affiliates found.</TableCell></TableRow>
                ) : activeAffiliates.map((a: any) => {
                  const affComm = commissions.filter((c: any) => c.affiliate_id === a.id);
                  const affEarned = affComm.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
                  return (
                    <TableRow key={a.id} className="border-white/5">
                      <TableCell>
                        <div><p className="text-white font-medium text-sm">{a.name || a.business_name || 'Unknown'}</p><p className="text-white/40 text-xs">{a.email || ''}</p></div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[#C9A84C] text-sm">{a.referral_code || '—'}</span>
                          {a.referral_code && <CopyButton text={a.referral_code} />}
                        </div>
                      </TableCell>
                      <TableCell className="text-white/60">{a.bookings_referred || affComm.length}</TableCell>
                      <TableCell className="text-[#C9A84C] font-bold">${affEarned.toLocaleString()}</TableCell>
                      <TableCell>
                        {editingRate === a.id ? (
                          <Input className="w-16 h-7 bg-[#0A0A0A] border-[#C9A84C]/30 text-white text-sm" value={rateVal} onChange={e => setRateVal(e.target.value)} onBlur={() => handleRateSave(a)} onKeyDown={e => e.key === 'Enter' && handleRateSave(a)} autoFocus />
                        ) : (
                          <span className="text-white/60 cursor-pointer hover:underline" onClick={() => { setEditingRate(a.id); setRateVal(String(a.commission_rate || '')); }}>{a.commission_rate || '—'}%</span>
                        )}
                      </TableCell>
                      <TableCell><Badge className="bg-emerald-500/20 text-emerald-400">{a.status}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-[#C9A84C] h-7 text-xs" onClick={() => { setSelectedAffiliate(a); setSheetOpen(true); }}>Details</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card className="bg-[#111111] border-[#C9A84C]/10 mt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/40">Name</TableHead>
                  <TableHead className="text-white/40">Email</TableHead>
                  <TableHead className="text-white/40">Social/Website</TableHead>
                  <TableHead className="text-white/40">Why Join</TableHead>
                  <TableHead className="text-white/40">Applied</TableHead>
                  <TableHead className="text-white/40">Status</TableHead>
                  <TableHead className="text-white/40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-white/5">
                {applications.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-12">No applications found.</TableCell></TableRow>
                ) : applications.map((app: any) => (
                  <TableRow key={app.id} className="border-white/5">
                    <TableCell className="text-white font-medium">{app.name || 'Unknown'}</TableCell>
                    <TableCell className="text-white/60 text-sm">{app.email || ''}</TableCell>
                    <TableCell className="text-white/60 text-sm">{app.website || app.social || '—'}</TableCell>
                    <TableCell className="text-white/40 text-sm max-w-[200px] truncate">{app.reason || app.why_join || '—'}</TableCell>
                    <TableCell className="text-white/40 text-sm">{app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell><Badge className={app.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : app.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}>{app.status || 'pending'}</Badge></TableCell>
                    <TableCell>
                      {(app.status || '').toLowerCase() === 'pending' && (
                        <div className="flex gap-1.5">
                          <Button size="sm" className="bg-emerald-500/20 text-emerald-400 h-7 text-xs" disabled={actionLoading === app.id} onClick={() => handleApprove(app)}>Approve</Button>
                          <Button size="sm" className="bg-red-500/20 text-red-400 h-7 text-xs" disabled={actionLoading === app.id} onClick={() => handleReject(app.id)}>Reject</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[500px] sm:max-w-[500px] overflow-y-auto">
          {selectedAffiliate && (
            <>
              <SheetHeader><SheetTitle className="text-white">{selectedAffiliate.name || selectedAffiliate.business_name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-white/40">Email</p><p className="text-white">{selectedAffiliate.email || '—'}</p></div>
                  <div><p className="text-white/40">Phone</p><p className="text-white">{selectedAffiliate.phone || '—'}</p></div>
                  <div><p className="text-white/40">Referral Code</p><p className="text-[#C9A84C] font-mono text-lg">{selectedAffiliate.referral_code || '—'}</p></div>
                  <div><p className="text-white/40">Commission Rate</p><p className="text-white">{selectedAffiliate.commission_rate || '—'}%</p></div>
                </div>
                <div>
                  <p className="text-white/40 text-sm mb-2">Earnings History</p>
                  {commissions.filter((c: any) => c.affiliate_id === selectedAffiliate.id).length === 0 ? (
                    <p className="text-white/30 text-sm">No earnings data.</p>
                  ) : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={commissions.filter((c: any) => c.affiliate_id === selectedAffiliate.id).slice(0, 12)}>
                          <XAxis dataKey="created_at" tick={{ fill: '#ffffff60', fontSize: 10 }} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short' })} />
                          <YAxis tick={{ fill: '#ffffff60', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: '#111', border: '1px solid #C9A84C33' }} />
                          <Bar dataKey="amount" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
