import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const ROOT_FOLDER_NAME = "Dynasty OS Backups";

const FLOOR_CONFIGS = [
  { id: "command", name: "Grabba Command Penthouse", emoji: "🔥", tables: ["companies", "ai_recommendations", "ai_kpi_snapshots"] },
  { id: "floor-1", name: "CRM & Store Control", emoji: "🏢", tables: ["store_master", "store_contacts", "companies", "stores"] },
  { id: "floor-2", name: "Communication Center", emoji: "📡", tables: ["ai_call_logs", "ai_call_campaigns", "ai_communication_queue"] },
  { id: "floor-3", name: "Inventory Engine", emoji: "📦", tables: ["store_tube_inventory", "brand_inventory_movements"] },
  { id: "floor-4", name: "Delivery & Drivers", emoji: "🚴", tables: ["biker_routes", "biker_profiles", "biker_assignments"] },
  { id: "floor-5", name: "Orders & Invoices", emoji: "💰", tables: ["wholesale_orders", "accounting_ledger", "invoices"] },
  { id: "floor-6", name: "Production & Machinery", emoji: "🏭", tables: ["production_logs", "production_machines"] },
  { id: "floor-7", name: "Wholesale Marketplace", emoji: "🏪", tables: ["wholesale_orders", "marketplace_orders", "marketplace_products"] },
  { id: "floor-8", name: "Ambassadors & Reps", emoji: "🤝", tables: ["ambassadors", "ambassador_commissions", "ambassador_payout_history"] },
  { id: "floor-9", name: "AI Operations Center", emoji: "🤖", tables: ["ai_work_tasks", "ai_action_queue", "ai_decision_log"] },
];

// ─── PDF Generator (A4 format) ───────────────────────────────────────────

class SimplePDF {
  private objects: string[] = [];
  private pages: number[] = [];
  private pageContents: string[] = [];
  private currentPage = "";
  private yPos = 800; // Start from top of A4 (842pt)
  private pageNum = 0;
  private fontObjId = 0;
  private catalogId = 0;
  private pagesId = 0;

  // A4 = 595 x 842 points
  private readonly W = 595;
  private readonly H = 842;
  private readonly MARGIN = 50;
  private readonly LINE_H = 14;
  private readonly COL_WIDTH = this.W - 100;

  private addObj(content: string): number {
    this.objects.push(content);
    return this.objects.length; // 1-indexed obj ID
  }

