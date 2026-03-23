import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const ROOT_FOLDER_NAME = "Dynasty OS Backups";

// Floor configs matching the frontend
const FLOOR_CONFIGS = [
  { id: "command", name: "Grabba Command Penthouse", tables: ["companies", "ai_recommendations", "ai_kpi_snapshots"] },
  { id: "floor-1", name: "CRM & Store Control", tables: ["store_master", "store_contacts", "companies", "stores"] },
  { id: "floor-2", name: "Communication Center", tables: ["ai_call_logs", "ai_call_campaigns", "ai_communication_queue"] },
  { id: "floor-3", name: "Inventory Engine", tables: ["store_tube_inventory", "brand_inventory_movements"] },
  { id: "floor-4", name: "Delivery & Drivers", tables: ["biker_routes", "biker_profiles", "biker_assignments"] },
  { id: "floor-5", name: "Orders & Invoices", tables: ["wholesale_orders", "accounting_ledger", "invoices"] },
  { id: "floor-6", name: "Production & Machinery", tables: ["production_logs", "production_machines"] },
  { id: "floor-7", name: "Wholesale Marketplace", tables: ["wholesale_orders", "marketplace_orders", "marketplace_products"] },
  { id: "floor-8", name: "Ambassadors & Reps", tables: ["ambassadors", "ambassador_commissions", "ambassador_payout_history"] },
  { id: "floor-9", name: "AI Operations Center", tables: ["ai_work_tasks", "ai_action_queue", "ai_decision_log"] },
];

async function gdriveRequest(path: string, options: RequestInit = {}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");

  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY not configured");

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive API error [${res.status}]: ${text}`);
  }

  return res.json();
}

async function gdriveUpload(fileName: string, content: string, parentId: string, mimeType = "application/json") {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;

  const metadata = {
    name: fileName,
    parents: [parentId],
    mimeType,
  };

  // Use multipart upload
  const boundary = "dynasty_os_boundary";
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const uploadUrl = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart";

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed [${res.status}]: ${text}`);
  }

  return res.json();
}

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  // Search for existing folder
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const result = await gdriveRequest(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

  if (result.files && result.files.length > 0) {
    return result.files[0].id;
  }

  // Create folder
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;

  const createRes = await fetch(`${GATEWAY_URL}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Create folder failed [${createRes.status}]: ${text}`);
  }

  const folder = await createRes.json();
  return folder.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, floorId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === "list-folders") {
      // List existing backup folders
      const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME);
      const result = await gdriveRequest(
        `/files?q=${encodeURIComponent(`'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name,createdTime)&orderBy=name desc`
      );
      return new Response(JSON.stringify({ rootId, folders: result.files || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "backup-floor") {
      const config = FLOOR_CONFIGS.find((c) => c.id === floorId);
      if (!config) throw new Error(`Unknown floor: ${floorId}`);

      const now = new Date();
      const monthFolder = now.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "America/New_York" });

      // Create folder structure: Dynasty OS Backups / March 2026 / Floor Name
      const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME);
      const monthId = await findOrCreateFolder(monthFolder, rootId);
      const floorFolderId = await findOrCreateFolder(config.name, monthId);

      // Fetch data from each table
      const report: Record<string, unknown> = {
        floor: config.name,
        exportedAt: now.toISOString(),
        tables: {},
      };

      const uploadedFiles: string[] = [];

      for (const tableName of config.tables) {
        const { data, error, count } = await supabase
          .from(tableName)
          .select("*", { count: "exact" })
          .limit(5000);

        if (error) {
          (report.tables as Record<string, unknown>)[tableName] = { error: error.message, rowCount: 0 };
          continue;
        }

        (report.tables as Record<string, unknown>)[tableName] = {
          rowCount: count || (data || []).length,
          data: data || [],
        };
      }

      // Upload full JSON report
      const dateStamp = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const jsonFileName = `${config.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report_${dateStamp}.json`;
      await gdriveUpload(jsonFileName, JSON.stringify(report, null, 2), floorFolderId);
      uploadedFiles.push(jsonFileName);

      // Upload a summary text report (PDF-like readable format)
      const summaryLines = [
        `═══════════════════════════════════════════════════`,
        `  DYNASTY OS — ${config.name.toUpperCase()} REPORT`,
        `  Generated: ${now.toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
        `═══════════════════════════════════════════════════`,
        ``,
      ];

      for (const tableName of config.tables) {
        const tableData = (report.tables as Record<string, any>)[tableName];
        summaryLines.push(`📊 ${tableName}`);
        summaryLines.push(`   Records: ${tableData?.rowCount ?? 0}`);
        if (tableData?.error) {
          summaryLines.push(`   ⚠️  Error: ${tableData.error}`);
        }
        summaryLines.push(``);
      }

      const totalRecords = Object.values(report.tables as Record<string, any>).reduce(
        (sum: number, t: any) => sum + (t?.rowCount || 0),
        0
      );
      summaryLines.push(`───────────────────────────────────────────────────`);
      summaryLines.push(`Total Records Backed Up: ${totalRecords}`);
      summaryLines.push(`Tables: ${config.tables.length}`);
      summaryLines.push(`Backup Location: ${ROOT_FOLDER_NAME}/${monthFolder}/${config.name}`);

      const summaryFileName = `${config.name.replace(/[^a-zA-Z0-9]/g, "_")}_Summary_${dateStamp}.txt`;
      await gdriveUpload(summaryFileName, summaryLines.join("\n"), floorFolderId, "text/plain");
      uploadedFiles.push(summaryFileName);

      return new Response(
        JSON.stringify({
          success: true,
          floor: config.name,
          monthFolder,
          filesUploaded: uploadedFiles,
          totalRecords,
          tableCount: config.tables.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "backup-all") {
      const now = new Date();
      const monthFolder = now.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "America/New_York" });
      const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME);
      const monthId = await findOrCreateFolder(monthFolder, rootId);

      const results: Array<{ floor: string; success: boolean; files: number; error?: string }> = [];

      for (const config of FLOOR_CONFIGS) {
        try {
          const floorFolderId = await findOrCreateFolder(config.name, monthId);
          const report: Record<string, unknown> = {
            floor: config.name,
            exportedAt: now.toISOString(),
            tables: {},
          };

          for (const tableName of config.tables) {
            const { data, error, count } = await supabase
              .from(tableName)
              .select("*", { count: "exact" })
              .limit(5000);

            (report.tables as Record<string, unknown>)[tableName] = error
              ? { error: error.message, rowCount: 0 }
              : { rowCount: count || (data || []).length, data: data || [] };
          }

          const dateStamp = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
          const jsonFileName = `${config.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report_${dateStamp}.json`;
          await gdriveUpload(jsonFileName, JSON.stringify(report, null, 2), floorFolderId);

          results.push({ floor: config.name, success: true, files: 1 });
        } catch (err) {
          results.push({ floor: config.name, success: false, files: 0, error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({ success: true, monthFolder, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    console.error("gdrive-backup error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
