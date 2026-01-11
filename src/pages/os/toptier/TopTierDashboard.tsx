import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard } from "lucide-react";
import { TopTierCommandDashboard } from "@/components/toptier/TopTierCommandDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Car, Gift, DollarSign, Star } from "lucide-react";

export default function TopTierDashboard() {
  const stats = [
    { label: "Active Bookings", value: "24", icon: Calendar, change: "+12%", color: "text-blue-500" },
    { label: "Fleet Vehicles", value: "8", icon: Car, change: "+2", color: "text-emerald-500" },
    { label: "This Month Revenue", value: "$42,500", icon: DollarSign, change: "+18%", color: "text-amber-500" },
    { label: "Customer Rating", value: "4.9", icon: Star, change: "+0.2", color: "text-purple-500" },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">
            TopTier Experience OS
          </h1>
          <p className="text-muted-foreground mt-1">Luxury Black Truck, Roses & Premium Gifting Services</p>
        </div>
        <Button className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600">
          <Calendar className="h-4 w-4 mr-2" />
          New Booking
        </Button>
      </div>

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

      {/* Main Content Tabs */}
      <Tabs defaultValue="operations" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="operations" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Operations KPIs
          </TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="gifts">Gift Packages</TabsTrigger>
        </TabsList>

        {/* Operations KPIs Tab - Command Dashboard */}
        <TabsContent value="operations">
          <TopTierCommandDashboard />
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                Recent Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Bookings will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["Black Escalade #1", "Black Escalade #2", "Mercedes Sprinter", "Lincoln Navigator", "Rolls Royce Ghost", "Black Suburban"].map((vehicle, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10">
                      <Car className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{vehicle}</h3>
                      <p className="text-sm text-muted-foreground">Available</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Active</Badge>
                    <Badge variant="outline">Premium</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="services">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "Black Truck + Roses", price: "$1,200", desc: "Luxury black truck arrival with rose arrangements" },
              { name: "VIP Proposal Package", price: "$3,500", desc: "Complete proposal experience with photographer" },
              { name: "Anniversary Special", price: "$2,500", desc: "Romantic evening with dinner reservations" },
              { name: "Birthday Surprise", price: "$1,800", desc: "Birthday celebration package with gifts" },
            ].map((service, i) => (
              <Card key={i} className="border-border/50 hover:border-amber-500/30 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{service.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{service.desc}</p>
                    </div>
                    <span className="text-2xl font-bold text-amber-500">{service.price}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="gifts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Rose Bouquet Deluxe", price: "$250", stock: 45 },
              { name: "Champagne & Chocolates", price: "$180", stock: 32 },
              { name: "Jewelry Box Collection", price: "$500", stock: 12 },
              { name: "Teddy Bear Premium", price: "$85", stock: 67 },
              { name: "Spa Day Voucher", price: "$350", stock: 25 },
              { name: "Custom Gift Basket", price: "$275", stock: 18 },
            ].map((gift, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <Gift className="h-8 w-8 text-amber-500 mb-3" />
                  <h3 className="font-semibold">{gift.name}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-lg font-bold">{gift.price}</span>
                    <span className="text-sm text-muted-foreground">{gift.stock} in stock</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}