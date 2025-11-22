import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Plus, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PhoneNumbers() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNumber, setNewNumber] = useState({
    phone_number: '',
    business_name: '',
    label: '',
    type: 'both' as 'call' | 'sms' | 'both'
  });
  
  const queryClient = useQueryClient();

  const { data: phoneNumbers, isLoading } = useQuery({
    queryKey: ['call-center-phone-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_phone_numbers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const addNumberMutation = useMutation({
    mutationFn: async (numberData: typeof newNumber) => {
      const { error } = await supabase
        .from('call_center_phone_numbers')
        .insert([numberData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-center-phone-numbers'] });
      toast.success('Phone number added successfully');
      setIsAddOpen(false);
      setNewNumber({ phone_number: '', business_name: '', label: '', type: 'both' });
    },
    onError: () => {
      toast.error('Failed to add phone number');
    }
  });

  const deleteNumberMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('call_center_phone_numbers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-center-phone-numbers'] });
      toast.success('Phone number deleted');
    },
    onError: () => {
      toast.error('Failed to delete phone number');
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phone Numbers</h1>
          <p className="text-muted-foreground">Manage phone numbers across all businesses</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Number
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Phone Number</DialogTitle>
              <DialogDescription>
                Add a new phone number to the call center system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 000-0000"
                  value={newNumber.phone_number}
                  onChange={(e) => setNewNumber({ ...newNumber, phone_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="business">Business</Label>
                <Select
                  value={newNumber.business_name}
                  onValueChange={(value) => setNewNumber({ ...newNumber, business_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GasMask">GasMask</SelectItem>
                    <SelectItem value="GasMask Wholesale">GasMask Wholesale</SelectItem>
                    <SelectItem value="Hot Mama">Hot Mama</SelectItem>
                    <SelectItem value="TopTier Transport">TopTier Transport</SelectItem>
                    <SelectItem value="PlayBoxxx">PlayBoxxx</SelectItem>
                    <SelectItem value="Real Estate">Real Estate</SelectItem>
                    <SelectItem value="POD Department">POD Department</SelectItem>
                    <SelectItem value="Funding">Funding</SelectItem>
                    <SelectItem value="Cleaning">Cleaning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  placeholder="Main Support Line"
                  value={newNumber.label}
                  onChange={(e) => setNewNumber({ ...newNumber, label: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={newNumber.type}
                  onValueChange={(value: 'call' | 'sms' | 'both') => setNewNumber({ ...newNumber, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Calls Only</SelectItem>
                    <SelectItem value="sms">SMS Only</SelectItem>
                    <SelectItem value="both">Calls & SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => addNumberMutation.mutate(newNumber)}
                disabled={!newNumber.phone_number || !newNumber.business_name || !newNumber.label}
                className="w-full"
              >
                Add Phone Number
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading phone numbers...</p>
            </CardContent>
          </Card>
        ) : phoneNumbers && phoneNumbers.length > 0 ? (
          phoneNumbers.map((number) => (
            <Card key={number.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{number.phone_number}</CardTitle>
                      <CardDescription>{number.label}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteNumberMutation.mutate(number.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Business</p>
                    <p className="font-medium">{number.business_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{number.type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">{number.is_active ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">AI Agent</p>
                    <p className="font-medium">{number.default_ai_agent_id ? 'Assigned' : 'None'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No phone numbers added yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}