import { useSecurityProtocol } from "@/hooks/useSecurityProtocol";
import { Navigate } from "react-router-dom";
import { Lock } from "lucide-react";

export default function OwnerInternal() {
  const { isOwner } = useSecurityProtocol();
  
  if (!isOwner()) {
    return <Navigate to="/os/sports-betting" replace />;
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Lock className="h-6 w-6 text-amber-500" />
        <h1 className="text-3xl font-bold">Internal Dashboard</h1>
      </div>
      <p className="text-muted-foreground">Owner-only analytics and intelligence.</p>
    </div>
  );
}
