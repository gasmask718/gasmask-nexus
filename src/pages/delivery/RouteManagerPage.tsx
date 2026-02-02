import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRouteStats, useRoutes } from "@/hooks/useRouteData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Route as RouteIcon, 
  Zap, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Activity
} from "lucide-react";
import { format, addDays } from "date-fns";

export default function RouteManagerPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];

  const { data: todayStats } = useRouteStats({ from: today, to: today });
  const { data: tomorrowRoutes = [] } = useRoutes({ date: tomorrow });
  const { data: activeRoutes = [] } = useRoutes({ status: "active" });

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
              <Navigation className="h-6 w-6 text-primary" />
              Route Manager
            </h1>
            <p className="text-muted-foreground">Plan, optimize, and execute delivery routes</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <RouteIcon className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{todayStats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Routes Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{todayStats?.completed || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Activity className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{todayStats?.active || 0}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Clock className="h-4 w-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{todayStats?.planned || 0}</p>
                <p className="text-xs text-muted-foreground">Planned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <MapPin className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{todayStats?.totalDistance?.toFixed(0) || 0}</p>
                <p className="text-xs text-muted-foreground">Total km</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{todayStats?.avgOptimizationScore || 0}</p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => navigate("/delivery/routes/all")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RouteIcon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              All Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View, edit, and manage all routes. Filter by status, type, date, or territory.
            </p>
            <div className="flex gap-2">
              <Badge variant="outline">{todayStats?.byType?.driver || 0} Driver</Badge>
              <Badge variant="outline">{todayStats?.byType?.biker || 0} Biker</Badge>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors group bg-gradient-to-br from-primary/5 to-primary/10"
          onClick={() => navigate("/delivery/route-optimizer")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              Route Optimizer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              AI-powered route generation based on urgency, proximity, and driver availability.
            </p>
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" />
              Smart Clustering
            </Badge>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => navigate("/delivery/route-ops")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              Ops Center
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Real-time route execution, driver performance, and live operations control.
            </p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-green-600 border-green-500">{activeRoutes.length} Active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Routes & Tomorrow Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Routes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              Active Routes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/delivery/routes/all?status=active")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {activeRoutes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No active routes</p>
            ) : (
              <div className="space-y-3">
                {activeRoutes.slice(0, 5).map((route) => (
                  <div 
                    key={route.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/delivery/routes/${route.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <RouteIcon className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">{route.territory || "Multi-Zone"}</p>
                        <p className="text-sm text-muted-foreground">
                          {route.assignee?.name || "Unassigned"} • {route.stops_count || 0} stops
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tomorrow's Routes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Tomorrow's Routes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/delivery/route-optimizer")}>
              Generate More
            </Button>
          </CardHeader>
          <CardContent>
            {tomorrowRoutes.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-muted-foreground">No routes planned for tomorrow</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => navigate("/delivery/route-optimizer")}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Routes
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tomorrowRoutes.slice(0, 5).map((route) => (
                  <div 
                    key={route.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/delivery/routes/${route.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <RouteIcon className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">{route.territory || "Multi-Zone"}</p>
                        <p className="text-sm text-muted-foreground">
                          {route.assignee?.name || "Unassigned"} • {route.stops_count || 0} stops
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">Planned</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
