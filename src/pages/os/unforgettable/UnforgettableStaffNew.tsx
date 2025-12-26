import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus, ArrowLeft, Save, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useStaffCategories, useCreateStaffCategory, useCreateStaff, type CreateStaffData } from '@/hooks/useUnforgettableStaff';
import { SimulationBadge } from '@/contexts/SimulationModeContext';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

interface StaffFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  categoryId: string;
  dob: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  payType: string;
  payRate: string;
  preferredContactMethod: string;
  availabilityNotes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
}

export default function UnforgettableStaffNew() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const { data: categories, isLoading: loadingCategories } = useStaffCategories();
  const createCategory = useCreateStaffCategory();
  const createStaff = useCreateStaff();
  
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<StaffFormData>();
  const selectedCategory = watch('categoryId');

  const onSubmit = async (formData: StaffFormData) => {
    if (!formData.categoryId) {
      toast.error('Please select a role category');
      return;
    }

    const staffData: CreateStaffData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email || undefined,
      phone: formData.phone,
      category_id: formData.categoryId,
      dob: formData.dob,
      address_line_1: formData.addressLine1,
      address_line_2: formData.addressLine2 || undefined,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
      pay_type: formData.payType || undefined,
      pay_rate: formData.payRate ? parseFloat(formData.payRate) : undefined,
      preferred_contact_method: formData.preferredContactMethod || undefined,
      availability_notes: formData.availabilityNotes || undefined,
      emergency_contact_name: formData.emergencyContactName || undefined,
      emergency_contact_phone: formData.emergencyContactPhone || undefined,
      notes: formData.notes || undefined,
    };

    try {
      const result = await createStaff.mutateAsync(staffData);
      navigate(`/os/unforgettable/staff/${result.id}`);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      const newCategory = await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      
      setValue('categoryId', newCategory.id);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setAddCategoryOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="h-8 w-8 text-primary" />
            Add Staff Member
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Add a new staff member to the Unforgettable Times team</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/os/unforgettable/staff')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role Category */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Role Category</CardTitle>
              <CardDescription>Select or create a staff role category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="categoryId">Category *</Label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={(value) => setValue('categoryId', value)}
                    disabled={loadingCategories}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingCategories ? "Loading..." : "Select role category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Staff Category</DialogTitle>
                      <DialogDescription>
                        Create a new staff role category for Unforgettable Times
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="catName">Category Name *</Label>
                        <Input
                          id="catName"
                          placeholder="e.g., Face Painter"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="catDesc">Description</Label>
                        <Input
                          id="catDesc"
                          placeholder="Brief description of this role"
                          value={newCategoryDescription}
                          onChange={(e) => setNewCategoryDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAddCategoryOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="button" 
                        onClick={handleAddCategory}
                        disabled={createCategory.isPending}
                      >
                        {createCategory.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                        ) : (
                          'Create Category'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Basic details about the staff member</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    {...register('firstName', { required: 'First name is required' })}
                  />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    {...register('lastName', { required: 'Last name is required' })}
                  />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input
                  id="dob"
                  type="date"
                  {...register('dob', { required: 'Date of birth is required' })}
                />
                {errors.dob && <p className="text-xs text-destructive">{errors.dob.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1 *</Label>
                <Input
                  id="addressLine1"
                  placeholder="123 Main Street"
                  {...register('addressLine1', { required: 'Address is required' })}
                />
                {errors.addressLine1 && <p className="text-xs text-destructive">{errors.addressLine1.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  placeholder="Apt 4B"
                  {...register('addressLine2')}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="Miami"
                    {...register('city', { required: 'City is required' })}
                  />
                  {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select onValueChange={(value) => setValue('state', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP *</Label>
                  <Input
                    id="zip"
                    placeholder="33101"
                    {...register('zip', { required: 'ZIP code is required' })}
                  />
                  {errors.zip && <p className="text-xs text-destructive">{errors.zip.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>How to reach this staff member</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  {...register('phone', { required: 'Phone is required' })}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@email.com"
                  {...register('email')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredContactMethod">Preferred Contact Method</Label>
                <Select onValueChange={(value) => setValue('preferredContactMethod', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="text">Text Message</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactName">Name</Label>
                    <Input
                      id="emergencyContactName"
                      placeholder="Jane Doe"
                      {...register('emergencyContactName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">Phone</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      placeholder="+1 (555) 987-6543"
                      {...register('emergencyContactPhone')}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pay & Operations */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pay & Operations</CardTitle>
              <CardDescription>Compensation and availability details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payType">Pay Type</Label>
                  <Select onValueChange={(value) => setValue('payType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                      <SelectItem value="per_event">Per Event</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payRate">Pay Rate ($)</Label>
                  <Input
                    id="payRate"
                    type="number"
                    step="0.01"
                    placeholder="25.00"
                    {...register('payRate')}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="availabilityNotes">Availability Notes</Label>
                  <Input
                    id="availabilityNotes"
                    placeholder="e.g., Weekends only, Evenings preferred"
                    {...register('availabilityNotes')}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information about this staff member..."
                  rows={3}
                  {...register('notes')}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/os/unforgettable/staff')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createStaff.isPending}>
            {createStaff.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Staff Member</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
