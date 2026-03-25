import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Search, Phone, Plus, Send, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DCLead } from './usePipelineLeads';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500',
  queued: 'bg-purple-500/10 text-purple-500 border-purple-500',
  called: 'bg-muted text-muted-foreground',
  interested: 'bg-teal-500/10 text-teal-500 border-teal-500',
  booked: 'bg-green-500/10 text-green-500 border-green-500',
  'not-interested': 'bg-red-500/10 text-red-500 border-red-500',
  callback: 'bg-amber-500/10 text-amber-500 border-amber-500',
  'do-not-call': 'bg-red-900/10 text-red-900 border-red-900',
};

interface PipelineLeadTableProps {
  leads: DCLead[];
  isLoading: boolean;
  columns: { key: string; label: string; render?: (lead: DCLead) => React.ReactNode }[];
  onUploadCSV: (file: File) => Promise<number>;
  onSendToCampaign: (ids: string[]) => void;
  onRefetch: () => void;
  isSending?: boolean;
  uploadLabel?: string;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  extraActions?: React.ReactNode;
}

export function PipelineLeadTable({
  leads, isLoading, columns, onUploadCSV, onSendToCampaign, onRefetch,
  isSending, uploadLabel = 'Upload Leads', statusFilter, onStatusFilterChange, extraActions,
}: PipelineLeadTableProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = leads.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.first_name?.toLowerCase().includes(s) || l.last_name?.toLowerCase().includes(s) ||
            l.phone?.includes(s) || l.email?.toLowerCase().includes(s) ||
            l.address?.toLowerCase().includes(s) || l.city?.toLowerCase().includes(s));
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onUploadCSV(file); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">
            Leads <Badge variant="secondary" className="ml-2">{leads.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {extraActions}
            <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={handleUpload} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
              {uploadLabel}
            </Button>
            <Button size="sm" variant="outline" onClick={onRefetch} disabled={isLoading}>
              <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="called">Called</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="not-interested">Not Interested</SelectItem>
              <SelectItem value="callback">Callback</SelectItem>
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <Button size="sm" onClick={() => onSendToCampaign(Array.from(selected))} disabled={isSending}>
              {isSending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
              Send {selected.size} to Campaign
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 w-8">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </th>
                {columns.map(c => <th key={c.key} className="p-2">{c.label}</th>)}
                <th className="p-2">Status</th>
                <th className="p-2">Calls</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={columns.length + 3} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={columns.length + 3} className="p-8 text-center text-muted-foreground">No leads found</td></tr>
              ) : filtered.map(lead => (
                <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-2">
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => {
                      const s = new Set(selected);
                      s.has(lead.id) ? s.delete(lead.id) : s.add(lead.id);
                      setSelected(s);
                    }} />
                  </td>
                  {columns.map(c => (
                    <td key={c.key} className="p-2">
                      {c.render ? c.render(lead) : (lead as any)[c.key] || '—'}
                    </td>
                  ))}
                  <td className="p-2">
                    <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[lead.status] || '')}>
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{lead.call_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
