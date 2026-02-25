import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Loader2 } from 'lucide-react';

export type DuplicateAction = 'add' | 'update' | 'replace' | 'skip';
export type DuplicateSource = 'territory' | 'store_directory';

export interface DuplicateRecord {
  /** The new record about to be ingested */
  newRecord: {
    store_name?: string;
    full_address: string;
    city: string;
    state: string;
    zip: string;
    latitude: number;
    longitude: number;
    address_type: string;
    notes: string;
    discovery_status: string;
    discovered_by: string;
  };
  /** The existing row from territory_addresses or stores */
  existingRow: {
    id: string;
    full_address: string;
    notes: string | null;
    created_at: string;
    source?: DuplicateSource;
  };
  /** User-chosen action for this record */
  action: DuplicateAction;
}

interface Props {
  open: boolean;
  duplicates: DuplicateRecord[];
  onConfirm: (duplicates: DuplicateRecord[]) => void;
  onCancel: () => void;
  processing: boolean;
}

function extractName(notes: string | null): string {
  if (!notes) return '—';
  const parts = notes.split('|');
  return parts[0]?.trim() || '—';
}

const ALLOWED_ACTIONS_BY_SOURCE: Record<DuplicateSource, DuplicateAction[]> = {
  territory: ['skip', 'add', 'update', 'replace'],
  store_directory: ['skip', 'add'],
};

const ACTION_LABELS: Record<DuplicateAction, string> = {
  skip: 'Skip',
  add: 'Add Another',
  update: 'Update Existing',
  replace: 'Delete & Recreate',
};

function getSource(item: DuplicateRecord): DuplicateSource {
  return item.existingRow.source || 'territory';
}

function SourceBadge({ source }: { source: DuplicateSource }) {
  if (source === 'store_directory') {
    return <Badge variant="default" className="text-[10px]">Store Directory</Badge>;
  }
  return <Badge variant="secondary" className="text-[10px]">Territory</Badge>;
}

export function DuplicateResolutionModal({ open, duplicates, onConfirm, onCancel, processing }: Props) {
  const [items, setItems] = useState<DuplicateRecord[]>(duplicates);

  // Sync when duplicates prop changes
  if (duplicates.length > 0 && items.length !== duplicates.length) {
    setItems(duplicates);
  }

  const setAction = (index: number, action: DuplicateAction) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, action } : item));
  };

  const setAllAction = (action: DuplicateAction) => {
    setItems(prev => prev.map(item => {
      const allowed = ALLOWED_ACTIONS_BY_SOURCE[getSource(item)];
      if (allowed.includes(action)) return { ...item, action };
      return item; // keep current if action not allowed for this source
    }));
  };

  const isSingle = items.length === 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {isSingle ? 'Duplicate Record Found' : `${items.length} Duplicate Records Found`}
          </DialogTitle>
          <DialogDescription>
            {isSingle
              ? 'This business already exists. Choose how to proceed.'
              : 'The following businesses already exist. Choose an action for each record.'}
          </DialogDescription>
        </DialogHeader>

        {isSingle ? (
          <SingleDuplicateView
            item={items[0]}
            onAction={(action) => setAction(0, action)}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Set all to:</span>
              <Button variant="outline" size="sm" onClick={() => setAllAction('skip')}>Skip All</Button>
              <Button variant="outline" size="sm" onClick={() => setAllAction('add')}>Add All</Button>
              <Button variant="outline" size="sm" onClick={() => setAllAction('update')}>Update All</Button>
              <Button variant="outline" size="sm" onClick={() => setAllAction('replace')}>Replace All</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Found In</TableHead>
                  <TableHead>Existing Since</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => {
                  const source = getSource(item);
                  const allowed = ALLOWED_ACTIONS_BY_SOURCE[source];
                  return (
                    <TableRow key={`${item.existingRow.id}-${i}`}>
                      <TableCell className="font-medium text-sm">
                        {extractName(item.newRecord.notes)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.newRecord.full_address}
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={source} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.existingRow.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Select value={item.action} onValueChange={(v) => setAction(i, v as DuplicateAction)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allowed.map(a => (
                              <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(items)} disabled={processing}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm Actions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SingleDuplicateView({ item, onAction }: { item: DuplicateRecord; onAction: (a: DuplicateAction) => void }) {
  const name = extractName(item.newRecord.notes);
  const source = getSource(item);
  const allowed = ALLOWED_ACTIONS_BY_SOURCE[source];

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 space-y-2">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">{item.newRecord.full_address}</p>
        <div className="flex items-center gap-2">
          <SourceBadge source={source} />
          <span className="text-xs text-muted-foreground">
            Added {new Date(item.existingRow.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {allowed.includes('add') && (
          <Button
            variant={item.action === 'add' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onAction('add')}
            className="w-full"
          >
            Add Another Copy
          </Button>
        )}
        {allowed.includes('update') && (
          <Button
            variant={item.action === 'update' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onAction('update')}
            className="w-full"
          >
            Update Existing
          </Button>
        )}
        {allowed.includes('replace') && (
          <Button
            variant={item.action === 'replace' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onAction('replace')}
            className="w-full"
          >
            Delete & Recreate
          </Button>
        )}
        <Button
          variant={item.action === 'skip' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onAction('skip')}
          className="w-full"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
