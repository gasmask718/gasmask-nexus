import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Key, Zap } from "lucide-react";

export default function PODSettings() {
  const integrations = [
    { name: "Printify", status: "Not Connected" },
    { name: "Printful", status: "Not Connected" },
    { name: "AOP+", status: "Not Connected" },
    { name: "Gelato", status: "Not Connected" },
    { name: "Midjourney", status: "Not Connected" },
    { name: "InVideo", status: "Not Connected" },
    { name: "TikTok API", status: "Not Connected" },
    { name: "Meta Business", status: "Not Connected" },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Settings & Integrations</h1>
        <p className="text-muted-foreground">
          Configure POD services and API connections
        </p>
      </div>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys & Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <div className="font-medium">{integration.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {integration.status}
                  </div>
                </div>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
                  Configure
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automation Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">AI Design Generation</div>
              <div className="text-sm text-muted-foreground">
                Auto-generate designs daily
              </div>
            </div>
            <button className="px-4 py-2 bg-green-500 text-white rounded-md text-sm">
              Enabled
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Winner Scaling</div>
              <div className="text-sm text-muted-foreground">
                Auto-scale high performers
              </div>
            </div>
            <button className="px-4 py-2 bg-green-500 text-white rounded-md text-sm">
              Enabled
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Auto Upload</div>
              <div className="text-sm text-muted-foreground">
                Upload approved designs automatically
              </div>
            </div>
            <button className="px-4 py-2 bg-gray-400 text-white rounded-md text-sm">
              Disabled
            </button>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center">
              <span>Default Design Category</span>
              <select className="border rounded px-3 py-1">
                <option>Evergreen</option>
                <option>Holiday</option>
                <option>Hot Mama</option>
                <option>GasMask</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span>Mockup Style</span>
              <select className="border rounded px-3 py-1">
                <option>Urban Lifestyle</option>
                <option>Studio Product</option>
                <option>Seasonal</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span>Video Voice</span>
              <select className="border rounded px-3 py-1">
                <option>Default Female</option>
                <option>Default Male</option>
                <option>Energetic</option>
                <option>Professional</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
