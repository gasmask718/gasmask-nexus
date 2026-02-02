import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoutes, useUpdateRoute, useDeleteRoute, useAvailablePersonnel } from "@/hooks/useRouteData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Route as RouteIcon, 
  MapPin, 
  Clock, 
  User, 
  MoreHorizontal, 
  Play, 
  CheckCircle, 
  Trash2,
  Copy,
  Zap,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = ["planned", "active", "completed", "cancelled"];
const TYPE_OPTIONS = ["driver", "biker"];

export default function AllRoutesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");

  const { data: routes = [], isLoading } = useRoutes({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    date: dateFilter || undefined,
  });
  const { data: personnel = [] } = useAvailablePersonnel();
  const updateRoute = useUpdateRoute();
  const deleteRoute = useDeleteRoute();

  const filteredRoutes = routes.filter(r =>
    r.territory?.toLowerCase().includes(search.toLowerCase()) ||
    r.assignee?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "planned": return <Badge variant="outline">Planned</Badge>;
      case "active": return <Badge className="bg-blue-500">Active</Badge>;
      case "completed": return <Badge className="bg-green-500">Completed</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "driver" 
      ? <Badge variant="outline" className="border-blue-500 text-blue-600">Driver</Badge>
      : <Badge variant="outline" className="border-cyan-500 text-cyan-600">Biker</Badge>;
  };

  const handleStatusChange = async (routeId: string, newStatus: string) => {
    await updateRoute.mutateAsync({ id: routeId, status: newStatus });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <RouteIcon className="h-6 w-6 text-primary" />
              All Routes
            </h1>
            <p className="text-muted-foreground">Route registry and management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/delivery/route-optimizer")}>
            <Zap className="h-4 w-4 mr-2" />
            AI Optimizer
          </Button>
          <Button onClick={() => navigate("/delivery/route-ops")}>
            <MapPin className="h-4 w-4 mr-2" />
            Ops Center
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search routes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-40"
          />
        </div>

        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Routes List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading routes...</div>
      ) : filteredRoutes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <RouteIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No routes found</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/delivery/route-optimizer")}>
              Generate routes with AI Optimizer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRoutes.map((route) => (
            <Card 
              key={route.id} 
              className="hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/delivery/routes/${route.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${route.is_optimized ? 'bg-primary/10' : 'bg-muted'}`}>
                      <RouteIcon className={`h-5 w-5 ${route.is_optimized ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{route.territory || "Multi-Zone"}</p>
                        {getTypeBadge(route.type)}
                        {getStatusBadge(route.status)}
                        {route.is_optimized && (
                          <Badge variant="secondary" className="gap-1">
                            <Zap className="h-3 w-3" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(route.date), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {route.assignee?.name || "Unassigned"}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {route.stops_count || 0} stops
                        </span>
                        {route.estimated_distance_km && (
                          <span>{route.estimated_distance_km.toFixed(1)} km</span>
                        )}
                        {route.estimated_duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {route.estimated_duration_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {route.optimization_score && (
                      <Badge variant="outline" className="font-mono">
                        Score: {route.optimization_score}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {route.status === "planned" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(route.id, "active")}>
                            <Play className="h-4 w-4 mr-2" />
                            Start Route
                          </DropdownMenuItem>
                        )}
                        {route.status === "active" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(route.id, "completed")}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => navigate(`/delivery/routes/${route.id}`)}>
                          <MapPin className="h-4 w-4 mr-2" />
                          View Route
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteRoute.mutate(route.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
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
