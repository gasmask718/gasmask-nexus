import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COSTS = {
  ai_decision_per_call: 0.008,
  ai_scoring_per_lead: 0.001,
  google_places_per_search: 0.004,
  get total_per_search() {
    return this.google_places_per_search + this.ai_scoring_per_lead * 8;
  },
};

// All 50 states with cities, market tier, and service business index
const STATE_CITIES: Record<string, { cities: string[]; market_tier: 1 | 2 | 3; population_density: string; service_business_index: number }> = {
  NY: { cities: ["Brooklyn","Bronx","Queens","Staten Island","Yonkers","Buffalo","Rochester","Syracuse","Albany","New Rochelle","Mount Vernon","Schenectady","White Plains","Hempstead","Troy","Niagara Falls","Binghamton","Freeport","Valley Stream","Levittown","Hicksville","Uniondale","Elmont","Spring Valley","New City","Middletown","Poughkeepsie"], market_tier: 1, population_density: "very high", service_business_index: 95 },
  NJ: { cities: ["Newark","Jersey City","Paterson","Elizabeth","Edison","Woodbridge","Lakewood","Toms River","Hamilton","Trenton","Clifton","Camden","Brick","Cherry Hill","Passaic","Union City","Old Bridge","Bayonne","East Orange","Vineland","Atlantic City","Hoboken","Perth Amboy","Hackensack","Sayreville","Kearny","Linden","New Brunswick","Plainfield"], market_tier: 1, population_density: "very high", service_business_index: 92 },
  FL: { cities: ["Miami","Orlando","Tampa","Jacksonville","Fort Lauderdale","Hialeah","Tallahassee","Cape Coral","St Petersburg","Port St Lucie","Pembroke Pines","Hollywood","Miramar","Gainesville","Coral Springs","Miami Gardens","West Palm Beach","Clearwater","Brandon","Spring Hill","Lakeland","Pompano Beach","Davie","Boca Raton","Deltona","Deerfield Beach","Palm Bay","Sunrise","Plantation","Kissimmee","Homestead","Boynton Beach"], market_tier: 1, population_density: "high", service_business_index: 90 },
  TX: { cities: ["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Laredo","Lubbock","Garland","Irving","Amarillo","Grand Prairie","McKinney","Frisco","Brownsville","Pasadena","Mesquite","Killeen","McAllen","Waco","Carrollton","Denton","Midland","Abilene","Beaumont","Round Rock","Odessa","Richardson","Pearland","Sugar Land"], market_tier: 1, population_density: "high", service_business_index: 88 },
  CA: { cities: ["Los Angeles","San Diego","San Jose","San Francisco","Fresno","Sacramento","Long Beach","Oakland","Bakersfield","Anaheim","Santa Ana","Stockton","Riverside","Chula Vista","Irvine","Fremont","San Bernardino","Modesto","Fontana","Moreno Valley","Glendale","Huntington Beach","Santa Clarita","Garden Grove","Oceanside","Rancho Cucamonga","Santa Rosa","Ontario","Elk Grove","Corona","Hayward","Salinas"], market_tier: 1, population_density: "high", service_business_index: 85 },
  GA: { cities: ["Atlanta","Augusta","Columbus","Macon","Savannah","Athens","Sandy Springs","Roswell","Albany","Johns Creek","Warner Robins","Alpharetta","Marietta","Smyrna","Valdosta","Brookhaven","Dunwoody","Newnan","South Fulton","Gainesville","Peachtree City","Kennesaw","Rome","Woodstock","Dalton","Canton"], market_tier: 2, population_density: "medium", service_business_index: 82 },
  PA: { cities: ["Philadelphia","Pittsburgh","Allentown","Erie","Reading","Scranton","Bethlehem","Lancaster","York","Harrisburg","Altoona","State College","Wilkes-Barre","Chester","Easton","Lebanon","Hazleton","New Castle","McKeesport","Norristown"], market_tier: 2, population_density: "medium", service_business_index: 80 },
  IL: { cities: ["Chicago","Aurora","Joliet","Naperville","Rockford","Springfield","Elgin","Peoria","Champaign","Waukegan","Cicero","Bloomington","Arlington Heights","Evanston","Schaumburg","Bolingbrook","Palatine","Skokie","Des Plaines","Orland Park"], market_tier: 2, population_density: "medium", service_business_index: 82 },
  OH: { cities: ["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton","Parma","Canton","Youngstown","Lorain","Hamilton","Springfield","Kettering","Elyria","Newark","Lakewood","Cuyahoga Falls","Middletown","Euclid","Mansfield"], market_tier: 2, population_density: "medium", service_business_index: 78 },
  NC: { cities: ["Charlotte","Raleigh","Greensboro","Durham","Winston-Salem","Fayetteville","Cary","Wilmington","High Point","Greenville","Asheville","Concord","Gastonia","Jacksonville","Chapel Hill","Rocky Mount","Burlington","Wilson","Huntersville","Kannapolis"], market_tier: 2, population_density: "medium", service_business_index: 80 },
  MI: { cities: ["Detroit","Grand Rapids","Warren","Sterling Heights","Lansing","Ann Arbor","Flint","Dearborn","Livonia","Westland","Troy","Farmington Hills","Kalamazoo","Wyoming","Southfield","Rochester Hills","Taylor","Pontiac","St Clair Shores","Royal Oak"], market_tier: 2, population_density: "medium", service_business_index: 76 },
  VA: { cities: ["Virginia Beach","Norfolk","Chesapeake","Richmond","Newport News","Alexandria","Hampton","Roanoke","Portsmouth","Suffolk","Lynchburg","Harrisonburg","Charlottesville","Danville","Manassas","Fredericksburg"], market_tier: 2, population_density: "medium", service_business_index: 78 },
  WA: { cities: ["Seattle","Spokane","Tacoma","Vancouver","Bellevue","Kent","Everett","Renton","Spokane Valley","Kirkland","Bellingham","Kennewick","Yakima","Redmond","Federal Way","Marysville","South Hill","Shoreline"], market_tier: 2, population_density: "medium", service_business_index: 75 },
  AZ: { cities: ["Phoenix","Tucson","Mesa","Chandler","Scottsdale","Glendale","Gilbert","Tempe","Peoria","Surprise","Yuma","Avondale","Goodyear","Flagstaff","Buckeye","Casa Grande","Lake Havasu City"], market_tier: 2, population_density: "medium", service_business_index: 77 },
  MD: { cities: ["Baltimore","Frederick","Rockville","Gaithersburg","Bowie","Hagerstown","Annapolis","College Park","Salisbury","Laurel","Greenbelt","Cumberland","Germantown","Silver Spring","Waldorf","Dundalk"], market_tier: 2, population_density: "medium", service_business_index: 79 },
  CT: { cities: ["Bridgeport","New Haven","Stamford","Hartford","Waterbury","Norwalk","Danbury","New Britain","West Hartford","Greenwich","Hamden","Bristol","Meriden","Manchester","West Haven"], market_tier: 2, population_density: "medium", service_business_index: 76 },
  MA: { cities: ["Boston","Worcester","Springfield","Lowell","Cambridge","New Bedford","Brockton","Quincy","Lynn","Fall River","Newton","Lawrence","Somerville","Framingham","Haverhill","Waltham","Malden","Brookline"], market_tier: 2, population_density: "high", service_business_index: 78 },
  TN: { cities: ["Memphis","Nashville","Knoxville","Chattanooga","Clarksville","Murfreesboro","Franklin","Jackson","Johnson City","Bartlett","Hendersonville","Kingsport","Collierville","Smyrna","Cleveland"], market_tier: 3, population_density: "medium", service_business_index: 75 },
  CO: { cities: ["Denver","Colorado Springs","Aurora","Fort Collins","Lakewood","Thornton","Arvada","Westminster","Pueblo","Centennial","Boulder","Highlands Ranch","Greeley","Longmont","Loveland"], market_tier: 3, population_density: "medium", service_business_index: 73 },
  SC: { cities: ["Columbia","Charleston","North Charleston","Mount Pleasant","Rock Hill","Greenville","Summerville","Goose Creek","Hilton Head","Sumter","Florence","Spartanburg","Myrtle Beach","Aiken","Anderson"], market_tier: 3, population_density: "medium", service_business_index: 74 },
  AL: { cities: ["Birmingham","Montgomery","Huntsville","Mobile","Tuscaloosa","Hoover","Dothan","Auburn","Decatur","Madison","Florence","Gadsden","Vestavia Hills","Prattville"], market_tier: 3, population_density: "medium", service_business_index: 72 },
  LA: { cities: ["New Orleans","Baton Rouge","Shreveport","Metairie","Lafayette","Lake Charles","Kenner","Bossier City","Monroe","Alexandria","Prairieville","Central"], market_tier: 3, population_density: "medium", service_business_index: 70 },
  KY: { cities: ["Louisville","Lexington","Bowling Green","Owensboro","Covington","Richmond","Georgetown","Florence","Elizabethtown","Henderson","Nicholasville","Jeffersontown"], market_tier: 3, population_density: "low", service_business_index: 68 },
  MO: { cities: ["Kansas City","St Louis","Springfield","Columbia","Independence","Lee Summit","O Fallon","St Joseph","St Charles","Blue Springs","Joplin","Florissant"], market_tier: 3, population_density: "low", service_business_index: 70 },
  IN: { cities: ["Indianapolis","Fort Wayne","Evansville","South Bend","Carmel","Fishers","Bloomington","Hammond","Gary","Lafayette","Muncie","Terre Haute","Noblesville","Greenwood"], market_tier: 3, population_density: "low", service_business_index: 70 },
  WI: { cities: ["Milwaukee","Madison","Green Bay","Kenosha","Racine","Appleton","Waukesha","Oshkosh","Eau Claire","Janesville","West Allis","La Crosse"], market_tier: 3, population_density: "low", service_business_index: 68 },
  MN: { cities: ["Minneapolis","St Paul","Rochester","Duluth","Bloomington","Brooklyn Park","Plymouth","Maple Grove","Woodbury","St Cloud","Eagan","Eden Prairie"], market_tier: 3, population_density: "low", service_business_index: 68 },
  NV: { cities: ["Las Vegas","Henderson","Reno","North Las Vegas","Sparks","Carson City","Summerlin","Spring Valley","Enterprise","Sunrise Manor"], market_tier: 3, population_density: "medium", service_business_index: 72 },
  OR: { cities: ["Portland","Salem","Eugene","Gresham","Hillsboro","Beaverton","Bend","Medford","Springfield","Corvallis","Albany","Tigard"], market_tier: 3, population_density: "low", service_business_index: 68 },
  OK: { cities: ["Oklahoma City","Tulsa","Norman","Broken Arrow","Lawton","Edmond","Moore","Midwest City","Enid","Stillwater","Muskogee","Bartlesville"], market_tier: 3, population_density: "low", service_business_index: 70 },
  AR: { cities: ["Little Rock","Fort Smith","Fayetteville","Springdale","Jonesboro","North Little Rock","Conway","Rogers","Pine Bluff","Bentonville"], market_tier: 3, population_density: "low", service_business_index: 68 },
  MS: { cities: ["Jackson","Gulfport","Southaven","Hattiesburg","Biloxi","Meridian","Tupelo","Greenville","Olive Branch"], market_tier: 3, population_density: "low", service_business_index: 65 },
  KS: { cities: ["Wichita","Overland Park","Kansas City","Olathe","Topeka","Lawrence","Shawnee","Manhattan","Salina"], market_tier: 3, population_density: "low", service_business_index: 65 },
  UT: { cities: ["Salt Lake City","West Valley City","Provo","West Jordan","Sandy","Orem","Ogden","St George","Layton","South Jordan","Lehi"], market_tier: 3, population_density: "low", service_business_index: 67 },
  NM: { cities: ["Albuquerque","Las Cruces","Rio Rancho","Santa Fe","Roswell","Farmington","Clovis","Hobbs","Alamogordo"], market_tier: 3, population_density: "low", service_business_index: 63 },
  NE: { cities: ["Omaha","Lincoln","Bellevue","Grand Island","Kearney","Fremont","Norfolk","Hastings","North Platte"], market_tier: 3, population_density: "low", service_business_index: 62 },
  WV: { cities: ["Charleston","Huntington","Morgantown","Parkersburg","Wheeling","Weirton","Fairmont","Martinsburg","Beckley"], market_tier: 3, population_density: "low", service_business_index: 60 },
  HI: { cities: ["Honolulu","Hilo","Kailua","Pearl City","Waipahu","Kaneohe","Mililani","Kahului","Kihei"], market_tier: 3, population_density: "medium", service_business_index: 70 },
  ID: { cities: ["Boise","Meridian","Nampa","Idaho Falls","Pocatello","Caldwell","Coeur d Alene","Twin Falls"], market_tier: 3, population_density: "low", service_business_index: 62 },
  ME: { cities: ["Portland","Lewiston","Bangor","South Portland","Auburn","Biddeford","Sanford","Augusta","Saco"], market_tier: 3, population_density: "low", service_business_index: 60 },
  NH: { cities: ["Manchester","Nashua","Concord","Derry","Dover","Rochester","Salem","Merrimack","Londonderry"], market_tier: 3, population_density: "low", service_business_index: 62 },
  RI: { cities: ["Providence","Warwick","Cranston","Pawtucket","East Providence","Woonsocket","Newport","Central Falls"], market_tier: 3, population_density: "high", service_business_index: 68 },
  DE: { cities: ["Wilmington","Dover","Newark","Middletown","Bear","Glasgow","Brookside","Pike Creek"], market_tier: 3, population_density: "medium", service_business_index: 65 },
  MT: { cities: ["Billings","Missoula","Great Falls","Bozeman","Butte","Helena","Kalispell","Havre"], market_tier: 3, population_density: "very low", service_business_index: 55 },
  SD: { cities: ["Sioux Falls","Rapid City","Aberdeen","Brookings","Watertown","Mitchell"], market_tier: 3, population_density: "very low", service_business_index: 55 },
  ND: { cities: ["Fargo","Bismarck","Grand Forks","Minot","West Fargo","Mandan"], market_tier: 3, population_density: "very low", service_business_index: 52 },
  AK: { cities: ["Anchorage","Fairbanks","Juneau","Sitka","Ketchikan","Wasilla"], market_tier: 3, population_density: "very low", service_business_index: 58 },
  WY: { cities: ["Cheyenne","Casper","Laramie","Gillette","Rock Springs","Sheridan"], market_tier: 3, population_density: "very low", service_business_index: 50 },
  VT: { cities: ["Burlington","South Burlington","Rutland","Barre","Montpelier"], market_tier: 3, population_density: "very low", service_business_index: 52 },
  IA: { cities: ["Des Moines","Cedar Rapids","Davenport","Sioux City","Iowa City","Waterloo","Council Bluffs","Ankeny","Dubuque"], market_tier: 3, population_density: "low", service_business_index: 60 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    // 1. Load config
    const { data: config } = await supabase.from("brandaro_scout_config").select("*").limit(1).single();
    if (!config) throw new Error("No scout config found");

    // 2. Reset daily/monthly spend counters if needed
    const today = new Date().toISOString().split("T")[0];
    const thisMonth = new Date().toISOString().substring(0, 7);

    let dailySpend = config.daily_spend_today || 0;
    let monthlySpend = config.monthly_spend_this_month || 0;

    if (config.spend_reset_date !== today) {
      dailySpend = 0;
      await supabase.from("brandaro_scout_config").update({ daily_spend_today: 0, spend_reset_date: today }).eq("id", config.id);
    }

    const configMonth = config.monthly_reset_date?.substring(0, 7);
    if (configMonth !== thisMonth) {
      monthlySpend = 0;
      await supabase.from("brandaro_scout_config").update({ monthly_spend_this_month: 0, monthly_reset_date: today }).eq("id", config.id);
    }

    // 3. BUDGET GATE
    const dailyLimit = config.daily_spend_limit || 2.0;
    const monthlyLimit = config.monthly_spend_limit || 20.0;

    if (dailySpend >= dailyLimit) {
      return new Response(
        JSON.stringify({ status: "budget_limit", message: "Daily spend limit reached", daily_spent: dailySpend, daily_limit: dailyLimit }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (monthlySpend >= monthlyLimit) {
      return new Response(
        JSON.stringify({ status: "monthly_limit", message: "Monthly spend limit reached", monthly_spent: monthlySpend, monthly_limit: monthlyLimit }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check active & timing
    if (!config.is_active) {
      return new Response(JSON.stringify({ status: "inactive", message: "Scout agent is paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.clone().json().catch(() => ({}));
    const isManual = body?.manual === true;

    if (!isManual && config.last_run_at) {
      const hoursSince = (Date.now() - new Date(config.last_run_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < config.min_hours_between_runs) {
        return new Response(
          JSON.stringify({ status: "too_soon", next_run_in_hours: Math.round(config.min_hours_between_runs - hoursSince) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Calculate affordable searches
    const remainingBudget = Math.min(dailyLimit - dailySpend, monthlyLimit - monthlySpend);
    const aiDecisionCost = COSTS.ai_decision_per_call;
    const budgetAfterDecision = remainingBudget - aiDecisionCost;
    const maxAffordable = Math.floor(budgetAfterDecision / COSTS.total_per_search);
    const searchesThisRun = Math.min(config.searches_per_run || 10, maxAffordable, 20);

    if (searchesThisRun <= 0) {
      return new Response(
        JSON.stringify({ status: "insufficient_budget", remaining_budget: remainingBudget }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SCOUT] Budget OK. Running ${searchesThisRun} searches.`);

    // 6. Create run log
    const { data: run } = await supabase.from("brandaro_scout_runs").insert({ status: "running" }).select().single();
    const runId = run!.id;
    let runCost = aiDecisionCost;

    await supabase.from("brandaro_scout_spend_log").insert({
      run_id: runId, action: "ai_decision", cost: aiDecisionCost,
      cumulative_today: dailySpend + aiDecisionCost, cumulative_month: monthlySpend + aiDecisionCost,
    });

    // 7. Get memory
    const { data: memory } = await supabase
      .from("brandaro_scout_memory")
      .select("industry, city, state, leads_imported, success_rate")
      .order("searched_at", { ascending: false })
      .limit(500);

    // 8. Get lead stats
    const { data: leadStats } = await supabase.from("brandaro_qualified_leads").select("industry");
    const industryCounts: Record<string, number> = {};
    (leadStats || []).forEach((l: any) => {
      const ind = (l.industry || "unknown").toLowerCase();
      industryCounts[ind] = (industryCounts[ind] || 0) + 1;
    });

    // 8b. Get market intelligence for smarter decisions
    const { data: marketIntel } = await supabase
      .from("brandaro_market_intelligence")
      .select("state, industry, total_imported, avg_import_rate, market_score")
      .order("market_score", { ascending: false })
      .limit(200);

    const topMarkets = (marketIntel || [])
      .filter((m: any) => m.market_score >= 50)
      .slice(0, 20)
      .map((m: any) => `${m.industry} in ${m.state}: score ${m.market_score}, ${m.total_imported} imported`)
      .join("\n");

    // 9. Ask AI what to search — enhanced with market intelligence
    const targetStates = (config.target_states as string[]) || Object.keys(STATE_CITIES);
    const stateInfo = targetStates
      .filter((s: string) => STATE_CITIES[s])
      .map((s: string) => {
        const info = STATE_CITIES[s];
        return `${s} (Tier ${info.market_tier}, ${info.cities.length} cities, SBI: ${info.service_business_index})`;
      })
      .join(", ");

    const systemPrompt = `You are an elite autonomous market intelligence agent for Brandaro Digital — a company that sells websites to small service businesses.

YOUR MISSION: Find the highest-converting opportunities across the entire US market.

MARKET INTELLIGENCE YOU HAVE:

HIGHEST CONVERTING INDUSTRIES (ranked by close rate):
1. locksmith (14%) — emergency based, zero online presence
2. mobile mechanic (14%) — new service, no websites at all
3. gutter cleaning (13%) — almost none online
4. pressure washing (13%) — extremely low adoption
5. junk removal (13%) — flyer dependent
6. house cleaning (12%) — word of mouth only
7. handyman (12%) — no professional presence
8. carpet cleaning (11%) — local only
9. window cleaning (12%) — zero adoption
10. moving company (10%) — old school

STATE MARKET TIERS:
TIER 1 (highest density): NY, NJ, FL, TX, CA
TIER 2 (strong markets): GA, PA, IL, OH, NC, MI, VA, WA, AZ, MD, CT, MA
TIER 3 (emerging): TN, CO, SC, AL, MO, IN, WI, NV, OR, OK, AR, LA, KY, MN and all others

WEBSITE ADOPTION RATES (lower = better opportunity):
locksmith: 15%, gutter cleaning: 13%, pressure washing: 14%, mobile mechanic: 12%, junk removal: 15%, house cleaning: 18%, window cleaning: 16%, carpet cleaning: 20%, handyman: 20%, drywall contractor: 18%, fence contractor: 20%, tree service: 19%, painting contractor: 22%, auto detailing: 22%, pool service: 24%, appliance repair: 21%, moving company: 25%, concrete contractor: 25%, pest control: 28%, landscaping: 28%, roofing contractor: 30%, flooring: 32%, hvac: 35%, electrician: 36%, plumber: 38%

DECISION RULES:
1. NEVER repeat a searched combination
2. Prioritize Tier 1 states first
3. Prioritize industries with lowest website adoption
4. Mix high-population cities with underserved suburbs
5. If a state has zero searches — start with its largest city
6. If an industry has few leads in our pipeline — prioritize it
7. Suburbs often outperform big cities because less competition

Return ONLY a valid JSON array. No text before or after. No markdown. Exactly ${searchesThisRun} items.
[{"industry":"exact industry name","city":"city name","state":"2-letter state code","reason":"why this will convert"}]`;

    const userPrompt = `ALREADY SEARCHED (skip these):
${(memory || []).slice(0, 200).map((m: any) => `${m.industry}|${m.city}|${m.state}(${m.leads_imported})`).join("\n") || "None yet"}

LEAD COUNTS BY INDUSTRY:
${Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([i, c]) => `${i}: ${c}`).join("\n") || "No leads yet"}

TOP PERFORMING MARKETS (from intelligence):
${topMarkets || "No data yet"}

TARGET STATES: ${stateInfo}
TARGET INDUSTRIES: ${((config.target_industries as string[]) || []).join(", ")}
BUDGET LEFT TODAY: $${(dailyLimit - dailySpend).toFixed(2)}

Give me ${searchesThisRun} searches now.`;

    let searches: Array<{ industry: string; city: string; state: string; reason: string }> = [];

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiRes.ok) throw new Error(`AI gateway: ${aiRes.status}`);
      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      searches = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (aiErr: any) {
      console.error("[SCOUT] AI failed, using fallback:", aiErr.message);
      const fb = [
        { city: "Brooklyn", state: "NY" }, { city: "Newark", state: "NJ" },
        { city: "Miami", state: "FL" }, { city: "Houston", state: "TX" }, { city: "Atlanta", state: "GA" },
      ];
      const fbInd = ["locksmith", "mobile mechanic", "gutter cleaning", "pressure washing", "junk removal"];
      searches = fb.slice(0, searchesThisRun).map((c, i) => ({ ...c, industry: fbInd[i % fbInd.length], reason: "fallback" }));
    }

    // 10. Execute searches with per-search budget check
    let totalImported = 0;
    let searchesCompleted = 0;
    const decisions: any[] = [];
    let currentDailySpend = dailySpend + aiDecisionCost;
    let currentMonthlySpend = monthlySpend + aiDecisionCost;

    for (const search of searches) {
      if (currentDailySpend >= dailyLimit || currentMonthlySpend >= monthlyLimit) {
        decisions.push({ ...search, status: "skipped_budget" });
        continue;
      }

      try {
        // Duplicate check
        const { data: existing } = await supabase
          .from("brandaro_scout_memory")
          .select("id")
          .ilike("industry", search.industry)
          .ilike("city", search.city)
          .ilike("state", search.state)
          .limit(1);

        if (existing && existing.length > 0) {
          decisions.push({ ...search, status: "skipped_duplicate" });
          continue;
        }

        console.log(`[SCOUT] Running: ${search.industry} in ${search.city}, ${search.state}`);

        const { data: job, error: jobErr } = await supabase
          .from("brandaro_discovery_jobs")
          .insert({
            search_query: `${search.industry} in ${search.city}`,
            city: search.city, state: search.state, industry: search.industry,
            radius_meters: 40000, status: "queued",
          })
          .select().single();

        if (jobErr) throw jobErr;

        const { error: fnErr } = await supabase.functions.invoke("brandaro-lead-discovery", {
          body: { job_id: job!.id, city: search.city, state: search.state, industry: search.industry, radius_meters: 40000 },
        });

        if (fnErr) throw fnErr;

        // Poll for completion
        let imported = 0;
        let found = 0;
        for (let a = 0; a < 60; a++) {
          await new Promise((r) => setTimeout(r, 3000));
          const { data: jd } = await supabase.from("brandaro_discovery_jobs").select("*").eq("id", job!.id).single();
          if (jd?.status === "completed" || jd?.status === "failed") {
            imported = jd?.imported_count || 0;
            found = jd?.total_found || 0;
            break;
          }
        }

        const searchCost = COSTS.google_places_per_search + imported * COSTS.ai_scoring_per_lead;
        currentDailySpend += searchCost;
        currentMonthlySpend += searchCost;
        runCost += searchCost;

        await supabase.from("brandaro_scout_spend_log").insert({
          run_id: runId, action: `search_${search.city}_${search.industry}`.substring(0, 100),
          cost: searchCost, cumulative_today: currentDailySpend, cumulative_month: currentMonthlySpend,
        });

        await supabase.from("brandaro_scout_memory").insert({
          industry: search.industry.toLowerCase(), city: search.city, state: search.state,
          leads_found: found, leads_imported: imported,
          success_rate: found > 0 ? Math.round((imported / found) * 100) : 0,
          worth_revisiting: imported >= 3,
          revisit_after: imported >= 3 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
          notes: search.reason,
        });

        // Update market intelligence
        await supabase.from("brandaro_market_intelligence").upsert({
          state: search.state,
          industry: search.industry.toLowerCase(),
          total_searches: 1,
          total_found: found,
          total_imported: imported,
          avg_import_rate: found > 0 ? Math.round((imported / found) * 100) : 0,
          discovery_score: Math.min(100, imported * 10),
          market_score: Math.min(100, imported * 8 + (found > 0 ? 20 : 0)),
          last_updated: new Date().toISOString(),
        }, { onConflict: "state, industry" });

        totalImported += imported;
        searchesCompleted++;
        decisions.push({ ...search, imported, found, cost: searchCost, status: "completed" });

        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: any) {
        console.error(`[SCOUT] Search failed:`, err.message);
        decisions.push({ ...search, status: "failed", error: err.message });
      }
    }

    // 11. Final updates
    const budgetStopped = decisions.some((d) => d.status === "skipped_budget");
    await supabase.from("brandaro_scout_runs").update({
      completed_at: new Date().toISOString(), searches_attempted: searches.length,
      searches_completed: searchesCompleted, total_imported: totalImported,
      estimated_cost: runCost, decisions,
      status: budgetStopped ? "stopped_budget" : "completed",
      stop_reason: budgetStopped ? "Budget limit reached mid-run" : null,
    }).eq("id", runId);

    await supabase.from("brandaro_scout_config").update({
      last_run_at: new Date().toISOString(),
      total_searches: (config.total_searches || 0) + searchesCompleted,
      total_leads_imported: (config.total_leads_imported || 0) + totalImported,
      daily_spend_today: currentDailySpend,
      monthly_spend_this_month: currentMonthlySpend,
      total_spent_all_time: (config.total_spent_all_time || 0) + runCost,
    }).eq("id", config.id);

    return new Response(
      JSON.stringify({
        success: true, run_id: runId, searches_completed: searchesCompleted,
        total_imported: totalImported, run_cost: `$${runCost.toFixed(4)}`,
        daily_spent: `$${currentDailySpend.toFixed(4)}`, daily_limit: `$${dailyLimit}`,
        monthly_spent: `$${currentMonthlySpend.toFixed(4)}`, monthly_limit: `$${monthlyLimit}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[SCOUT] Fatal:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
