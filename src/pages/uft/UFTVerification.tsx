import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ShieldCheck, FileText, IdCard, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  getUFTVerificationQueue,
  updateUFTVendorVerification,
  type UFTVerificationItem,
} from '@/services/uftApi';

const TABS = ['all', 'venue', 'staff', 'rental'] as const;
type FilterTab = typeof TABS[number];

const TYPE_COLORS: Record<string, string> = {
  venue: 'bg-blue-500/20 text-blue-400',
  staff: 'bg-purple-500/20 text-purple-400',
  rental: 'bg-green-500/20 text-green-400',
};

const STATUS_COLORS: Record<string, string> = {
  unverified: 'bg-gray-500/20 text-gray-300',
  pending: 'bg-yellow-500/20 text-yellow-400',
  verified: 'bg-green-500/20 text-green-400',
};

interface DocViewer {
  vendor: string;
  label: string;
  url: string;
}

export default function UFTVerification() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<FilterTab>('all');
  const [rejectModal, setRejectModal] = useState<UFTVerificationItem | null>(null);
  const [reason, setReason] = useState('');
  const [docViewer, setDocViewer] = useState<DocViewer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['uft-verification-queue', tab],
    queryFn: () => getUFTVerificationQueue(tab === 'all' ? undefined : tab),
  });

  const items = data?.items ?? [];

  const handleVerify = async (item: UFTVerificationItem) => {
    setBusy(item.id);
    try {
      await updateUFTVendorVerification(item.id, item.vendor_type, 'verified');
      toast.success('Vendor verified successfully');
      qc.invalidateQueries({ queryKey: ['uft-verification-queue'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setBusy(rejectModal.id);
    try {
      await updateUFTVendorVerification(rejectModal.id, rejectModal.vendor_type, 'unverified', reason);
      toast.success('Vendor rejected');
      qc.invalidateQueries({ queryKey: ['uft-verification-queue'] });
      setRejectModal(null);
      setReason('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const DocIcon = ({ url, label, Icon, vendor }: { url?: string | null; label: string; Icon: typeof IdCard; vendor: string }) => (
    <button
      disabled={!url}
      onClick={() => url && setDocViewer({ vendor, label, url })}
      className={`inline-flex items-center justify-center w-7 h-7 rounded ${url ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-600 cursor-not-allowed'}`}
      title={url ? `View ${label}` : `${label} not uploaded`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-blue-400" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Vendor Verification Queue</h1>
          <p className="text-sm text-muted-foreground">Review and approve vendor identity documents</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
          {items.length} pending review
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="all">All Pending</TabsTrigger>
          <TabsTrigger value="venue">Venues</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="rental">Rentals</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">Pending Vendors</CardTitle></CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-yellow-400 mb-3">Could not load queue. {(error as Error).message}</p>
          )}
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-medium">All vendors verified!</p>
              <p className="text-sm text-muted-foreground">No pending verification requests.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={`${item.vendor_type}-${item.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.cover_photo ? (
                          <img src={item.cover_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs">
                            {item.name?.charAt(0) ?? '?'}
                          </div>
                        )}
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${TYPE_COLORS[item.vendor_type]}`}>
                        {item.vendor_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{item.city}, {item.state}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DocIcon url={item.documents?.id_doc} label="ID Document" Icon={IdCard} vendor={item.name} />
                        <DocIcon url={item.documents?.business_license} label="Business License" Icon={FileText} vendor={item.name} />
                        <DocIcon url={item.documents?.insurance} label="Insurance" Icon={Shield} vendor={item.name} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[item.status] || 'bg-muted'}`}>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" disabled={busy === item.id}
                        onClick={() => handleVerify(item)}>✅ Verify</Button>
                      <Button size="sm" variant="outline" disabled={busy === item.id}
                        onClick={() => setRejectModal(item)}>❌ Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject modal */}
      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim()} onClick={handleReject}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doc viewer */}
      <Dialog open={!!docViewer} onOpenChange={(o) => !o && setDocViewer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document Review — {docViewer?.vendor}</DialogTitle>
          </DialogHeader>
          {docViewer && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{docViewer.label}</p>
              <div className="border rounded-lg overflow-hidden bg-muted/20">
                {/\.(png|jpe?g|webp|gif)$/i.test(docViewer.url) ? (
                  <img src={docViewer.url} alt={docViewer.label} className="max-h-[60vh] w-full object-contain" />
                ) : (
                  <iframe src={docViewer.url} title={docViewer.label} className="w-full h-[60vh]" />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocViewer(null)}>This looks good</Button>
            <Button variant="destructive" onClick={() => { toast.message('Document flagged for follow-up'); setDocViewer(null); }}>
              Flag this document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
