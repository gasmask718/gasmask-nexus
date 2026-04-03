const TOPTIER_METRICS_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-os-metrics`;

const TOPTIER_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function fetchTopTierMetrics() {
  const res = await fetch(TOPTIER_METRICS_URL, {
    headers: {
      Authorization: `Bearer ${TOPTIER_ANON_KEY}`,
      apikey: TOPTIER_ANON_KEY,
    },
  });
  if (!res.ok) throw new Error('TopTier metrics failed');
  return res.json();
}
