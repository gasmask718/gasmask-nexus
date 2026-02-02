import { Truck, Bike, Users, AlertTriangle, Circle } from "lucide-react";

export function LiveMapLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur rounded-lg p-3 border border-border/50 shadow-lg">
      <h4 className="font-medium text-sm mb-2">Legend</h4>
      <div className="space-y-2 text-xs">
        {/* Workers */}
        <div className="space-y-1">
          <div className="text-muted-foreground font-medium">Workers</div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <Truck className="h-3 w-3 text-white" />
            </div>
            <span>Driver</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
              <Bike className="h-3 w-3 text-white" />
            </div>
            <span>Biker</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
              <Users className="h-3 w-3 text-white" />
            </div>
            <span>Ambassador</span>
          </div>
        </div>

        {/* Status Rings */}
        <div className="space-y-1 pt-2 border-t">
          <div className="text-muted-foreground font-medium">Status Ring</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-green-500" />
            <span>Active (fresh GPS)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-yellow-500" />
            <span>Stale (&gt;5 min)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-red-500" />
            <span>Has Alert</span>
          </div>
        </div>

        {/* Stops */}
        <div className="space-y-1 pt-2 border-t">
          <div className="text-muted-foreground font-medium">Stops</div>
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 fill-green-500 text-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 fill-gray-400 text-gray-400" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 fill-orange-500 text-orange-500" />
            <span>Skipped</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 fill-red-500 text-red-500" />
            <span>Failed</span>
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-1 pt-2 border-t">
          <div className="text-muted-foreground font-medium">Alerts</div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />
            <span>Critical (pulsing)</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-orange-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            <span>Medium/Low</span>
          </div>
        </div>
      </div>
    </div>
  );
}
