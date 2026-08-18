// READ-ONLY audit of Twilio recordings produced by the VA power-dialer path
// (browser Voice SDK -> brandaro-call-twiml -> <Dial record="record-from-answer-dual">).
// Lists recordings on the account, their duration, and the counterparty number/state.
// It deletes NOTHING. Kept as a diagnostic; safe to re-run.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NPA -> state (geographic NPAs only; mobiles port, so this is a hint not a fact).
const NPA_STATE: Record<string, string> = {
  "212": "NY", "718": "NY", "347": "NY", "646": "NY", "917": "NY", "929": "NY", "516": "NY", "631": "NY", "914": "NY", "845": "NY", "585": "NY", "716": "NY", "315": "NY", "518": "NY", "607": "NY",
  "787": "PR", "939": "PR",
  "213": "CA", "310": "CA", "323": "CA", "408": "CA", "415": "CA", "424": "CA", "510": "CA", "530": "CA", "559": "CA", "562": "CA", "619": "CA", "626": "CA", "650": "CA", "661": "CA", "707": "CA", "714": "CA", "747": "CA", "760": "CA", "805": "CA", "818": "CA", "831": "CA", "858": "CA", "909": "CA", "916": "CA", "925": "CA", "949": "CA", "951": "CA",
  "305": "FL", "786": "FL", "954": "FL", "754": "FL", "561": "FL", "407": "FL", "321": "FL", "813": "FL", "727": "FL", "904": "FL", "850": "FL", "941": "FL", "239": "FL", "352": "FL", "386": "FL", "772": "FL",
  "201": "NJ", "551": "NJ", "609": "NJ", "732": "NJ", "848": "NJ", "856": "NJ", "862": "NJ", "908": "NJ", "973": "NJ",
  "215": "PA", "267": "PA", "412": "PA", "484": "PA", "610": "PA", "717": "PA", "724": "PA", "814": "PA", "878": "PA",
  "202": "DC", "240": "MD", "301": "MD", "410": "MD", "443": "MD", "667": "MD",
  "203": "CT", "475": "CT", "860": "CT", "959": "CT",
  "617": "MA", "857": "MA", "781": "MA", "339": "MA", "508": "MA", "774": "MA", "978": "MA", "351": "MA", "413": "MA",
  "312": "IL", "773": "IL", "872": "IL", "630": "IL", "708": "IL", "847": "IL", "224": "IL",
  "704": "NC", "980": "NC", "919": "NC", "984": "NC", "336": "NC", "743": "NC", "252": "NC", "828": "NC", "910": "NC",
  "214": "TX", "469": "TX", "972": "TX", "713": "TX", "281": "TX", "832": "TX", "346": "TX", "512": "TX", "737": "TX", "210": "TX", "726": "TX", "817": "TX", "682": "TX", "915": "TX", "361": "TX", "409": "TX", "903": "TX", "940": "TX", "956": "TX", "979": "TX",
  "404": "GA", "470": "GA", "678": "GA", "770": "GA", "706": "GA", "762": "GA", "912": "GA", "229": "GA", "478": "GA",
  "702": "NV", "725": "NV", "775": "NV",
  "206": "WA", "253": "WA", "425": "WA", "360": "WA", "509": "WA", "564": "WA",
  "503": "OR", "971": "OR", "541": "OR", "458": "OR",
  "602": "AZ", "480": "AZ", "623": "AZ", "520": "AZ", "928": "AZ",
  "216": "OH", "614": "OH", "440": "OH", "330": "OH", "513": "OH", "937": "OH", "419": "OH", "740": "OH",
  "313": "MI", "248": "MI", "586": "MI", "734": "MI", "616": "MI", "810": "MI", "906": "MI", "989": "MI", "947": "MI",
  "804": "VA", "703": "VA", "571": "VA", "757": "VA", "540": "VA", "434": "VA", "276": "VA",
  "615": "TN", "629": "TN", "901": "TN", "423": "TN", "865": "TN", "731": "TN", "931": "TN",
  "502": "KY", "859": "KY", "270": "KY", "606": "KY",
  "803": "SC", "843": "SC", "864": "SC", "854": "SC",
  "317": "IN", "812": "IN", "260": "IN", "574": "IN", "765": "IN", "930": "IN",
  "314": "MO", "816": "MO", "417": "MO", "573": "MO", "636": "MO",
  "612": "MN", "651": "MN", "763": "MN", "952": "MN", "218": "MN", "507": "MN", "320": "MN",
  "414": "WI", "608": "WI", "262": "WI", "920": "WI", "715": "WI", "534": "WI",
  "303": "CO", "720": "CO", "970": "CO", "719": "CO",
  "801": "UT", "385": "UT", "435": "UT",
  "504": "LA", "225": "LA", "318": "LA", "337": "LA", "985": "LA",
  "205": "AL", "251": "AL", "256": "AL", "334": "AL", "659": "AL", "938": "AL",
  "601": "MS", "662": "MS", "769": "MS", "228": "MS",
  "501": "AR", "479": "AR", "870": "AR",
  "405": "OK", "918": "OK", "539": "OK", "580": "OK",
  "402": "NE", "308": "NE", "531": "NE",
  "515": "IA", "319": "IA", "563": "IA", "641": "IA", "712": "IA",
  "316": "KS", "620": "KS", "785": "KS", "913": "KS",
  "505": "NM", "575": "NM",
  "208": "ID", "986": "ID", "406": "MT", "307": "WY", "701": "ND", "605": "SD",
  "302": "DE", "401": "RI", "603": "NH", "802": "VT", "207": "ME",
  "304": "WV", "681": "WV", "808": "HI", "907": "AK",
};

