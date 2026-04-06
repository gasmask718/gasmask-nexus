import { useCall } from "@/components/communication/CallProvider";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Floating call widget that appears globally when a VA call is active
 * and the user has navigated away from /va/dashboard.
 */
export function VACallWidget() {
  const { activeCall, vaCallMetadata, callDuration, isMuted, endActiveCall, toggleMuteGlobal, formatPhoneDisplay } = useCall();
  const location = useLocation();
  const navigate = useNavigate();

  const isOnVADashboard = location.pathname === "/va/dashboard";
  const isVACall = vaCallMetadata?.isVACall;

  // Only show when there's an active VA call AND we're NOT on the dashboard
  if (!activeCall || !isVACall || isOnVADashboard) return null;

  const m = Math.floor(callDuration / 60);
  const s = callDuration % 60;
  const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  const displayName = vaCallMetadata?.leadName || activeCall.entityName || formatPhoneDisplay(activeCall.destinationPhone);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-4 right-4 z-[70]"
      >
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-500/10 p-3 min-w-[280px]">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Live Call</span>
            <span className="ml-auto font-mono text-lg text-white tabular-nums">{timeStr}</span>
          </div>

          {/* Contact info */}
          <p className="text-sm text-white font-semibold truncate mb-3">{displayName}</p>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              className="h-9 w-9 rounded-full p-0"
              onClick={toggleMuteGlobal}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-9 w-9 rounded-full p-0"
              onClick={endActiveCall}
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-9 gap-1.5 text-xs border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
              onClick={() => navigate("/va/dashboard")}
            >
              <Maximize2 className="h-3 w-3" /> Return to Dialer
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
