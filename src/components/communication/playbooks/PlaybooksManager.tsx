import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, BookOpen } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  usePlaybooks,
  useCreatePlaybook,
  useUpdatePlaybook,
  SalesPlaybook,
} from '@/hooks/usePlaybooks';
import { PlaybookCard } from './PlaybookCard';
import { PlaybookEditor } from './PlaybookEditor';

export function PlaybooksManager() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id ?? null;

  const { data: playbooks, isLoading } = usePlaybooks(businessId);
  const createPlaybook = useCreatePlaybook();
  const updatePlaybook = useUpdatePlaybook();

  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<SalesPlaybook | null>(null);

  const filtered = playbooks?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.target_intents.some((i) => i.toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggleActive = (id: string, active: boolean) => {
    updatePlaybook.mutate({ id, updates: { is_active: active } });
  };

  const handleSetDefault = (id: string) => {
    // First unset current default
    const currentDefault = playbooks?.find((p) => p.is_default);
    if (currentDefault) {
      updatePlaybook.mutate({ id: currentDefault.id, updates: { is_default: false } });
    }
    // Set new default
    updatePlaybook.mutate({ id, updates: { is_default: true } });
  };

  const handleEdit = (playbook: SalesPlaybook) => {
    setEditingPlaybook(playbook);
    setEditorOpen(true);
  };

  const handleSave = (data: Partial<SalesPlaybook>) => {
    if (editingPlaybook) {
      updatePlaybook.mutate({ id: editingPlaybook.id, updates: data });
    } else {
      createPlaybook.mutate(data as { business_id: string; name: string });
    }
    setEditingPlaybook(null);
  };

  if (!businessId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a business to manage playbooks
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Sales Playbooks</h2>
            <p className="text-sm text-muted-foreground">
              Define what the AI should do for each intent
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditingPlaybook(null); setEditorOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Playbook
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search playbooks or intents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Playbook List */}
      {filtered && filtered.length > 0 ? (
        <div className="grid gap-4">
          {filtered.map((playbook) => (
            <PlaybookCard
              key={playbook.id}
              playbook={playbook}
              onToggleActive={handleToggleActive}
              onSetDefault={handleSetDefault}
              onEdit={handleEdit}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-1">No playbooks yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first playbook to define AI behavior
          </p>
          <Button onClick={() => { setEditingPlaybook(null); setEditorOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Playbook
          </Button>
        </div>
      )}

      {/* Editor Modal */}
      <PlaybookEditor
        playbook={editingPlaybook}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingPlaybook(null); }}
        onSave={handleSave}
        businessId={businessId}
      />
    </div>
  );
}
