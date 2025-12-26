import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PartyPopper, Calendar, Building2, Users, DollarSign, Truck, ShoppingBag, Star, Sparkles,
  UserCog, CalendarDays, FileText, ArrowRight, Clock, AlertTriangle 
} from "lucide-react";

// Staff & Operations Quick Links - HARD REQUIREMENT: Always visible
const STAFF_OPS_LINKS = [
  { label: 'Staff Management', path: '/os/unforgettable/staff', icon: UserCog, description: 'View and manage all staff' },
  { label: 'Scheduling', path: '/os/unforgettable/scheduling', icon: CalendarDays, description: 'Event-based assignments' },
  { label: 'Payroll', path: '/os/unforgettable/payroll', icon: DollarSign, description: 'Payments & compensation' },
  { label: 'Documents', path: '/os/unforgettable/documents', icon: FileText, description: 'Contracts & certifications' },
];

export default function UnforgettableDashboard() {
  const navigate = useNavigate();
  const stats = [
    { label: "Upcoming Events", value: "18", icon: Calendar, change: "+5 this week", color: "text-pink-500" },
    { label: "Event Halls", value: "6", icon: Building2, change: "3 available", color: "text-purple-500" },
    { label: "Monthly Revenue", value: "$156,000", icon: DollarSign, change: "+24%", color: "text-emerald-500" },
    { label: "Customer Rating", value: "4.8", icon: Star, change: "+0.3", color: "text-amber-500" },
  ];

  const upcomingEvents = [
    { id: "UF-001", client: "Johnson Family", type: "Quinceañera", date: "Dec 8, 2025", hall: "Grand Ballroom", guests: 250, status: "Confirmed" },
    { id: "UF-002", client: "Martinez Wedding", type: "Wedding Reception", date: "Dec 12, 2025", hall: "Crystal Hall", guests: 180, status: "Deposit Paid" },
    { id: "UF-003", client: "Tech Corp", type: "Corporate Event", date: "Dec 15, 2025", hall: "Executive Suite", guests: 100, status: "Planning" },
    { id: "UF-004", client: "Williams Baby", type: "Baby Shower", date: "Dec 18, 2025", hall: "Garden Terrace", guests: 75, status: "Confirmed" },
    { id: "UF-005", client: "Rodriguez", type: "Birthday Party", date: "Dec 20, 2025", hall: "Party Room A", guests: 50, status: "Confirmed" },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "Confirmed": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      "Deposit Paid": "bg-blue-500/10 text-blue-600 border-blue-500/20",
      "Planning": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-500 bg-clip-text text-transparent">
            Unforgettable Times USA
          </h1>
          <p className="text-muted-foreground mt-1">Event Halls, Party Planning & Wholesale Supplies</p>
        </div>
        <Button className="bg-gradient-to-r from-pink-600 to-purple-500 hover:from-pink-700 hover:to-purple-600">
          <PartyPopper className="h-4 w-4 mr-2" />
          Book Event
        </Button>
      </div>

      {/* STAFF & OPERATIONS SECTION - ALWAYS VISIBLE (HARD REQUIREMENT) */}
      <Card className="border-2 border-pink-500/30 bg-gradient-to-r from-pink-500/5 to-purple-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-pink-500" />
            Staff & Operations
            <Badge variant="outline" className="ml-auto text-xs bg-pink-500/10 text-pink-600 border-pink-500/30">
              Event Staff Management
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAFF_OPS_LINKS.map((link) => (
              <Button
                key={link.path}
                variant="outline"
                className="h-auto py-4 px-4 flex flex-col items-start gap-2 hover:bg-pink-500/10 hover:border-pink-500/50 transition-all"
                onClick={() => navigate(link.path)}
              >
                <div className="flex items-center gap-2 w-full">
                  <link.icon className="h-5 w-5 text-pink-500" />
                  <span className="font-medium text-sm">{link.label}</span>
                  <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {link.description}
                </span>
              </Button>
            ))}
          </div>
          
          {/* Staff Overview Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Active Staff</span>
              </div>
              <div className="text-2xl font-bold">47</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-pink-500 hover:text-pink-600 hover:bg-transparent"
                onClick={() => navigate('/os/unforgettable/staff')}
              >
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Assigned Today</span>
              </div>
              <div className="text-2xl font-bold">12</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-pink-500 hover:text-pink-600 hover:bg-transparent"
                onClick={() => navigate('/os/unforgettable/scheduling/today')}
              >
                View Schedule <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Upcoming</span>
              </div>
              <div className="text-2xl font-bold">28</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-pink-500 hover:text-pink-600 hover:bg-transparent"
                onClick={() => navigate('/os/unforgettable/scheduling/upcoming')}
              >
                View Upcoming <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-amber-600">Staffing Gaps</span>
              </div>
              <div className="text-2xl font-bold text-amber-600">3</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-amber-600 hover:text-amber-700 hover:bg-transparent"
                onClick={() => navigate('/os/unforgettable/scheduling/gaps')}
              >
                Resolve <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-gradient-to-br from-background to-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-emerald-500 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="events">Upcoming Events</TabsTrigger>
          <TabsTrigger value="halls">Event Halls</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="supplies">Party Supplies</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-pink-500" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Event ID</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Hall</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Guests</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEvents.map((event) => (
                      <tr key={event.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-sm">{event.id}</td>
                        <td className="p-3 font-medium">{event.client}</td>
                        <td className="p-3 text-muted-foreground">{event.type}</td>
                        <td className="p-3 text-muted-foreground">{event.date}</td>
                        <td className="p-3">{event.hall}</td>
                        <td className="p-3">{event.guests}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={getStatusBadge(event.status)}>
                            {event.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="halls">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Grand Ballroom", capacity: 500, price: "$5,000/event", available: true },
              { name: "Crystal Hall", capacity: 250, price: "$3,500/event", available: false },
              { name: "Executive Suite", capacity: 100, price: "$2,000/event", available: true },
              { name: "Garden Terrace", capacity: 150, price: "$2,500/event", available: true },
              { name: "Party Room A", capacity: 75, price: "$1,200/event", available: false },
              { name: "Party Room B", capacity: 75, price: "$1,200/event", available: true },
            ].map((hall, i) => (
              <Card key={i} className={`border-border/50 ${hall.available ? 'hover:border-pink-500/30' : 'opacity-75'} transition-colors`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/10">
                      <Building2 className="h-8 w-8 text-pink-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{hall.name}</h3>
                      <p className="text-sm text-muted-foreground">Up to {hall.capacity} guests</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-lg font-bold">{hall.price}</span>
                    <Badge variant="outline" className={hall.available ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}>
                      {hall.available ? "Available" : "Booked"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vendors">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Elite Catering", type: "Catering", rating: 4.9, events: 124 },
              { name: "DJ Supreme", type: "Entertainment", rating: 4.8, events: 89 },
              { name: "Blooms & Beyond", type: "Florals", rating: 4.9, events: 156 },
              { name: "Photo Magic", type: "Photography", rating: 4.7, events: 203 },
              { name: "Sweet Delights", type: "Bakery", rating: 4.8, events: 178 },
              { name: "Décor Dreams", type: "Decorations", rating: 4.6, events: 145 },
            ].map((vendor, i) => (
              <Card key={i} className="border-border/50 hover:border-purple-500/30 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline">{vendor.type}</Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span className="font-semibold">{vendor.rating}</span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg">{vendor.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{vendor.events} events completed</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rentals">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Tables (Round)", qty: 50, price: "$15/each" },
              { name: "Chairs (Chiavari)", qty: 300, price: "$8/each" },
              { name: "Linens (White)", qty: 100, price: "$12/each" },
              { name: "Centerpieces", qty: 40, price: "$35/each" },
              { name: "Dance Floor", qty: 3, price: "$500/each" },
              { name: "Lighting Package", qty: 5, price: "$350/package" },
              { name: "Sound System", qty: 4, price: "$400/each" },
              { name: "Tent (Large)", qty: 2, price: "$1,200/each" },
            ].map((item, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4">
                  <Truck className="h-6 w-6 text-purple-500 mb-2" />
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.qty} available</p>
                  <p className="text-lg font-bold mt-2">{item.price}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="supplies">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: "Party Bags (Bulk)", qty: 500, price: "$0.75/each" },
              { name: "Balloons (100pk)", qty: 200, price: "$25/pack" },
              { name: "Streamers", qty: 150, price: "$8/roll" },
              { name: "Confetti Packs", qty: 300, price: "$5/pack" },
              { name: "Paper Plates (50pk)", qty: 400, price: "$12/pack" },
              { name: "Napkins (100pk)", qty: 350, price: "$8/pack" },
              { name: "Cups (50pk)", qty: 450, price: "$10/pack" },
              { name: "Party Favors Mix", qty: 100, price: "$45/box" },
            ].map((item, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4">
                  <ShoppingBag className="h-6 w-6 text-pink-500 mb-2" />
                  <h3 className="font-semibold text-sm">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.qty} in stock</p>
                  <p className="text-base font-bold mt-2">{item.price}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
