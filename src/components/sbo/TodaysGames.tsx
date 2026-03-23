import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function TodaysGames() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");

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

  async function analyzeGames() {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sbo-analyze-tonight", { body: {} });
      if (fnError) throw new Error(fnError.message);
      alert("Done! Predictions: " + (data?.predictions_created ?? 0));
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <button
          onClick={loadGames}
          disabled={loading}
          style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}
        >
          {loading ? "Loading..." : "🏀 Load Tonight's Games"}
        </button>
        <button
          onClick={analyzeGames}
          disabled={loading}
          style={{ padding: "10px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}
        >
          {loading ? "Analyzing..." : "⚡ Analyze Tonight"}
        </button>
      </div>

      {error && (
        <div style={{ color: "red", padding: "12px", background: "#fee2e2", borderRadius: 6, marginBottom: "12px" }}>
          ERROR: {error}
        </div>
      )}

      {games.length === 0 && !loading && (
        <p style={{ color: "#888" }}>No games loaded. Press Load Tonight&#39;s Games.</p>
      )}

      {games.map((game: any, i: number) => (
        <div key={i} style={{ padding: "12px", marginBottom: "8px", background: "#1e293b", borderRadius: 8, color: "#fff" }}>
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>
            {game.awayTeam} @ {game.homeTeam}
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>
            ML: {game.awayMoneyline > 0 ? "+" : ""}{game.awayMoneyline} / {game.homeMoneyline > 0 ? "+" : ""}{game.homeMoneyline}
            {" | "}Spread: {game.spread}
            {" | "}O/U: {game.total}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            {new Date(game.commenceTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET
          </div>
        </div>
      ))}

      {raw && (
        <details style={{ marginTop: "16px" }}>
          <summary style={{ cursor: "pointer", color: "#888" }}>Raw API Response</summary>
          <pre style={{ fontSize: "10px", color: "#666", overflow: "auto", maxHeight: "300px" }}>{raw}</pre>
        </details>
      )}
    </div>
  );
}
