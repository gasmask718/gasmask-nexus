import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderLock,
  Upload,
  Plus,
  Download,
  Trash2,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  HardDrive,
  CalendarDays,
  Layers,
  Files,
} from 'lucide-react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════
// UBEN Documents — secure document vault (uben-docs bucket, private)
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';
const BUCKET = 'uben-docs';

type DocRow = {
  id: string;
  name: string;
  category: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

const CATEGORIES = ['501c3', 'grants', 'compliance', 'board', 'financials', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_HINTS: Record<Category, string> = {
  '501c3': 'IRS letter, articles of incorporation, bylaws',
  grants: 'Applications, award letters, grant reports',
  compliance: 'SAM.gov confirmation, state registrations, 990 filings',
  board: 'Meeting minutes, resolutions, board member agreements',
  financials: 'Bank statements, audits, budgets',
  other: 'Any other UBEN documents',
};

const categoryClass = (raw: string) => {
  switch ((raw || '').toLowerCase()) {
    case '501c3':
      return 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40';
    case 'grants':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'compliance':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'board':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'financials':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    default:
      return 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40';
  }
};

const formatSize = (bytes: number | null | undefined) => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

function FileTypeIcon({ name }: { name: string }) {
  const ext = extOf(name);
  if (ext === 'pdf') return <FileText className="h-6 w-6 text-red-400" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="h-6 w-6 text-blue-400" />;
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return <FileText className="h-6 w-6 text-emerald-400" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext))
    return <ImageIcon className="h-6 w-6 text-purple-400" />;
  return <FileIcon className="h-6 w-6 text-zinc-400" />;
}

// ═══════════════════════════════════════════════════════════════════════

