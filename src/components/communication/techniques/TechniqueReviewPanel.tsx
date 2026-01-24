import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Sparkles,
  User,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  useTechniqueExtractions,
  useApproveTechnique,
  TechniqueExtraction,
} from '@/hooks/usePlaybooks';
import { useAuth } from '@/contexts/AuthContext';

export function TechniqueReviewPanel() {
  const { currentBusiness } = useBusiness();
  const { user } = useAuth();
  const businessId = currentBusiness?.id ?? null;

  const { data: techniques, isLoading } = useTechniqueExtractions(businessId);
  const approveTechnique = useApproveTechnique();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueExtraction | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  const filtered = techniques?.filter((t) => {
    const matchesSearch =
      t.technique_name.toLowerCase().includes(search.toLowerCase()) ||
      t.human_name.toLowerCase().includes(search.toLowerCase()) ||
      t.technique_type.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && !t.human_validated) ||
      (filter === 'approved' && t.is_approved_for_ai) ||
      (filter === 'rejected' && t.human_validated && !t.is_approved_for_ai);

    return matchesSearch && matchesFilter;
  });

  const handleApprove = (approved: boolean) => {
    if (!selectedTechnique) return;

    approveTechnique.mutate({
      techniqueId: selectedTechnique.id,
      approved,
      approvalNotes,
      approvedBy: user?.id,
    });

    setSelectedTechnique(null);
    setApprovalNotes('');
  };

  const getStatusBadge = (technique: TechniqueExtraction) => {
    if (!technique.human_validated) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending Review
        </Badge>
      );
    }
    if (technique.is_approved_for_ai) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge variant="outline" className="text-green-600">High ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
    if (confidence >= 0.6) {
      return <Badge variant="outline" className="text-yellow-600">Medium ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
    return <Badge variant="outline" className="text-red-600">Low ({(confidence * 100).toFixed(0)}%)</Badge>;
  };

  if (!businessId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a business to review techniques
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

  const pendingCount = techniques?.filter((t) => !t.human_validated).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Technique Review</h2>
            <p className="text-sm text-muted-foreground">
              Approve techniques before AI can use them
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive">
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search techniques, types, or sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <div className="text-sm">
          <strong>Human approval required.</strong> Techniques extracted from calls must be reviewed before the AI can adopt them. This is a governance control, not a suggestion.
        </div>
      </div>

      {/* Technique List */}
      {filtered && filtered.length > 0 ? (
        <div className="grid gap-4">
          {filtered.map((technique) => (
            <Card
              key={technique.id}
              className={cn(
                'cursor-pointer hover:border-primary/50 transition-colors',
                !technique.human_validated && 'ring-1 ring-yellow-500/30'
              )}
              onClick={() => setSelectedTechnique(technique)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{technique.technique_name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {technique.technique_type}
                      </Badge>
                      {getConfidenceBadge(technique.extraction_confidence)}
                    </div>
                  </div>
                  {getStatusBadge(technique)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {technique.technique_description}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span>From: {technique.human_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Score: {technique.outcome_score?.toFixed(0) ?? '—'}</span>
                    {technique.times_adopted > 0 && (
                      <span>• Adopted {technique.times_adopted}x</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-1">No techniques to review</h3>
          <p className="text-sm text-muted-foreground">
            Techniques will appear here after high-performing calls
          </p>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedTechnique} onOpenChange={() => setSelectedTechnique(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Review Technique
            </DialogTitle>
          </DialogHeader>

          {selectedTechnique && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{selectedTechnique.technique_name}</h3>
                {getStatusBadge(selectedTechnique)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <Badge variant="outline">{selectedTechnique.technique_type}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>{' '}
                  {selectedTechnique.human_name}
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence:</span>{' '}
                  {(selectedTechnique.extraction_confidence * 100).toFixed(0)}%
                </div>
                <div>
                  <span className="text-muted-foreground">Outcome Score:</span>{' '}
                  {selectedTechnique.outcome_score?.toFixed(0) ?? '—'}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedTechnique.technique_description}
                </p>
              </div>

              {selectedTechnique.transcript_excerpt && (
                <div>
                  <h4 className="font-medium mb-2">Transcript Excerpt</h4>
                  <div className="p-3 bg-muted rounded-lg text-sm italic">
                    "{selectedTechnique.transcript_excerpt}"
                  </div>
                </div>
              )}

              {selectedTechnique.phrasing_pattern && (
                <div>
                  <h4 className="font-medium mb-2">Phrasing Pattern</h4>
                  <div className="p-3 bg-primary/5 border rounded-lg text-sm font-mono">
                    {selectedTechnique.phrasing_pattern}
                  </div>
                </div>
              )}

              {selectedTechnique.context_triggers.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Context Triggers</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedTechnique.context_triggers.map((trigger) => (
                      <Badge key={trigger} variant="secondary">
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!selectedTechnique.human_validated && (
                <div>
                  <h4 className="font-medium mb-2">Approval Notes (optional)</h4>
                  <Textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Why are you approving or rejecting this technique?"
                    rows={2}
                  />
                </div>
              )}

              {selectedTechnique.approval_notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium text-sm mb-1">Previous Notes</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTechnique.approval_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTechnique(null)}>
              Close
            </Button>
            {selectedTechnique && !selectedTechnique.human_validated && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleApprove(false)}
                  disabled={approveTechnique.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleApprove(true)}
                  disabled={approveTechnique.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve for AI
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
