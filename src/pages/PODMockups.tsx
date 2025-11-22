import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image, Shirt, Package, Phone } from "lucide-react";

export default function PODMockups() {
  const mockupTypes = [
    { name: "T-Shirts", icon: Shirt, count: 0 },
    { name: "Hoodies", icon: Shirt, count: 0 },
    { name: "Posters", icon: Image, count: 0 },
    { name: "Phone Cases", icon: Phone, count: 0 },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Mockup Generator</h1>
        <p className="text-muted-foreground">
          Auto-generate lifestyle and product mockups
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockupTypes.map((type) => (
          <Card key={type.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{type.name}</CardTitle>
              <type.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{type.count}</div>
              <p className="text-xs text-muted-foreground mt-1">mockups generated</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 text-center py-12">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Mockup generation coming soon. Generate designs first!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
