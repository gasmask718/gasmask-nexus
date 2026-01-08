import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Building2, Shield, X, Plus, Loader2 } from 'lucide-react';
import { useSendCRMInvite, type CRMAccessRole } from '@/hooks/useCRMAccess';
import { toast } from 'sonner';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CRMAssignment {
  crmId: string;
  crmName: string;
  accessRole: CRMAccessRole;
}

export function InviteUserModal({ open, onOpenChange }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [assignments, setAssignments] = useState<CRMAssignment[]>([]);
  const [selectedCrm, setSelectedCrm] = useState('');
  const [selectedRole, setSelectedRole] = useState<CRMAccessRole>('view');

  const sendInvite = useSendCRMInvite();

  // Email validation helper
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = email.trim().length > 0 && emailRegex.test(email.trim());
  
  // Form validity check
  const isFormValid = isValidEmail && assignments.length > 0;

  // Fetch all businesses (CRMs)
  const { data: businesses = [], isLoading: businessesLoading } = useQuery({
    queryKey: ['invite-modal-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const availableCRMs = businesses.filter(
    (b) => !assignments.find((a) => a.crmId === b.id)
  );

  const handleAddAssignment = () => {
    if (!selectedCrm) return;
    
    const crm = businesses.find((b) => b.id === selectedCrm);
    if (!crm) return;

    setAssignments([
      ...assignments,
      {
        crmId: crm.id,
        crmName: crm.name,
        accessRole: selectedRole,
      },
    ]);
    setSelectedCrm('');
    setSelectedRole('view');
  };

  const handleRemoveAssignment = (crmId: string) => {
    setAssignments(assignments.filter((a) => a.crmId !== crmId));
  };

  const handleUpdateRole = (crmId: string, newRole: CRMAccessRole) => {
    setAssignments(
      assignments.map((a) =>
        a.crmId === crmId ? { ...a, accessRole: newRole } : a
      )
    );
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      if (!email.trim()) {
        toast.error('Please enter an email address');
      } else if (!isValidEmail) {
        toast.error('Please enter a valid email address');
      } else if (assignments.length === 0) {
        toast.error('Please assign at least one CRM');
      }
      return;
    }

    try {
      await sendInvite.mutateAsync({
        email: email.trim(),
        crmAssignments: assignments.map((a) => ({
          crmId: a.crmId,
          accessRole: a.accessRole,
        })),
        notes: notes.trim() || undefined,
      });

      // Reset form and close
      setEmail('');
      setNotes('');
      setAssignments([]);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getRoleBadgeVariant = (role: CRMAccessRole) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'edit':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite User to CRMs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              An invitation link will be sent to this email
            </p>
          </div>

          {/* CRM Assignment Section */}
          <div className="space-y-3">
            <Label>CRM Access Assignments *</Label>
            
            {/* Add new assignment */}
            <Card className="p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Select CRM</Label>
                  <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a CRM..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCRMs.map((crm) => (
                        <SelectItem key={crm.id} value={crm.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {crm.name}
                          </div>
                        </SelectItem>
                      ))}
                      {availableCRMs.length === 0 && (
                        <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                          All CRMs assigned
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as CRMAccessRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View Only</SelectItem>
                      <SelectItem value="edit">Edit</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleAddAssignment}
                  disabled={!selectedCrm}
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* Assigned CRMs list */}
            {assignments.length > 0 && (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <Card key={assignment.crmId} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{assignment.crmName}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Select 
                            value={assignment.accessRole}
                            onValueChange={(v) => handleUpdateRole(assignment.crmId, v as CRMAccessRole)}
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">View Only</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveAssignment(assignment.crmId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {assignments.length === 0 && (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No CRM access assigned yet</p>
                <p className="text-xs">Add at least one CRM above</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this invitation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Summary */}
          {assignments.length > 0 && (
            <Card className="p-4 bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Invitation Summary</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Email: <span className="text-foreground">{email || 'Not set'}</span></p>
                <p>CRMs: <span className="text-foreground">{assignments.length}</span></p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {assignments.map((a) => (
                    <Badge key={a.crmId} variant={getRoleBadgeVariant(a.accessRole)}>
                      {a.crmName} ({a.accessRole})
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={sendInvite.isPending || !isFormValid}
          >
            {sendInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
