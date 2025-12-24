import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "@/contexts/BusinessContext";
import { useDrivers, useCreateDriver, useUpdateDriver, type Driver } from "@/hooks/useDeliveryData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  ArrowLeft,
  User,
  Phone,
  Mail,
  Car,
  MoreHorizontal
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const VEHICLE_TYPES = ["sedan", "suv", "van", "truck", "sprinter", "other"];
const STATUSES = ["active", "paused", "offboarded"];
const PAYOUT_METHODS = ["cash", "zelle", "ach", "other"];

export default function DriversManagement() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    vehicle_type: "sedan",
    license_number: "",
    home_base: "",
    status: "active",
    payout_method: "zelle",
    payout_handle: "",
  });

  const { data: drivers = [], isLoading } = useDrivers(businessId);
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();

  const filteredDrivers = drivers.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.phone?.includes(search) ||
    d.email?.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      vehicle_type: "sedan",
      license_number: "",
      home_base: "",
      status: "active",
      payout_method: "zelle",
      payout_handle: "",
    });
  };

  const handleCreate = async () => {
    if (!businessId || !formData.full_name) return;
    await createDriver.mutateAsync({
      ...formData,
      business_id: businessId,
    });
    setCreateOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editDriver) return;
    await updateDriver.mutateAsync({
      id: editDriver.id,
      ...formData,
    });
    setEditDriver(null);
    resetForm();
  };

  const openEdit = (driver: Driver) => {
    setFormData({
      full_name: driver.full_name,
      phone: driver.phone || "",
      email: driver.email || "",
      vehicle_type: driver.vehicle_type || "sedan",
      license_number: driver.license_number || "",
      home_base: driver.home_base || "",
      status: driver.status,
      payout_method: driver.payout_method || "zelle",
      payout_handle: driver.payout_handle || "",
    });
    setEditDriver(driver);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "paused": return "secondary";
      case "offboarded": return "destructive";
      default: return "secondary";
    }
  };

  const DriverForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Full Name *</Label>
          <Input 
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input 
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input 
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Vehicle Type</Label>
          <Select value={formData.vehicle_type} onValueChange={(v) => setFormData({ ...formData, vehicle_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>License Number</Label>
          <Input 
            value={formData.license_number}
            onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Home Base</Label>
          <Input 
            value={formData.home_base}
            onChange={(e) => setFormData({ ...formData, home_base: e.target.value })}
            placeholder="Brooklyn, NY"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payout Method</Label>
          <Select value={formData.payout_method} onValueChange={(v) => setFormData({ ...formData, payout_method: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYOUT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Payout Handle</Label>
          <Input 
            value={formData.payout_handle}
            onChange={(e) => setFormData({ ...formData, payout_handle: e.target.value })}
            placeholder="Zelle email or phone, ACH account..."
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={() => isEdit ? setEditDriver(null) : setCreateOpen(false)}>Cancel</Button>
        <Button onClick={isEdit ? handleUpdate : handleCreate} disabled={!formData.full_name || createDriver.isPending || updateDriver.isPending}>
          {isEdit ? "Save Changes" : "Create Driver"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Drivers</h1>
            <p className="text-muted-foreground">Manage your delivery drivers</p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
            </DialogHeader>
            <DriverForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search drivers..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Drivers Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredDrivers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No drivers found</p>
            <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
              Add your first driver
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => (
            <Card key={driver.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{driver.full_name}</p>
                      <Badge variant={getStatusColor(driver.status)}>{driver.status}</Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(driver)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateDriver.mutate({ id: driver.id, status: driver.status === "active" ? "paused" : "active" })}>
                        {driver.status === "active" ? "Pause" : "Activate"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2 text-sm">
                  {driver.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {driver.phone}
                    </div>
                  )}
                  {driver.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {driver.email}
                    </div>
                  )}
                  {driver.vehicle_type && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="h-4 w-4" />
                      {driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDriver} onOpenChange={(open) => !open && setEditDriver(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogHeader>
          <DriverForm isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
}
