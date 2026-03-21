import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowRight, Check, Plus, X, Zap, Info } from 'lucide-react';
import { TRIGGER_TYPES, CONDITION_TYPES, ACTION_TYPES, PLAYBOOK_VARIABLES } from '@/lib/playbooks/playbookConstants';
import {
  useCreatePlaybookMutation,
  useUpdatePlaybookMutation,
  CommunicationPlaybook,
} from '@/hooks/useCommunicationPlaybooks';

interface Props {
  playbook: CommunicationPlaybook | null;
  open: boolean;
  onClose: () => void;
}

export function PlaybookBuilderSheet({ playbook, open, onClose }: Props) {
  const createMutation = useCreatePlaybookMutation();
  const updateMutation = useUpdatePlaybookMutation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(playbook?.name || '');
  const [description, setDescription] = useState(playbook?.description || '');
  const [triggerType, setTriggerType] = useState(playbook?.trigger_type || '');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>(playbook?.trigger_config || {});
  const [conditions, setConditions] = useState<any[]>(playbook?.conditions || []);
  const [actions, setActions] = useState<any[]>(playbook?.actions || []);

  // Reset on open
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStep(1);
      setName(playbook?.name || '');
      setDescription(playbook?.description || '');
      setTriggerType(playbook?.trigger_type || '');
      setTriggerConfig(playbook?.trigger_config || {});
      setConditions(playbook?.conditions || []);
      setActions(playbook?.actions || []);
    } else {
      onClose();
    }
  };

  const triggerDef = TRIGGER_TYPES.find(t => t.value === triggerType);

  const handleSave = () => {
    const payload = {
      name,
      description: description || null,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      conditions,
      actions,
      status: 'active' as const,
    };

    if (playbook?.id) {
      updateMutation.mutate({ id: playbook.id, updates: payload }, { onSuccess: onClose });
    } else {
      createMutation.mutate(payload, { onSuccess: onClose });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{playbook ? 'Edit Playbook' : 'New Playbook'}</SheetTitle>
        </SheetHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4 mb-6">
          {([1, 2, 3] as const).map(s => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
                step === s
                  ? 'bg-primary text-primary-foreground font-medium'
                  : s < step
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground bg-muted/50'
              }`}
            >
              {s < step ? <Check className="h-3 w-3" /> : <span>{s}</span>}
              {s === 1 ? 'Trigger' : s === 2 ? 'Conditions' : 'Actions'}
            </button>
          ))}
        </div>

        {/* Step 1: Trigger */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Playbook Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. No Answer Re-Engagement" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">When should this playbook fire?</Label>
              <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-1">
                {TRIGGER_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTriggerType(t.value)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      triggerType === t.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <p className="text-xs font-medium">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {triggerDef?.config_fields?.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs">{field.label}</Label>
                <Input
                  type={field.type}
                  value={triggerConfig[field.key] ?? field.default ?? ''}
                  onChange={e => setTriggerConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
            <Button className="w-full" onClick={() => setStep(2)} disabled={!triggerType || !name}>
              Next: Conditions <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Conditions */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Conditions are optional. All conditions must pass (AND logic) for the playbook to run.
            </p>
            {conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={cond.type}
                  onValueChange={v => {
                    const updated = [...conditions];
                    updated[i] = { ...updated[i], type: v, operator: 'equals' };
                    setConditions(updated);
                  }}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPES.map(c => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const condDef = CONDITION_TYPES.find(c => c.value === cond.type);
                  if (condDef && 'values' in condDef && condDef.values) {
                    return (
                      <Select
                        value={cond.value || ''}
                        onValueChange={v => {
                          const updated = [...conditions];
                          updated[i] = { ...updated[i], value: v };
                          setConditions(updated);
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="Value" />
                        </SelectTrigger>
                        <SelectContent>
                          {condDef.values.map(v => (
                            <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  return (
                    <Input
                      value={cond.value || ''}
                      onChange={e => {
                        const updated = [...conditions];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setConditions(updated);
                      }}
                      className="flex-1 h-8 text-xs"
                      placeholder="Value"
                    />
                  );
                })()}
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 flex-shrink-0"
                  onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => setConditions([...conditions, { type: 'phone_type_is', operator: 'equals', value: 'mobile' }])}
            >
              <Plus className="w-3 h-3" /> Add Condition
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next: Actions <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Actions */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Actions execute in order. Use {'{{variable}}'} for dynamic content.
              </p>
              <VariablePicker />
            </div>

            {actions.map((action, i) => {
              const actionDef = ACTION_TYPES.find(a => a.value === action.type);
              return (
                <Card key={i} className="border">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">Step {i + 1}</Badge>
                        <Select
                          value={action.type}
                          onValueChange={v => {
                            const updated = [...actions];
                            updated[i] = { type: v, config: {} };
                            setActions(updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map(a => (
                              <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7"
                        onClick={() => setActions(actions.filter((_, j) => j !== i))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {actionDef?.config_fields?.map(field => (
                      <div key={field.key}>
                        <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                        {field.type === 'textarea' ? (
                          <Textarea
                            value={action.config?.[field.key] ?? (field as any).default ?? ''}
                            onChange={e => {
                              const updated = [...actions];
                              updated[i] = { ...updated[i], config: { ...updated[i].config, [field.key]: e.target.value } };
                              setActions(updated);
                            }}
                            rows={2}
                            className="text-xs mt-1"
                            placeholder={field.supports_variables ? 'Use {{variable}} for dynamic content' : ''}
                          />
                        ) : field.type === 'select' ? (
                          <Select
                            value={String(action.config?.[field.key] ?? (field as any).default ?? '')}
                            onValueChange={v => {
                              const updated = [...actions];
                              updated[i] = { ...updated[i], config: { ...updated[i].config, [field.key]: v } };
                              setActions(updated);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(field as any).options?.map((opt: string) => (
                                <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type || 'text'}
                            value={action.config?.[field.key] ?? (field as any).default ?? ''}
                            onChange={e => {
                              const updated = [...actions];
                              updated[i] = { ...updated[i], config: { ...updated[i].config, [field.key]: e.target.value } };
                              setActions(updated);
                            }}
                            className="h-7 text-xs mt-1"
                          />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => setActions([...actions, { type: 'send_sms', config: {} }])}
            >
              <Plus className="w-3 h-3" /> Add Action
            </Button>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button
                onClick={handleSave}
                className="flex-1"
                disabled={!actions.length || isSaving}
              >
                {isSaving ? 'Saving...' : playbook ? 'Update Playbook' : 'Create Playbook'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function VariablePicker() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1">
          <Info className="h-3 w-3" /> Variables
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <p className="text-[10px] font-medium text-muted-foreground mb-2">Available Variables</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {Object.entries(PLAYBOOK_VARIABLES).map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between text-[10px]">
              <code className="bg-muted px-1 py-0.5 rounded text-[9px]">{key}</code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
