import { useState } from 'react';
import { useBusinessStore } from '@/stores/businessStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Plus, Trash2, CheckCircle, AlertCircle, MessageSquare, PhoneCall, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface PhoneNumber {
  id: string;
  phone_number: string;
  type: 'call' | 'sms' | 'both';
  provider: string;
  label: string;
  is_default: boolean;
  is_active: boolean;
  max_calls_per_minute: number;
  max_sms_per_minute: number;
  campaigns_using: number;
}

// Mock data
const mockPhoneNumbers: PhoneNumber[] = [
  {
    id: '1',
    phone_number: '+1 (555) 123-4567',
    type: 'both',
    provider: 'twilio',
    label: 'Main Line',
    is_default: true,
    is_active: true,
    max_calls_per_minute: 30,
    max_sms_per_minute: 60,
    campaigns_using: 3,
  },
  {
    id: '2',
    phone_number: '+1 (555) 234-5678',
    type: 'call',
    provider: 'twilio',
    label: 'Reactivation Dialer',
    is_default: false,
    is_active: true,
    max_calls_per_minute: 50,
    max_sms_per_minute: 0,
    campaigns_using: 2,
  },
  {
    id: '3',
    phone_number: '+1 (555) 345-6789',
    type: 'sms',
    provider: 'signalwire',
    label: 'Promo Texts',
    is_default: false,
    is_active: true,
    max_calls_per_minute: 0,
    max_sms_per_minute: 100,
    campaigns_using: 1,
  },
];

export const PhoneNumbersPage = () => {
  const { selectedBusiness } = useBusinessStore();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>(mockPhoneNumbers);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newNumber, setNewNumber] = useState<{
    phone_number: string;
    type: 'call' | 'sms' | 'both';
    provider: string;
    label: string;
    max_calls_per_minute: number;
    max_sms_per_minute: number;
  }>({
    phone_number: '',
    type: 'both',
    provider: 'twilio',
    label: '',
    max_calls_per_minute: 30,
    max_sms_per_minute: 60,
  });

  const handleAddNumber = () => {
    const newEntry: PhoneNumber = {
      id: Date.now().toString(),
      phone_number: newNumber.phone_number,
      type: newNumber.type,
      provider: newNumber.provider,
      label: newNumber.label,
      max_calls_per_minute: newNumber.max_calls_per_minute,
      max_sms_per_minute: newNumber.max_sms_per_minute,
      is_default: phoneNumbers.length === 0,
      is_active: true,
      campaigns_using: 0,
    };
    setPhoneNumbers([...phoneNumbers, newEntry]);
    setIsAddDialogOpen(false);
    setNewNumber({
      phone_number: '',
      type: 'both',
      provider: 'twilio',
      label: '',
      max_calls_per_minute: 30,
      max_sms_per_minute: 60,
    });
    toast.success('Phone number added successfully');
  };

  const handleSetDefault = (id: string) => {
    setPhoneNumbers(phoneNumbers.map(p => ({
      ...p,
      is_default: p.id === id,
    })));
    toast.success('Default number updated');
  };

  const handleToggleActive = (id: string) => {
    setPhoneNumbers(phoneNumbers.map(p => 
      p.id === id ? { ...p, is_active: !p.is_active } : p
    ));
  };

  const handleDelete = (id: string) => {
    const number = phoneNumbers.find(p => p.id === id);
    if (number?.campaigns_using > 0) {
      toast.error('Cannot delete number in use by active campaigns');
      return;
    }
    setPhoneNumbers(phoneNumbers.filter(p => p.id !== id));
    toast.success('Phone number deleted');
  };

  const handleTestNumber = (number: PhoneNumber) => {
    toast.info(`Testing ${number.phone_number}...`);
    setTimeout(() => {
      toast.success(`${number.phone_number} is working correctly`);
    }, 2000);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'call': return <Badge variant="outline" className="bg-blue-500/10 text-blue-400">Calls Only</Badge>;
      case 'sms': return <Badge variant="outline" className="bg-green-500/10 text-green-400">SMS Only</Badge>;
      default: return <Badge variant="outline" className="bg-purple-500/10 text-purple-400">Call + SMS</Badge>;
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage outbound phone numbers for {selectedBusiness?.name || 'your business'}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Number
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Phone Number</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={newNumber.phone_number}
                  onChange={(e) => setNewNumber({ ...newNumber, phone_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  placeholder="e.g., Main Line, Reactivation, Promo"
                  value={newNumber.label}
                  onChange={(e) => setNewNumber({ ...newNumber, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newNumber.type}
                  onValueChange={(v) => setNewNumber({ ...newNumber, type: v as 'call' | 'sms' | 'both' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Call + SMS</SelectItem>
                    <SelectItem value="call">Calls Only</SelectItem>
                    <SelectItem value="sms">SMS Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={newNumber.provider}
                  onValueChange={(v) => setNewNumber({ ...newNumber, provider: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="signalwire">SignalWire</SelectItem>
                    <SelectItem value="vonage">Vonage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Calls/Min</Label>
                  <Input
                    type="number"
                    value={newNumber.max_calls_per_minute}
                    onChange={(e) => setNewNumber({ ...newNumber, max_calls_per_minute: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max SMS/Min</Label>
                  <Input
                    type="number"
                    value={newNumber.max_sms_per_minute}
                    onChange={(e) => setNewNumber({ ...newNumber, max_sms_per_minute: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddNumber}>Add Number</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{phoneNumbers.length}</p>
                <p className="text-xs text-muted-foreground">Total Numbers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{phoneNumbers.filter(p => p.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <PhoneCall className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{phoneNumbers.filter(p => p.type !== 'sms').length}</p>
                <p className="text-xs text-muted-foreground">Call Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MessageSquare className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{phoneNumbers.filter(p => p.type !== 'call').length}</p>
                <p className="text-xs text-muted-foreground">SMS Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phone Numbers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Numbers</CardTitle>
          <CardDescription>Phone numbers available for outbound campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Rate Limits</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.map((number) => (
                <TableRow key={number.id}>
                  <TableCell className="font-mono">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(number.type)}
                      {number.phone_number}
                      {number.is_default && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{number.label || '-'}</TableCell>
                  <TableCell>{getTypeBadge(number.type)}</TableCell>
                  <TableCell className="capitalize">{number.provider}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      {number.type !== 'sms' && <span>{number.max_calls_per_minute} calls/min</span>}
                      {number.type === 'both' && <span> · </span>}
                      {number.type !== 'call' && <span>{number.max_sms_per_minute} sms/min</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{number.campaigns_using} active</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={number.is_active}
                        onCheckedChange={() => handleToggleActive(number.id)}
                      />
                      {number.is_active ? (
                        <span className="text-xs text-green-400">Active</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactive</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestNumber(number)}
                      >
                        Test
                      </Button>
                      {!number.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(number.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(number.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Provider Settings
          </CardTitle>
          <CardDescription>Configure your telephony provider credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border border-border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Twilio</h4>
                <Badge className="bg-green-500/10 text-green-400">Connected</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Account SID: AC***...***4f2
              </p>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
            <div className="p-4 border border-border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">SignalWire</h4>
                <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Click configure to add credentials
              </p>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhoneNumbersPage;
