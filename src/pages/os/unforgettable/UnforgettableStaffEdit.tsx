import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useStaffMember, useUpdateStaff, useStaffCategories } from '@/hooks/useUnforgettableStaff';
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
  status: string;
  payType: string;
  payRate: string;
  preferredContactMethod: string;
  availabilityNotes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
}

export default function UnforgettableStaffEdit() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const { data: staff, isLoading, error } = useStaffMember(staffId);
  const { data: categories } = useStaffCategories();
  const updateStaff = useUpdateStaff();
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<StaffFormData>();

  useEffect(() => {
    if (staff) {
      reset({
        firstName: staff.first_name,
        lastName: staff.last_name,
        email: staff.email || '',
        phone: staff.phone || '',
        categoryId: staff.category_id || '',
        dob: staff.dob || '',
        addressLine1: staff.address_line_1 || '',
        addressLine2: staff.address_line_2 || '',
        city: staff.city || '',
        state: staff.state || '',
        zip: staff.zip || '',
        status: staff.status,
        payType: staff.pay_type || '',
        payRate: staff.pay_rate?.toString() || '',
        preferredContactMethod: staff.preferred_contact_method || '',
        availabilityNotes: staff.availability_notes || '',
        emergencyContactName: staff.emergency_contact_name || '',
        emergencyContactPhone: staff.emergency_contact_phone || '',
        notes: staff.notes || '',
      });
    }
  }, [staff, reset]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h3 className="font-semibold">Staff member not found</h3>
              <p className="text-muted-foreground">The requested staff profile could not be loaded.</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/os/unforgettable/staff')} className="ml-auto">
              Back to Staff List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSubmit = async (formData: StaffFormData) => {
    if (!staffId) return;

    try {
      await updateStaff.mutateAsync({
        id: staffId,
        data: {
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
          status: formData.status as 'active' | 'inactive' | 'pending' | 'on_leave' | 'terminated',
          pay_type: formData.payType || undefined,
          pay_rate: formData.payRate ? parseFloat(formData.payRate) : undefined,
          preferred_contact_method: formData.preferredContactMethod || undefined,
          availability_notes: formData.availabilityNotes || undefined,
          emergency_contact_name: formData.emergencyContactName || undefined,
          emergency_contact_phone: formData.emergencyContactPhone || undefined,
          notes: formData.notes || undefined,
        },
      });
      navigate(`/os/unforgettable/staff/${staffId}`);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const displayName = `${staff.first_name} ${staff.last_name}`;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/os/unforgettable/staff/${staffId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Edit: {displayName}
              {simulationMode && <SimulationBadge />}
            </h1>
            <p className="text-muted-foreground">Update staff member information</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role & Status */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Role & Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <Select value={watch('categoryId')} onValueChange={(value) => setValue('categoryId', value, { shouldDirty: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={watch('status')} onValueChange={(value) => setValue('status', value, { shouldDirty: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" {...register('firstName', { required: 'Required' })} />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" {...register('lastName', { required: 'Required' })} />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input id="dob" type="date" {...register('dob', { required: 'Required' })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1 *</Label>
                <Input id="addressLine1" {...register('addressLine1', { required: 'Required' })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" {...register('addressLine2')} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" {...register('city', { required: 'Required' })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={watch('state')} onValueChange={(value) => setValue('state', value, { shouldDirty: true })}>
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
                  <Input id="zip" {...register('zip', { required: 'Required' })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" type="tel" {...register('phone', { required: 'Required' })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredContactMethod">Preferred Contact Method</Label>
                <Select value={watch('preferredContactMethod')} onValueChange={(value) => setValue('preferredContactMethod', value, { shouldDirty: true })}>
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
                    <Input id="emergencyContactName" {...register('emergencyContactName')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">Phone</Label>
                    <Input id="emergencyContactPhone" type="tel" {...register('emergencyContactPhone')} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pay & Operations */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pay & Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payType">Pay Type</Label>
                  <Select value={watch('payType')} onValueChange={(value) => setValue('payType', value, { shouldDirty: true })}>
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
                  <Input id="payRate" type="number" step="0.01" {...register('payRate')} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="availabilityNotes">Availability Notes</Label>
                  <Input id="availabilityNotes" {...register('availabilityNotes')} />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea id="notes" rows={3} {...register('notes')} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate(`/os/unforgettable/staff/${staffId}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateStaff.isPending || !isDirty}>
            {updateStaff.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
