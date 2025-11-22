import { navigationItems } from "@/components/layout/navigationItems";
import { realEstateNavItems } from "@/components/layout/realEstateNavigation";
import { podNavigationItems } from "@/components/layout/podNavigation";
import { callCenterNavItems } from "@/components/layout/callCenterNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SidebarDebug() {
  const { userRole } = useAuth();
  const normalizedRole = userRole?.trim().toLowerCase() || null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">🔍 Sidebar Debug Inspector</h1>
        <p className="text-muted-foreground">
          Verify navigation arrays are loaded and check role-based visibility
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current User Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Raw Role:</span>
            <Badge variant="outline">{userRole || "null"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Normalized Role:</span>
            <Badge variant="outline">{normalizedRole || "null"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Section
        title="Main Navigation"
        data={navigationItems}
        role={normalizedRole}
      />
      <Section
        title="🏢 Real Estate Department"
        data={realEstateNavItems}
        role={normalizedRole}
      />
      <Section
        title="🎨 POD Department"
        data={podNavigationItems}
        role={normalizedRole}
      />
      <Section
        title="📞 Call Center Cloud"
        data={callCenterNavItems}
        role={normalizedRole}
      />

      <Card className="bg-yellow-500/10 border-yellow-500/50">
        <CardContent className="pt-6">
          <p className="text-sm">
            <strong>Diagnosis:</strong> If a section above shows ITEMS but does NOT
            appear in the sidebar, the issue is in sidebar rendering logic, NOT roles.
          </p>
          <p className="text-sm mt-2">
            <strong>Expected:</strong> Admin should see ALL sections. Other roles should
            see only their department sections.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface SectionProps {
  title: string;
  data: any[];
  role: string | null;
}

function Section({ title, data, role }: SectionProps) {
  const filtered = data.filter(
    (item) =>
      !item.roles ||
      item.roles.length === 0 ||
      (role && item.roles.includes(role))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <div className="flex gap-2">
            <Badge variant="secondary">Total: {data.length}</Badge>
            <Badge variant="default">Visible: {filtered.length}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">All Items:</h3>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
              {JSON.stringify(
                data.map((item) => ({
                  label: item.label,
                  to: item.to,
                  roles: item.roles,
                })),
                null,
                2
              )}
            </pre>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Filtered for Current Role ({role || "none"}):
            </h3>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
              {JSON.stringify(
                filtered.map((item) => ({
                  label: item.label,
                  to: item.to,
                })),
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
