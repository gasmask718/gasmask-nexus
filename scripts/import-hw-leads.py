#!/usr/bin/env python3
"""Repeatable Highway lead import.

Reads master_leads_all.csv (+ call_list_export.csv as phone/status enrichment) and
upserts into public.hw_leads via PostgREST. Writes ONLY to hw_leads.

Dedupe key: (state, business_name, phone). Because hw_leads_dedupe is a PARTIAL unique
index (WHERE phone IS NOT NULL) it cannot be used as a PostgREST on_conflict target, so
existing rows are matched client-side and updated by primary key.

Usage: python3 import_hw_leads.py <master.csv> <call_list.csv>
"""
import csv, json, os, sys, urllib.request

URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
ANON = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
JWT = os.environ["LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN"]
H = {
    "apikey": ANON,
    "Authorization": f"Bearer {JWT}",
    "Content-Type": "application/json",
}


def req(method, path, body=None, extra=None):
    r = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
                               data=json.dumps(body).encode() if body is not None else None,
                               headers={**H, **(extra or {})})
    with urllib.request.urlopen(r) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def s(v):
    v = (v or "").strip()
    return v or None


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def digits(v):
    d = "".join(c for c in (v or "") if c.isdigit())
    return d or None


def key(r):
    return (r["state"], r["business_name"], r["phone"])


master_path, call_path = sys.argv[1], sys.argv[2]

# --- parse call list (enrichment only) -------------------------------------
enrich = {}
with open(call_path) as f:
    for c in csv.DictReader(f):
        k = (s(c["state"]), s(c["business_name"]))
        enrich[k] = c

rows, skipped = [], []
seen = {}
with open(master_path) as f:
    for i, c in enumerate(csv.DictReader(f), start=2):
        name, st = s(c["business_name"]), s(c["state"])
        if not name or not st:
            skipped.append({"line": i, "reason": "missing business_name or state", "row": c})
            continue
        e = enrich.get((st, name), {})
        phone = digits(c["phone"]) or digits(e.get("phone"))
        try:
            bucket = int(c["bucket"]) if s(c["bucket"]) else None
        except ValueError:
            bucket = None
        r = {
            "bucket": bucket,
            "business_name": name,
            "license_number": s(c["license_number"]),
            "license_type": s(c["license_type"]),
            "license_status": s(c["license_status"]) or s(e.get("license_status")),
            "state": st,
            "city": s(c["city"]),
            "address": s(c["address"]),
            "already_delivers": (s(c["already_delivers"]) or s(e.get("already_delivers")) or "0") in ("1", "true", "True", "yes"),
            "phone": phone,
            "email": s(c["email"]),
            "website": s(c["website"]),
            "lat": num(c["lat"]),
            "long": num(c["long"]),
            "source": s(c["source"]),
            "medical_flag": (s(c["medical_flag"]) or s(e.get("medical_flag")) or "no") in ("yes", "1", "true", "True"),
        }
        k = key(r)
        if k in seen:
            seen[k].update({kk: vv for kk, vv in r.items() if vv not in (None, "")})
            continue
        seen[k] = r
        rows.append(r)

# call-list rows absent from master
master_names = {(r["state"], r["business_name"]) for r in rows}
for (st, name), c in enrich.items():
    if not st or not name or (st, name) in master_names:
        continue
    r = {
        "bucket": 2 if (s(c.get("medical_flag")) == "yes") else 1,
        "business_name": name, "license_number": None, "license_type": None,
        "license_status": s(c.get("license_status")), "state": st, "city": s(c.get("city")),
        "address": None,
        "already_delivers": (s(c.get("already_delivers")) or "0") in ("1", "true", "yes"),
        "phone": digits(c.get("phone")), "email": None, "website": None,
        "lat": None, "long": None, "source": "call_list_export",
        "medical_flag": s(c.get("medical_flag")) == "yes",
    }
    if key(r) in seen:
        continue
    seen[key(r)] = r
    rows.append(r)

print(f"parsed {len(rows)} unique rows, {len(skipped)} skipped")

# --- existing rows ----------------------------------------------------------
existing = {}
off = 0
while True:
    batch = req("GET", f"hw_leads?select=id,state,business_name,phone&limit=1000&offset={off}")
    if not batch:
        break
    for b in batch:
        existing[(b["state"], b["business_name"], b["phone"])] = b["id"]
    off += len(batch)
    if len(batch) < 1000:
        break
print(f"existing rows in hw_leads: {len(existing)}")

inserts = [r for r in rows if key(r) not in existing]
updates = [{**r, "id": existing[key(r)]} for r in rows if key(r) in existing]
failed = []


def send(batch, prefer):
    try:
        req("POST", "hw_leads", batch, {"Prefer": prefer})
        return True
    except Exception as ex:
        detail = ex.read().decode() if hasattr(ex, "read") else str(ex)
        for r in batch:
            failed.append({"row": r, "error": detail[:300]})
        return False


B = 500
for i in range(0, len(inserts), B):
    send(inserts[i:i + B], "return=minimal")
for i in range(0, len(updates), B):
    send(updates[i:i + B], "resolution=merge-duplicates,return=minimal")

total = req("GET", "hw_leads?select=id", None, {"Prefer": "count=exact", "Range": "0-0"})
print(json.dumps({
    "inserted": len(inserts) - len([f for f in failed if "id" not in f["row"]]),
    "updated": len(updates),
    "failed": len(failed),
    "skipped_unparsed": len(skipped),
}, indent=2))
if failed:
    print("FAILED SAMPLE:", json.dumps(failed[:3], indent=2))
if skipped:
    print("SKIPPED SAMPLE:", json.dumps(skipped[:5], indent=2))
