import React, { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { navigationItems } from "@/components/layout/navigationItems";
import { realEstateNavItems } from "@/components/layout/realEstateNavigation";
import { podNavigationItems } from "@/components/layout/podNavigation";
import { callCenterNavItems } from "@/components/layout/callCenterNavigation";

export default function SidebarVisualTest() {
  const { role, roles } = useUserRole();

  const [simRole, setSimRole] = useState<string | null>(null);

  const activeRole = simRole || role || "none";
  const normalizedRole = activeRole?.toLowerCase().trim();

  const filter = (items: any[]) =>
    items.filter((item) => !item.roles || item.roles.includes(normalizedRole));

  const filteredMain = filter(navigationItems);
  const filteredRealEstate = filter(realEstateNavItems);
  const filteredPOD = filter(podNavigationItems);
  const filteredCallCenter = filter(callCenterNavItems);

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">🧭 Sidebar Visual Test</h1>

      <div className="bg-gray-900 p-4 rounded-md border border-gray-700 mb-6">
        <h2 className="text-xl font-semibold mb-2">Role Debug</h2>
        <p>Detected Role: <strong>{role}</strong></p>
        <p>Available Roles: {JSON.stringify(roles)}</p>
        <p>Simulated Role: <strong>{simRole || "none"}</strong></p>
        <p>Normalized Role: <strong>{normalizedRole}</strong></p>

        <div className="mt-4">
          <label className="text-sm">Simulate Role:</label>
          <select
            className="bg-black border border-gray-500 rounded p-1 ml-2"
            value={simRole || ""}
            onChange={(e) => setSimRole(e.target.value || null)}
          >
            <option value="">(Use actual user role)</option>
            <option value="admin">admin</option>
            <option value="realestate_worker">realestate_worker</option>
            <option value="pod_worker">pod_worker</option>
            <option value="callcenter_worker">callcenter_worker</option>
            <option value="driver">driver</option>
            <option value="biker">biker</option>
            <option value="clerk">clerk</option>
          </select>
        </div>
      </div>

      {/** SHOW RAW ARRAYS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ArrayBlock title="Main Navigation (Raw)" data={navigationItems} />
        <ArrayBlock title="Real Estate Dept (Raw)" data={realEstateNavItems} />
        <ArrayBlock title="POD Dept (Raw)" data={podNavigationItems} />
        <ArrayBlock title="Call Center Cloud (Raw)" data={callCenterNavItems} />
      </div>

      {/** FILTERED RESULTS */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">Filtered Output</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ArrayBlock title="Main Navigation (Filtered)" data={filteredMain} />
        <ArrayBlock title="Real Estate (Filtered)" data={filteredRealEstate} />
        <ArrayBlock title="POD Dept (Filtered)" data={filteredPOD} />
        <ArrayBlock title="Call Center (Filtered)" data={filteredCallCenter} />
      </div>

      {/** EXPECTED SUMMARY */}
      <div className="bg-gray-900 p-4 rounded-md border border-gray-700 mt-10">
        <h2 className="text-xl font-semibold mb-2">Summary</h2>
        <p>• If your role = <b>admin</b>, ALL sections should be non-empty.</p>
        <p>• If a section is empty, the issue is in the roles field of the nav array.</p>
        <p>• Use this page to confirm navigationItems are loaded & role filtering works.</p>
      </div>
    </div>
  );
}

function ArrayBlock({ title, data }: any) {
  return (
    <div className="bg-gray-800 p-4 rounded-md border border-gray-700">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <pre className="text-xs whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