  private escapeText(t: string): string {
    return t
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, " "); // strip non-ASCII for PDF safety
  }

  private ensureSpace(needed: number) {
    if (this.yPos < this.MARGIN + needed) {
      this.finishPage();
      this.startPage();
    }
  }

  startPage() {
    this.pageNum++;
    this.yPos = this.H - this.MARGIN;
    this.currentPage = "";
  }

  finishPage() {
    if (this.currentPage) {
      this.pageContents.push(this.currentPage);
    }
  }

  addTitle(text: string) {
    this.ensureSpace(30);
    this.currentPage += `BT /F1 18 Tf ${this.MARGIN} ${this.yPos} Td (${this.escapeText(text)}) Tj ET\n`;
    this.yPos -= 28;
  }

  addSubtitle(text: string) {
    this.ensureSpace(24);
    this.currentPage += `BT /F1 13 Tf ${this.MARGIN} ${this.yPos} Td (${this.escapeText(text)}) Tj ET\n`;
    this.yPos -= 20;
  }

  addText(text: string, fontSize = 10, indent = 0) {
    this.ensureSpace(this.LINE_H);
    const x = this.MARGIN + indent;
    this.currentPage += `BT /F1 ${fontSize} Tf ${x} ${this.yPos} Td (${this.escapeText(text)}) Tj ET\n`;
    this.yPos -= this.LINE_H;
  }

  addLine() {
    this.ensureSpace(10);
    this.currentPage += `0.8 0.8 0.8 RG ${this.MARGIN} ${this.yPos} m ${this.W - this.MARGIN} ${this.yPos} l 0.5 w S 0 0 0 RG\n`;
    this.yPos -= 10;
  }

  addBoldLine() {
    this.ensureSpace(10);
    this.currentPage += `0.2 0.2 0.2 RG ${this.MARGIN} ${this.yPos} m ${this.W - this.MARGIN} ${this.yPos} l 1.5 w S 0 0 0 RG\n`;
    this.yPos -= 12;
  }

  addSpace(pts = 10) {
    this.yPos -= pts;
  }

  addTableRow(cols: string[], widths: number[], bold = false, fontSize = 9) {
    this.ensureSpace(this.LINE_H + 2);
    let x = this.MARGIN;
    const sz = bold ? fontSize + 1 : fontSize;
    for (let i = 0; i < cols.length; i++) {
      const txt = (cols[i] || "").substring(0, Math.floor(widths[i] / (sz * 0.5)));
      this.currentPage += `BT /F1 ${sz} Tf ${x} ${this.yPos} Td (${this.escapeText(txt)}) Tj ET\n`;
      x += widths[i];
    }
    this.yPos -= this.LINE_H;
  }

  addFooter(text: string) {
    this.currentPage += `BT /F1 8 Tf ${this.MARGIN} 30 Td (${this.escapeText(text)}) Tj ET\n`;
  }

  build(): Uint8Array {
    this.finishPage();

    // Reset objects
    this.objects = [];

    // Obj 1: Catalog (placeholder)
    this.addObj(""); 
    // Obj 2: Pages (placeholder)
    this.addObj("");
    // Obj 3: Font
    this.fontObjId = this.addObj(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`
    );

    // Create page objects
    const pageObjIds: number[] = [];
    for (let i = 0; i < this.pageContents.length; i++) {
      // Content stream
      const stream = this.pageContents[i];
      const streamBytes = new TextEncoder().encode(stream);
      const streamObjId = this.addObj(
        `<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`
      );

      // Page object
      const pageObjId = this.addObj(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Contents ${streamObjId} 0 R /Resources << /Font << /F1 ${this.fontObjId} 0 R >> >> >>`
      );
      pageObjIds.push(pageObjId);
    }

    // Now fill in catalog and pages
    const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(" ");
    this.objects[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
    this.objects[1] = `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>`;

    // Build the final PDF bytes
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];

    for (let i = 0; i < this.objects.length; i++) {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${this.objects[i]}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += "xref\n";
    pdf += `0 ${this.objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (const off of offsets) {
      pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    }

    pdf += "trailer\n";
    pdf += `<< /Size ${this.objects.length + 1} /Root 1 0 R >>\n`;
    pdf += "startxref\n";
    pdf += `${xrefOffset}\n`;
    pdf += "%%EOF\n";

    return new TextEncoder().encode(pdf);
  }
}

function generateFloorPDF(
  floorConfig: typeof FLOOR_CONFIGS[0],
  tableData: Record<string, { rowCount: number; data: Record<string, unknown>[]; error?: string }>,
  now: Date
): Uint8Array {
  const pdf = new SimplePDF();
  pdf.startPage();

  // ─── Header ────────────────────────────
  const dateStr = now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
  });

  pdf.addTitle("DYNASTY OS");
  pdf.addSubtitle(`Floor Report: ${floorConfig.name}`);
  pdf.addBoldLine();
  pdf.addSpace(4);
  pdf.addText(`Report Date: ${dateStr}`, 10);
  pdf.addText(`Generated At: ${timeStr} ET`, 10);
  pdf.addText(`Floor ID: ${floorConfig.id}`, 10);
  pdf.addText(`Tables Included: ${floorConfig.tables.length}`, 10);

  // Total records
  const totalRecords = Object.values(tableData).reduce((s, t) => s + (t.rowCount || 0), 0);
  pdf.addText(`Total Records: ${totalRecords.toLocaleString()}`, 10);
  pdf.addSpace(6);
  pdf.addBoldLine();

  // ─── Executive Summary ─────────────────
  pdf.addSpace(6);
  pdf.addSubtitle("Executive Summary");
  pdf.addLine();
  pdf.addSpace(4);

  for (const tableName of floorConfig.tables) {
    const td = tableData[tableName];
    if (!td) continue;

    const status = td.error ? "ERROR" : td.rowCount > 0 ? "OK" : "EMPTY";
    pdf.addText(`${tableName}  -  ${td.rowCount.toLocaleString()} records  [${status}]`, 10, 10);
  }

  pdf.addSpace(10);
  pdf.addBoldLine();

  // ─── Per-Table Detail ──────────────────
  for (const tableName of floorConfig.tables) {
    const td = tableData[tableName];
    if (!td) continue;

    pdf.addSpace(8);
    pdf.addSubtitle(`Table: ${tableName}`);
    pdf.addLine();

    if (td.error) {
      pdf.addText(`Error: ${td.error}`, 10, 10);
      pdf.addSpace(6);
      continue;
    }

    pdf.addText(`Record Count: ${td.rowCount.toLocaleString()}`, 10, 10);
    pdf.addSpace(4);

    // Show column headers + first 25 rows as a data preview
    if (td.data && td.data.length > 0) {
      const allKeys = Object.keys(td.data[0]);
      // Pick up to 5 most useful columns
      const priorityCols = ["id", "name", "status", "created_at", "amount", "email", "phone", "store_name", "player_name", "total", "type"];
      const showKeys = priorityCols.filter((k) => allKeys.includes(k));
      // Fill remaining with other keys
      for (const k of allKeys) {
        if (showKeys.length >= 5) break;
        if (!showKeys.includes(k)) showKeys.push(k);
      }

      const colW = Math.floor(495 / showKeys.length);
      const widths = showKeys.map(() => colW);

      // Header row
      pdf.addTableRow(showKeys.map((k) => k.toUpperCase()), widths, true, 8);
      pdf.addLine();

      // Data rows (max 25 per table)
      const previewRows = td.data.slice(0, 25);
      for (const row of previewRows) {
        const vals = showKeys.map((k) => {
          const v = row[k];
          if (v === null || v === undefined) return "-";
          if (typeof v === "object") return JSON.stringify(v).substring(0, 30);
          return String(v).substring(0, 30);
        });
        pdf.addTableRow(vals, widths, false, 8);
      }

      if (td.data.length > 25) {
        pdf.addSpace(4);
        pdf.addText(`... and ${(td.data.length - 25).toLocaleString()} more records`, 9, 10);
      }
    } else {
      pdf.addText("No data records", 10, 10);
    }

    pdf.addSpace(6);
  }

  // ─── Footer on last page ───────────────
  pdf.addSpace(20);
  pdf.addBoldLine();
  pdf.addText("Dynasty OS - Automated Floor Report", 9);
  pdf.addText(`Backup destination: Google Drive / Dynasty OS Backups / ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "America/New_York" })} / ${floorConfig.name}`, 8);
  pdf.addText("gasmaskapprovedllc@gmail.com", 8);

  pdf.addFooter(`Dynasty OS Floor Report - ${floorConfig.name} - ${dateStr} - Page ${1}`);

  return pdf.build();
}

// ─── Google Drive helpers ────────────────────────────────────────────────

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

async function gdriveUploadBinary(fileName: string, pdfBytes: Uint8Array, parentId: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;

  const metadata = JSON.stringify({
    name: fileName,
    parents: [parentId],
    mimeType: "application/pdf",
  });

  // Build multipart body manually with binary PDF
  const boundary = "dynasty_pdf_boundary_" + Date.now();
  const metaPart = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: binary\r\n\r\n`
  );
  const endPart = new TextEncoder().encode(`\r\n--${boundary}--`);

  // Combine into single Uint8Array
  const body = new Uint8Array(metaPart.length + pdfBytes.length + endPart.length);
  body.set(metaPart, 0);
  body.set(pdfBytes, metaPart.length);
  body.set(endPart, metaPart.length + pdfBytes.length);

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
    throw new Error(`PDF upload failed [${res.status}]: ${text}`);
  }

  return res.json();
}

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const result = await gdriveRequest(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

  if (result.files && result.files.length > 0) {
    return result.files[0].id;
  }

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

// ─── Main handler ────────────────────────────────────────────────────────

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

      // Create folder hierarchy
      const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME);
      const monthId = await findOrCreateFolder(monthFolder, rootId);
      const floorFolderId = await findOrCreateFolder(config.name, monthId);

      // Fetch table data
      const tableData: Record<string, { rowCount: number; data: Record<string, unknown>[]; error?: string }> = {};

      for (const tableName of config.tables) {
        const { data, error, count } = await supabase
          .from(tableName)
          .select("*", { count: "exact" })
          .limit(5000);

        if (error) {
          tableData[tableName] = { rowCount: 0, data: [], error: error.message };
        } else {
          tableData[tableName] = { rowCount: count || (data || []).length, data: data || [] };
        }
      }

      // Generate A4 PDF report
      const pdfBytes = generateFloorPDF(config, tableData, now);

      const dateStamp = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const pdfFileName = `${config.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report_${dateStamp}.pdf`;

      await gdriveUploadBinary(pdfFileName, pdfBytes, floorFolderId);

      const totalRecords = Object.values(tableData).reduce((s, t) => s + (t.rowCount || 0), 0);

      return new Response(
        JSON.stringify({
          success: true,
          floor: config.name,
          monthFolder,
          filesUploaded: [pdfFileName],
          totalRecords,
          tableCount: config.tables.length,
          format: "A4 PDF",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "backup-all") {
      const now = new Date();
      const monthFolder = now.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "America/New_York" });
      const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME);
      const monthId = await findOrCreateFolder(monthFolder, rootId);

      const results: Array<{ floor: string; success: boolean; files: number; fileName?: string; error?: string }> = [];

      for (const config of FLOOR_CONFIGS) {
        try {
          const floorFolderId = await findOrCreateFolder(config.name, monthId);

          const tableData: Record<string, { rowCount: number; data: Record<string, unknown>[]; error?: string }> = {};

          for (const tableName of config.tables) {
            const { data, error, count } = await supabase
              .from(tableName)
              .select("*", { count: "exact" })
              .limit(5000);

            if (error) {
              tableData[tableName] = { rowCount: 0, data: [], error: error.message };
            } else {
              tableData[tableName] = { rowCount: count || (data || []).length, data: data || [] };
            }
          }

          const pdfBytes = generateFloorPDF(config, tableData, now);
          const dateStamp = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
          const pdfFileName = `${config.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report_${dateStamp}.pdf`;

          await gdriveUploadBinary(pdfFileName, pdfBytes, floorFolderId);

          results.push({ floor: config.name, success: true, files: 1, fileName: pdfFileName });
        } catch (err) {
          results.push({ floor: config.name, success: false, files: 0, error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({ success: true, monthFolder, format: "A4 PDF", results }),
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
