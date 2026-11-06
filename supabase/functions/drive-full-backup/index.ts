// Full nightly Google Drive backup: every row of every public base table + schema SQL.
// Resumable: state lives in drive_backup_runs / drive_backup_items; each call works ~100s then re-invokes itself,
// and a 5-minute cron "continue" tick covers any dropped hand-off. NEVER deletes anything in Drive or the DB.
// Returns no table data to callers. Manual force-start is owner-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const UPLOAD = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id";
const ROOT_NAME = "GasMask Full Backups";
const BUDGET_MS = 100_000;
const PAGE = 500;
const PART_BYTES = 15 * 1024 * 1024;

function hdrs(extra: Record<string, string> = {}) {
  const l = Deno.env.get("LOVABLE_API_KEY"), g = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!l || !g) throw new Error("Google Drive connection keys missing");
  return { Authorization: `Bearer ${l}`, "X-Connection-Api-Key": g, ...extra };
}
async function driveJson(path: string, init: RequestInit = {}) {
  const r = await fetch(`${DRIVE}${path}`, { ...init, headers: hdrs({ "Content-Type": "application/json" }) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Drive [${r.status}]: ${t.slice(0, 500)}`);
  return JSON.parse(t);
}
async function folder(name: string, parent?: string) {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent ? ` and '${parent}' in parents` : ""}`);
  const found = await driveJson(`/files?q=${q}&fields=files(id)&pageSize=1`);
  if (found.files?.length) return found.files[0].id as string;
  const c = await driveJson(`/files?fields=id`, { method: "POST", body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }) });
  return c.id as string;
}
async function upload(name: string, parent: string, data: Uint8Array, mime: string) {
  const b = "bkp" + crypto.randomUUID().replace(/-/g, "");
  const head = new TextEncoder().encode(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`);
  const tail = new TextEncoder().encode(`\r\n--${b}--`);
  const body = new Uint8Array(head.length + data.length + tail.length);
  body.set(head, 0); body.set(data, head.length); body.set(tail, head.length + data.length);
  const r = await fetch(UPLOAD, { method: "POST", headers: hdrs({ "Content-Type": `multipart/related; boundary=${b}` }), body });
  const t = await r.text();
  if (!r.ok) throw new Error(`Drive upload [${r.status}]: ${t.slice(0, 500)}`);
  return JSON.parse(t).id as string;
}
async function gzip(s: string) {
  const stream = new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: { action?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { /* cron */ }
  const action = body.action === "start" ? "start" : "continue";

  try {
    if (action === "start") {
      if (body.force) {
        const token = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
        const { data: u } = await sb.auth.getUser(token);
        const { data: ok } = u?.user ? await sb.rpc("field_order_is_owner", { p_user: u.user.id }) : { data: false };
        if (!ok) return json({ error: "Owner only" }, 403);
      }
      const { data: recent } = await sb.from("drive_backup_runs").select("id,status,started_at")
        .gte("started_at", new Date(Date.now() - (body.force ? 10 : 20 * 60) * 60_000).toISOString()).limit(1);
      if (recent?.length) return json({ skipped: "a backup already started recently", run: recent[0] });

      const root = await folder(ROOT_NAME);
      const stamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19) + "Z";
      const dir = await folder(`backup-${stamp}`, root);
      const { data: run, error } = await sb.from("drive_backup_runs").insert({
        trigger: body.force ? "manual" : "nightly", drive_folder_id: dir, drive_folder_url: `https://drive.google.com/drive/folders/${dir}`,
      }).select().single();
      if (error) throw new Error(error.message);
      const { data: schema, error: se } = await sb.rpc("backup_schema_sql");
      if (se) throw new Error(`schema: ${se.message}`);
      await upload("schema.sql.gz", dir, await gzip(schema as string), "application/gzip");
      const { data: tables, error: te } = await sb.rpc("backup_list_tables");
      if (te) throw new Error(te.message);
      const names = (tables as string[]);
      for (let i = 0; i < names.length; i += 500) {
        const { error: ie } = await sb.from("drive_backup_items").insert(names.slice(i, i + 500).map((t) => ({ run_id: run.id, table_name: t })));
        if (ie) throw new Error(ie.message);
      }
      await sb.from("drive_backup_runs").update({ tables_total: names.length }).eq("id", run.id);
    }

    const { data: run } = await sb.from("drive_backup_runs").select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (!run) return json({ idle: true });

    while (Date.now() - t0 < BUDGET_MS) {
      const { data: item } = await sb.from("drive_backup_items").select("*").eq("run_id", run.id).in("status", ["pending", "running"]).order("table_name").limit(1).maybeSingle();
      if (!item) break;
      let last: string | null = item.last_ctid, rows = Number(item.row_count), parts = item.parts, bytes = Number(item.bytes);
      const ids: string[] = [...item.file_ids];
      let buf = "", bufRows = 0, ended = false;
      try {
        while (true) {
          const { data: page, error } = await sb.rpc("backup_table_page", { p_table: item.table_name, p_after: last, p_limit: PAGE });
          if (error) throw new Error(error.message);
          const pr = (page as { rows: unknown[]; last: string | null }).rows;
          for (const r of pr) buf += JSON.stringify(r) + "\n";
          bufRows += pr.length;
          if (pr.length) last = (page as { last: string }).last;
          if (pr.length < PAGE) ended = true;
          const outOfTime = Date.now() - t0 > BUDGET_MS;
          if (bufRows && (ended || buf.length > PART_BYTES || outOfTime)) {
            parts += 1;
            const gz = await gzip(buf);
            ids.push(await upload(`${item.table_name}.part${String(parts).padStart(3, "0")}.ndjson.gz`, run.drive_folder_id, gz, "application/gzip"));
            rows += bufRows; bytes += gz.length; buf = ""; bufRows = 0;
            await sb.from("drive_backup_items").update({ status: ended ? "done" : "running", row_count: rows, parts, bytes, last_ctid: last, file_ids: ids, updated_at: new Date().toISOString() })
              .eq("run_id", run.id).eq("table_name", item.table_name);
          }
          if (ended) {
            await sb.from("drive_backup_items").update({ status: "done", row_count: rows, updated_at: new Date().toISOString() }).eq("run_id", run.id).eq("table_name", item.table_name);
            break;
          }
          if (outOfTime) break;
        }
      } catch (e) {
        await sb.from("drive_backup_items").update({ status: "failed", error: String((e as Error).message).slice(0, 1000), updated_at: new Date().toISOString() }).eq("run_id", run.id).eq("table_name", item.table_name);
      }
    }

    const { count: open } = await sb.from("drive_backup_items").select("*", { count: "exact", head: true }).eq("run_id", run.id).in("status", ["pending", "running"]);
    const { count: done } = await sb.from("drive_backup_items").select("*", { count: "exact", head: true }).eq("run_id", run.id).eq("status", "done");
    if (!open) {
      const all: { table_name: string; status: string; row_count: number; parts: number; bytes: number; error: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await sb.from("drive_backup_items").select("table_name,status,row_count,parts,bytes,error").eq("run_id", run.id).order("table_name").range(from, from + 999);
        all.push(...(data || [])); if (!data || data.length < 1000) break;
      }
      const total = all.reduce((s, r) => s + Number(r.row_count), 0);
      const failed = all.filter((r) => r.status === "failed");
      const csv = "table,status,rows,parts,gz_bytes,error\n" + all.map((r) => [r.table_name, r.status, r.row_count, r.parts, r.bytes, JSON.stringify(r.error || "")].join(",")).join("\n");
      await upload("manifest.csv", run.drive_folder_id, new TextEncoder().encode(csv), "text/csv");
      await sb.from("drive_backup_runs").update({ status: failed.length ? "failed" : "done", finished_at: new Date().toISOString(), tables_done: done, rows_total: total,
        error: failed.length ? `${failed.length} tables failed: ${failed.slice(0, 10).map((f) => f.table_name).join(", ")}` : null }).eq("id", run.id);
      return json({ finished: true, run: run.id, folder: run.drive_folder_url, tables: all.length, rows: total, failed: failed.length });
    }
    await sb.from("drive_backup_runs").update({ tables_done: done }).eq("id", run.id);
    // hand off to the next slice
    const next = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-full-backup`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` }, body: JSON.stringify({ action: "continue" }),
    }).catch(() => {});
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(next);
    return json({ continuing: true, run: run.id, folder: run.drive_folder_url, tables_done: done, remaining: open });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