// All-party (two-party) consent states for call recording.
const ALL_PARTY = new Set(["CA", "MD", "PA", "IL", "FL", "MA", "MI", "MT", "NH", "WA", "CT", "DE", "OR", "NV", "PR"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const candidates = [
    ["BRANDARO_TWILIO_ACCOUNT_SID", "BRANDARO_TWILIO_AUTH_TOKEN"],
    ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  ];

  let sid = "", token = "", used = "";
  for (const [s, t] of candidates) {
    const sv = (Deno.env.get(s) || "").trim();
    const tv = (Deno.env.get(t) || "").trim();
    if (sv.startsWith("AC") && tv) { sid = sv; token = tv; used = s; break; }
  }
  if (!sid) {
    return new Response(JSON.stringify({ error: "no usable twilio creds" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = `Basic ${btoa(`${sid}:${token}`)}`;
  const recordings: any[] = [];
  let url: string | null =
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings.json?PageSize=1000`;
  let pages = 0;
  while (url && pages < 10) {
    const r: Response = await fetch(url, { headers: { Authorization: auth } });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `twilio ${r.status}`, body: (await r.text()).slice(0, 400), account: sid, cred: used }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await r.json();
    recordings.push(...(j.recordings || []));
    url = j.next_page_uri ? `https://api.twilio.com${j.next_page_uri}` : null;
    pages++;
  }

  // Enrich with the parent call's To/From so we can attribute a counterparty state.
  const detail: any[] = [];
  for (const rec of recordings) {
    let to = "", from = "", callDir = "";
    try {
      const cr = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${rec.call_sid}.json`,
        { headers: { Authorization: auth } },
      );
      if (cr.ok) {
        const c = await cr.json();
        to = c.to || ""; from = c.from || ""; callDir = c.direction || "";
      }
    } catch (_) { /* best effort */ }

    const counterparty = to || from;
    const npa = (counterparty.replace(/\D/g, "").replace(/^1/, "") || "").slice(0, 3);
    const state = NPA_STATE[npa] || "unknown";
    detail.push({
      sid: rec.sid,
      call_sid: rec.call_sid,
      date_created: rec.date_created,
      duration_s: Number(rec.duration || 0),
      channels: rec.channels,
      to, from, direction: callDir,
      npa, state, all_party_consent_state: ALL_PARTY.has(state),
    });
  }

  const byState: Record<string, number> = {};
  let totalSeconds = 0;
  for (const d of detail) {
    byState[d.state] = (byState[d.state] || 0) + 1;
    totalSeconds += d.duration_s;
  }

  return new Response(JSON.stringify({
    account: sid, cred_used: used,
    total_recordings: detail.length,
    total_seconds: totalSeconds,
    total_minutes: Math.round(totalSeconds / 6) / 10,
    longest_s: detail.reduce((m, d) => Math.max(m, d.duration_s), 0),
    by_state: byState,
    all_party_count: detail.filter((d) => d.all_party_consent_state).length,
    dual_channel_count: detail.filter((d) => Number(d.channels) === 2).length,
    recordings: detail,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
