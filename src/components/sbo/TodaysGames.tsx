import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function getETDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function confColor(c: number) {
  if (c >= 85) return "#22c55e";
  if (c >= 70) return "#3b82f6";
  if (c >= 55) return "#eab308";
  return "#ef4444";
}

function confTier(c: number) {
  if (c >= 85) return "Elite";
  if (c >= 70) return "Strong";
  if (c >= 55) return "Moderate";
  return "Weak";
}

function resultColor(r: string) {
  if (r === "won") return { bg: "#166534", text: "#4ade80" };
  if (r === "lost") return { bg: "#7f1d1d", text: "#f87171" };
  return { bg: "#374151", text: "#9ca3af" };
}

export default function TodaysGames() {
  const [games, setGames] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");
  const [analyzeStatus, setAnalyzeStatus] = useState("");

  async function loadGames() {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("get-todays-games", { body: {} });
      if (fnError) throw new Error(fnError.message);
      setRaw(JSON.stringify(data, null, 2));
      setGames(data?.games ?? []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadPicks() {
    try {
      const { data: p } = await supabase
        .from("sbo_saved_picks")
        .select("*")
        .eq("pick_date", getETDate())
        .order("confidence", { ascending: false });
      setPicks(p ?? []);
    } catch (_) {}
  }

  async function analyzeGames() {
    setLoading(true);
    setError("");
    setAnalyzeStatus("Analyzing...");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sbo-analyze-tonight", { body: {} });
      if (fnError) throw new Error(fnError.message);
      setAnalyzeStatus(`⚡ Done — ${data?.predictions_created ?? 0} Picks Saved`);
      await loadPicks();
      await loadGames();
    } catch (e: any) {
      setError(String(e));
      setAnalyzeStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={loadGames} disabled={loading}
          style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
          {loading && !analyzeStatus ? "Loading..." : "🏀 Load Tonight's Games"}
        </button>
        <button onClick={analyzeGames} disabled={loading}
          style={{ padding: "10px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
          {loading && analyzeStatus ? "Analyzing..." : analyzeStatus || "⚡ Analyze Tonight"}
        </button>
        <button onClick={loadPicks} disabled={loading}
          style={{ padding: "10px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
          📋 Load Picks
        </button>
      </div>

      {error && (
        <div style={{ color: "#fca5a5", padding: "12px", background: "#450a0a", borderRadius: 6, marginBottom: "12px" }}>
          ERROR: {error}
        </div>
      )}

      {games.length === 0 && !loading && <p style={{ color: "#888" }}>No games loaded. Press Load Tonight&#39;s Games.</p>}

      {games.map((game: any, i: number) => (
        <div key={i} style={{ padding: "12px", marginBottom: "8px", background: "#1e293b", borderRadius: 8, color: "#fff" }}>
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>
            {game.awayTeam} @ {game.homeTeam}
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>
            ML: {game.awayMoneyline > 0 ? "+" : ""}{game.awayMoneyline} / {game.homeMoneyline > 0 ? "+" : ""}{game.homeMoneyline}
            {" | "}Spread: {game.spread}{" | "}O/U: {game.total}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            {new Date(game.commenceTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET
          </div>
        </div>
      ))}

      {picks.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: "bold", marginBottom: "12px" }}>
            🎯 Today's AI Picks ({picks.length})
          </h3>
          {picks.map((pick: any) => {
            const conf = pick.confidence ?? 0;
            const res = resultColor(pick.result ?? "pending");
            return (
              <div key={pick.id} style={{ padding: "14px", marginBottom: "10px", background: "#0f172a", borderRadius: 10, border: `1px solid ${confColor(conf)}33`, color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontWeight: "bold", fontSize: "15px" }}>{pick.label}</span>
                  <span style={{ fontSize: "24px", fontWeight: "bold", color: confColor(conf) }}>{conf}%</span>
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "11px", fontWeight: "bold", background: confColor(conf), color: "#000" }}>
                    {confTier(conf)}
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "11px", fontWeight: "bold", background: res.bg, color: res.text }}>
                    {(pick.result ?? "pending").toUpperCase()}
                  </span>
                  {pick.odds && (
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "11px", background: "#1e293b", color: "#94a3b8" }}>
                      {pick.odds > 0 ? "+" : ""}{pick.odds}
                    </span>
                  )}
                </div>
                {pick.detail && <div style={{ fontSize: "13px", color: "#94a3b8" }}>{pick.detail}</div>}
              </div>
            );
          })}
        </div>
      )}

      {raw && (
        <details style={{ marginTop: "16px" }}>
          <summary style={{ cursor: "pointer", color: "#888" }}>Raw API Response</summary>
          <pre style={{ fontSize: "10px", color: "#666", overflow: "auto", maxHeight: "300px" }}>{raw}</pre>
        </details>
      )}
    </div>
  );
}
