// ═══════════════════════════════════════════════════════════════════════════════
// AI PLAYBOOKS PAGE — Create and Manage Automated Workflows
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { usePlaybookEngine, Playbook, PlaybookStep, SAMPLE_PLAYBOOKS } from '@/hooks/usePlaybookEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Plus,
  Play,
  Calendar,
  Trash2,
  Edit,
  GripVertical,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AiPlaybooks() {
  const navigate = useNavigate();
  const {
    fetchPlaybooks,
    createPlaybook,
    updatePlaybook,
    deletePlaybook,
    runPlaybook,
    createRoutine,
    isRunning,
    currentStep,
  } = usePlaybookEngine();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [runResults, setRunResults] = useState<any>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSteps, setFormSteps] = useState<PlaybookStep[]>([
    { input: '', requires_confirmation: false },
  ]);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [scheduleNotify, setScheduleNotify] = useState(true);

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    setIsLoading(true);
    const data = await fetchPlaybooks();
    setPlaybooks(data);
    setIsLoading(false);
  };

  const handleCreatePlaybook = async () => {
    if (!formTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    const validSteps = formSteps.filter(s => s.input.trim());
    if (validSteps.length === 0) {
      toast.error('Please add at least one step');
      return;
    }

    const result = await createPlaybook(formTitle, formDescription, validSteps);
    if (result) {
      setShowCreateDialog(false);
      resetForm();
      loadPlaybooks();
    }
  };

  const handleDeletePlaybook = async (id: string) => {
    if (confirm('Are you sure you want to delete this playbook?')) {
      await deletePlaybook(id);
      loadPlaybooks();
    }
  };

  const handleRunPlaybook = async (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setRunResults(null);
    setShowRunDialog(true);
  };

  const executeRun = async () => {
    if (!selectedPlaybook) return;
    const results = await runPlaybook(selectedPlaybook.id);
    setRunResults(results);
  };

  const handleSchedulePlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setShowScheduleDialog(true);
  };

  const executeSchedule = async () => {
    if (!selectedPlaybook) return;
    const result = await createRoutine(selectedPlaybook.id, scheduleFrequency, scheduleNotify);
    if (result) {
      setShowScheduleDialog(false);
      toast.success('Routine scheduled successfully');
    }
  };

  const handleEditPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setFormTitle(playbook.title);
    setFormDescription(playbook.description || '');
    setFormSteps(playbook.steps.length > 0 ? playbook.steps : [{ input: '', requires_confirmation: false }]);
    setShowCreateDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPlaybook) return;
    
    const validSteps = formSteps.filter(s => s.input.trim());
    const success = await updatePlaybook(selectedPlaybook.id, {
      title: formTitle,
      description: formDescription,
      steps: validSteps,
    });

    if (success) {
      setShowCreateDialog(false);
      setSelectedPlaybook(null);
      resetForm();
      loadPlaybooks();
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormSteps([{ input: '', requires_confirmation: false }]);
    setSelectedPlaybook(null);
  };

  const addStep = () => {
    setFormSteps([...formSteps, { input: '', requires_confirmation: false }]);
  };

  const removeStep = (index: number) => {
    setFormSteps(formSteps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<PlaybookStep>) => {
    setFormSteps(formSteps.map((step, i) => 
      i === index ? { ...step, ...updates } : step
    ));
  };

  const handleCreateSamplePlaybooks = async () => {
    for (const sample of SAMPLE_PLAYBOOKS) {
      await createPlaybook(sample.title, sample.description || '', sample.steps);
    }
    loadPlaybooks();
    toast.success('Sample playbooks created');
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              AI Playbooks
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage automated workflows for your operations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/grabba/routines')}>
              <Clock className="w-4 h-4 mr-2" />
              View Routines
            </Button>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              New Playbook
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {!isLoading && playbooks.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No playbooks yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first playbook or start with sample templates
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Playbook
                </Button>
                <Button variant="outline" onClick={handleCreateSamplePlaybooks}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Load Sample Playbooks
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Playbook Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded" />
                    <div className="h-4 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks.map(playbook => (
              <Card key={playbook.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{playbook.title}</CardTitle>
                      {playbook.description && (
                        <CardDescription className="mt-1">
                          {playbook.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {playbook.steps.length} steps
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {playbook.steps.slice(0, 3).map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {i + 1}
                        </span>
                        <span className="truncate">{step.input}</span>
                        {step.requires_confirmation && (
                          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                    {playbook.steps.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-7">
                        +{playbook.steps.length - 3} more steps
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRunPlaybook(playbook)} className="flex-1">
                      <Play className="w-4 h-4 mr-1" />
                      Run
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleSchedulePlaybook(playbook)}>
                      <Calendar className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEditPlaybook(playbook)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeletePlaybook(playbook.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    Created {format(new Date(playbook.created_at), 'MMM d, yyyy')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedPlaybook ? 'Edit Playbook' : 'Create New Playbook'}
            </DialogTitle>
            <DialogDescription>
              Build a multi-step automated workflow
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Weekly Collections Sweep"
                />
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What does this playbook do?"
                  rows={2}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Steps</Label>
                  <Button size="sm" variant="outline" onClick={addStep}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Step
                  </Button>
                </div>

                <div className="space-y-3">
                  {formSteps.map((step, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 border rounded-lg bg-card">
                      <div className="flex items-center gap-2 pt-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                        <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={step.input}
                          onChange={(e) => updateStep(index, { input: e.target.value })}
                          placeholder="e.g., Find all unpaid invoices"
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`confirm-${index}`}
                            checked={step.requires_confirmation}
                            onCheckedChange={(checked) => 
                              updateStep(index, { requires_confirmation: Boolean(checked) })
                            }
                          />
                          <Label htmlFor={`confirm-${index}`} className="text-xs text-muted-foreground cursor-pointer">
                            Requires confirmation before execution
                          </Label>
                        </div>
                      </div>
                      {formSteps.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeStep(index)}
                          className="mt-1"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={selectedPlaybook ? handleSaveEdit : handleCreatePlaybook}>
              {selectedPlaybook ? 'Save Changes' : 'Create Playbook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Dialog */}
      <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Run Playbook: {selectedPlaybook?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!runResults ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This will execute all {selectedPlaybook?.steps.length} steps in sequence.
                </p>
                <div className="space-y-2">
                  {selectedPlaybook?.steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                        {i + 1}
                      </span>
                      <span className="text-sm flex-1">{step.input}</span>
                      {step.requires_confirmation && (
                        <Badge variant="outline" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Confirm
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {runResults.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  <span className="font-medium">
                    {runResults.success ? 'Playbook completed successfully' : 'Playbook completed with errors'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {runResults.totalAffected} records processed
                </p>
                <ScrollArea className="h-[200px]">
                  {runResults.stepResults.map((result: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg border mb-2"
                    >
                      {result.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm">{result.input}</p>
                        {result.error && (
                          <p className="text-xs text-destructive">{result.error}</p>
                        )}
                        {result.affectedIds?.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {result.affectedIds.length} affected
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            {!runResults ? (
              <>
                <Button variant="outline" onClick={() => setShowRunDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={executeRun} disabled={isRunning}>
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running Step {(currentStep || 0) + 1}...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Execute Now
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowRunDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Routine
            </DialogTitle>
            <DialogDescription>
              Set up automatic execution for "{selectedPlaybook?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={scheduleFrequency} onValueChange={(v: any) => setScheduleFrequency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="notify"
                checked={scheduleNotify}
                onCheckedChange={(checked) => setScheduleNotify(Boolean(checked))}
              />
              <Label htmlFor="notify" className="cursor-pointer">
                Send notification when routine completes
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={executeSchedule}>
              <Calendar className="w-4 h-4 mr-2" />
              Create Routine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GrabbaLayout>
  );
}
