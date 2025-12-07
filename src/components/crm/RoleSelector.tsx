import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useCustomerRoles, useAddCustomerRole } from "@/hooks/useCustomerRoles";

interface RoleSelectorProps {
  value?: string;
  onValueChange: (roleId: string) => void;
  placeholder?: string;
}

export function RoleSelector({ value, onValueChange, placeholder = "Select Role" }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  
  const { data: roles, isLoading } = useCustomerRoles();
  const addRole = useAddCustomerRole();

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    
    const result = await addRole.mutateAsync(newRoleName.trim());
    if (result) {
      onValueChange(result.id);
      setNewRoleName("");
      setOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-10 flex items-center justify-center border rounded-md">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {roles?.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.role_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" type="button">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Enter role name..."
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddRole()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRole} disabled={!newRoleName.trim() || addRole.isPending}>
              {addRole.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
