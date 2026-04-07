import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Phone, CheckCircle, Flame, Sun, Snowflake, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SessionStats {
  callsDialed: number;
  callsAnswered: number;
  callsClosed: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  avgDurationSeconds: number;
}

interface VASessionSummaryProps {
  stats: SessionStats;
  onClose: () => void;
}

export function VASessionSummary({ stats, onClose }: VASessionSummaryProps) {
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const answerRate = stats.callsDialed > 0 ? Math.round((stats.callsAnswered / stats.callsDialed) * 100) : 0;
  const closeRate = stats.callsAnswered > 0 ? Math.round((stats.callsClosed / stats.callsAnswered) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md"
        >
          <Card className="glass-card border-border/50 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-foreground text-lg flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--success) / 0.15)" }}>
                  <CheckCircle className="h-4.5 w-4.5" style={{ color: "hsl(var(--success))" }} />
                </div>
                Session Complete
              </CardTitle>
              <Button size="icon" variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              {/* Main Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Phone, label: "Dialed", value: stats.callsDialed, accent: "hsl(var(--hud-cyan))" },
                  { icon: Phone, label: "Answered", value: stats.callsAnswered, accent: "hsl(var(--success))" },
                  { icon: CheckCircle, label: "Closed", value: stats.callsClosed, accent: "hsl(var(--hud-amber))" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    className="rounded-xl bg-accent/30 p-4 text-center"
                  >
                    <stat.icon className="h-4 w-4 mx-auto mb-2" style={{ color: stat.accent }} />
                    <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Rates */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex gap-3"
              >
                {[
                  { label: "Answer Rate", value: `${answerRate}%`, accent: "hsl(var(--hud-cyan))" },
                  { label: "Close Rate", value: `${closeRate}%`, accent: "hsl(var(--success))" },
                  { label: "Avg Duration", value: formatDuration(stats.avgDurationSeconds), accent: "hsl(var(--muted-foreground))" },
                ].map((rate) => (
                  <div key={rate.label} className="flex-1 rounded-xl bg-accent/20 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums" style={{ color: rate.accent }}>{rate.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{rate.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Excitement Breakdown */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex gap-2 justify-center"
              >
                <Badge variant="outline" className="gap-1.5 px-3 py-1 border-red-500/20 bg-red-500/10 text-red-400">
                  <Flame className="h-3.5 w-3.5" /> {stats.hotCount} HOT
                </Badge>
                <Badge variant="outline" className="gap-1.5 px-3 py-1 border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Sun className="h-3.5 w-3.5" /> {stats.warmCount} WARM
                </Badge>
                <Badge variant="outline" className="gap-1.5 px-3 py-1 border-blue-500/20 bg-blue-500/10 text-blue-400">
                  <Snowflake className="h-3.5 w-3.5" /> {stats.coldCount} COLD
                </Badge>
              </motion.div>

              <Button onClick={onClose} className="w-full" size="lg">
                Close Summary
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
