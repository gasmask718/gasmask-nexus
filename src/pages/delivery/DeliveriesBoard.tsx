import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "@/contexts/BusinessContext";
import { useDeliveries, useDrivers, useCreateDelivery, useUpdateDelivery, type Delivery } from "@/hooks/useDeliveryData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Filter,
  Truck,
  Calendar,
  User,
  ArrowLeft,
  Download,
  MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const DELIVERY_TYPES = ["wholesale", "restock", "pickup", "dropoff", "return", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUSES = ["draft", "scheduled", "in_progress", "completed", "cancelled"];

export default function DeliveriesBoard() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    delivery_type: "restock",
    scheduled_date: format(new Date(), "yyyy-MM-dd"),
    priority: "normal",
    assigned_driver_id: "",
    dispatcher_notes: "",
  });

  const { data: deliveries = [], isLoading } = useDeliveries(businessId, { status: statusFilter || undefined });
  const { data: drivers = [] } = useDrivers(businessId);
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();

  const filteredDeliveries = deliveries.filter(d =>
    d.delivery_type.toLowerCase().includes(search.toLowerCase()) ||
    d.driver?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!businessId) return;
    await createDelivery.mutateAsync({
      ...formData,
      business_id: businessId,
      assigned_driver_id: formData.assigned_driver_id || undefined,
    });
    setCreateOpen(false);
    setFormData({
      delivery_type: "restock",
      scheduled_date: format(new Date(), "yyyy-MM-dd"),
      priority: "normal",
      assigned_driver_id: "",
      dispatcher_notes: "",
    });
  };

  const handleStatusChange = async (delivery: Delivery, newStatus: string) => {
    await updateDelivery.mutateAsync({ id: delivery.id, status: newStatus });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "scheduled": return "outline";
      case "in_progress": return "default";
      case "completed": return "default";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "normal": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Deliveries Board</h1>
            <p className="text-muted-foreground">Manage all delivery jobs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Delivery
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Delivery</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Delivery Type</Label>
                  <Select value={formData.delivery_type} onValueChange={(v) => setFormData({ ...formData, delivery_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Input 
                    type="date" 
                    value={formData.scheduled_date} 
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign Driver</Label>
                  <Select value={formData.assigned_driver_id} onValueChange={(v) => setFormData({ ...formData, assigned_driver_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver..." />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.filter(d => d.status === "active").map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dispatcher Notes</Label>
                  <Textarea 
                    value={formData.dispatcher_notes} 
                    onChange={(e) => setFormData({ ...formData, dispatcher_notes: e.target.value })}
                    placeholder="Notes for the driver..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={createDelivery.isPending}>
                    {createDelivery.isPending ? "Creating..." : "Create Delivery"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search deliveries..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deliveries List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredDeliveries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No deliveries found</p>
            <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
              Create your first delivery
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDeliveries.map((delivery) => (
            <Card 
              key={delivery.id} 
              className="hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/delivery/route/${delivery.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{delivery.delivery_type.replace("_", " ").toUpperCase()}</p>
                        <Badge variant={getPriorityColor(delivery.priority)}>{delivery.priority}</Badge>
                        <Badge variant={getStatusColor(delivery.status)}>{delivery.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(delivery.scheduled_date), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {delivery.driver?.full_name || "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {delivery.status === "draft" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(delivery, "scheduled")}>
                            Schedule Delivery
                          </DropdownMenuItem>
                        )}
                        {delivery.status === "scheduled" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(delivery, "in_progress")}>
                            Start Route
                          </DropdownMenuItem>
                        )}
                        {delivery.status === "in_progress" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(delivery, "completed")}>
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleStatusChange(delivery, "cancelled")}>
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