export default function UbenDocuments() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | Category>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<DocRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // upload form state
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<Category>('501c3');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['uben-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const stats = useMemo(() => {
    const list = rows ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = list.filter((r) => parseISO(r.created_at) >= monthStart).length;
    const categoriesUsed = new Set(list.map((r) => (r.category || '').toLowerCase()).filter(Boolean))
      .size;
    const totalBytes = list.reduce((acc, r) => acc + (r.file_size ?? 0), 0);
    return {
      total: list.length,
      thisMonth: monthCount,
      categoriesUsed,
      totalBytes,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (tab === 'all') return rows;
    return rows.filter((r) => (r.category || '').toLowerCase() === tab);
  }, [rows, tab]);

  // ─── Download ────────────────────────────────────────────────────
  const handleDownload = async (row: DocRow) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_url, 3600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? 'Could not create download link');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // ─── Upload ──────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file to upload');
      const name = (docName.trim() || file.name).trim();
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${docCategory}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uploadedBy = user?.email ?? null;

      const { error: insErr } = await supabase.from('uben_documents').insert({
        name,
        category: docCategory,
        file_url: path,
        file_size: file.size,
        uploaded_by: uploadedBy,
      });

      if (insErr) {
        // rollback storage
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(`Database insert failed: ${insErr.message}`);
      }
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      qc.invalidateQueries({ queryKey: ['uben-documents'] });
      resetUploadForm();
      setUploadOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? 'Upload failed'),
  });

  const resetUploadForm = () => {
    setDocName('');
    setDocCategory('501c3');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Delete ──────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (row: DocRow) => {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.file_url]);
      if (rmErr) throw new Error(`Storage delete failed: ${rmErr.message}`);

      const { error: dbErr } = await supabase
        .from('uben_documents')
        .delete()
        .eq('id', row.id);
      if (dbErr) throw new Error(`Database delete failed: ${dbErr.message}`);
    },
    onSuccess: () => {
      toast.success('Document deleted');
      qc.invalidateQueries({ queryKey: ['uben-documents'] });
      setDeleteRow(null);
      setDeleteConfirm('');
    },
    onError: (e: any) => toast.error(e.message ?? 'Delete failed'),
  });

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-lg flex items-center justify-center"
            style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}55` }}
          >
            <FolderLock className="h-6 w-6" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Document Vault</h1>
            <p className="text-sm text-zinc-400">
              Secure storage for UBEN's 501(c)(3), grants, compliance, board & financial records.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="text-black"
          style={{ background: GOLD }}
        >
          <Upload className="h-4 w-4 mr-1.5" /> Upload Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={isLoading ? null : String(stats.total)}
          icon={<Files className="h-4 w-4" />}
        />
        <StatCard
          label="This Month"
          value={isLoading ? null : String(stats.thisMonth)}
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <StatCard
          label="Categories Used"
          value={isLoading ? null : String(stats.categoriesUsed)}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label="Storage Used"
          value={isLoading ? null : formatSize(stats.totalBytes)}
          icon={<HardDrive className="h-4 w-4" />}
        />
      </div>

      {/* Filter tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="all">All</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c} className="capitalize">
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Grid */}
      {error && (
        <div className="text-sm text-red-400">Failed to load: {(error as any).message}</div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full bg-zinc-800/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="py-16 text-center">
            <FolderLock className="h-10 w-10 mx-auto mb-3 opacity-40" style={{ color: GOLD }} />
            <p className="text-sm text-zinc-400 mb-4">
              {tab === 'all'
                ? "No documents uploaded yet. Upload your first document to start building UBEN's secure document vault."
                : `No documents in "${tab}" yet.`}
            </p>
            <Button
              onClick={() => setUploadOpen(true)}
              className="text-black"
              style={{ background: GOLD }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((row) => (
            <Card
              key={row.id}
              className="bg-zinc-900/60 border-zinc-800 hover:border-[#C9A84C]/40 transition-colors"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-10 w-10 rounded-md bg-zinc-800/70 flex items-center justify-center shrink-0">
                    <FileTypeIcon name={row.name} />
                  </div>
                  <Badge variant="outline" className={categoryClass(row.category)}>
                    {row.category}
                  </Badge>
                </div>
                <div>
                  <div
                    className="font-semibold text-sm text-zinc-100 line-clamp-2 leading-snug"
                    title={row.name}
                  >
                    {row.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {formatDistanceToNowStrict(parseISO(row.created_at), { addSuffix: true })}
                    {row.file_size ? ` · ${formatSize(row.file_size)}` : ''}
                  </div>
                  {row.uploaded_by && (
                    <div className="text-[11px] text-zinc-600 mt-0.5 truncate">
                      by {row.uploaded_by}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => handleDownload(row)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-red-500/40 text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      setDeleteRow(row);
                      setDeleteConfirm('');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(o) => {
          setUploadOpen(o);
          if (!o) resetUploadForm();
        }}
      >
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Files are stored privately in the <code className="text-zinc-300">uben-docs</code>{' '}
              bucket. Downloads use signed URLs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Document Name</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder={file?.name ?? 'e.g. IRS 501(c)(3) Determination Letter'}
                className="bg-zinc-900 border-zinc-800 mt-1"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Defaults to the file name if left blank.
              </p>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={docCategory}
                onValueChange={(v) => setDocCategory(v as Category)}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-zinc-500 mt-1">{CATEGORY_HINTS[docCategory]}</p>
            </div>
            <div>
              <Label className="text-xs">File *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="bg-zinc-900 border-zinc-800 mt-1 file:text-zinc-200"
              />
              {file && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  {file.name} · {formatSize(file.size)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !file}
              className="text-black"
              style={{ background: GOLD }}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog
        open={!!deleteRow}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteRow(null);
            setDeleteConfirm('');
          }
        }}
      >
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-red-300">Delete Document</DialogTitle>
            <DialogDescription className="text-zinc-500">
              This permanently removes the file from storage and its database record. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteRow && (
            <div className="space-y-3">
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="text-sm font-semibold text-zinc-100">{deleteRow.name}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {deleteRow.category} · {formatSize(deleteRow.file_size)}
                </div>
              </div>
              <div>
                <Label className="text-xs text-red-300">
                  Type the document name to confirm:
                </Label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={deleteRow.name}
                  className="bg-zinc-900 border-zinc-800 mt-1"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteRow(null);
                setDeleteConfirm('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                !deleteRow ||
                deleteConfirm.trim() !== deleteRow.name.trim() ||
                deleteMutation.isPending
              }
              onClick={() => deleteRow && deleteMutation.mutate(deleteRow)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
}) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 text-3xl font-semibold text-zinc-100">
          {value === null ? <Skeleton className="h-8 w-20 bg-zinc-800" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}
