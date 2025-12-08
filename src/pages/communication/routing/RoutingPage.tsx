import DepartmentRoutingPanel from "@/components/communication/DepartmentRoutingPanel";

export default function RoutingPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Department Routing</h2>
      <DepartmentRoutingPanel />
    </div>
  );
}
