#!/usr/bin/env python3
"""One-time (repeatable) Highway lead geocoding backfill.

Reads hw_leads rows missing lat/long, sends them to the free US Census Bureau
batch geocoder (no API key required), and loads matched coordinates into
public.hw_geocode_staging. A separate SQL step applies staging -> hw_leads.

Reads use psql (select). Writes go to the staging table only (insert), which is
the access the sandbox role has; hw_leads itself is updated by a reviewed
UPDATE ... FROM statement afterwards.

Usage: python3 scripts/geocode-hw-leads.py [chunk_size]
"""
import csv
import io
import os
import subprocess
import sys
import time
import urllib.request

CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
CHUNK = int(sys.argv[1]) if len(sys.argv) > 1 else 500
BENCHMARK = "Public_AR_Current"


def psql(sql: str) -> str:
    return subprocess.run(
        ["psql", "-t", "-A", "-F", "\t", "-c", sql],
        capture_output=True, text=True, check=True,
    ).stdout


def fetch_pending():
    sql = (
        "COPY (SELECT id, coalesce(address,''), coalesce(city,''), state, '' "
        "FROM hw_leads WHERE (lat IS NULL OR long IS NULL) "
        "AND address IS NOT NULL AND btrim(address) <> '' "
        "AND city IS NOT NULL AND btrim(city) <> '' "
        "AND state IS NOT NULL "
        "AND id NOT IN (SELECT lead_id FROM hw_geocode_staging)) "
        "TO STDOUT WITH CSV"
    )
    out = subprocess.run(["psql", "-c", sql], capture_output=True, text=True, check=True).stdout
    return list(csv.reader(io.StringIO(out)))


def post_batch(rows):
    """Multipart POST of a CSV chunk. Returns list of (id, lat, long, matched)."""
    buf = io.StringIO()
    w = csv.writer(buf)
    for r in rows:
        w.writerow(r)
    payload = buf.getvalue().encode()

    boundary = "----hwgeo%d" % time.time_ns()
    parts = []

    def field(name, value):
        parts.append(
            ("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (boundary, name, value)).encode()
        )

    parts.append(
        ("--%s\r\nContent-Disposition: form-data; name=\"addressFile\"; filename=\"a.csv\"\r\n"
         "Content-Type: text/csv\r\n\r\n" % boundary).encode()
    )
    parts.append(payload)
    parts.append(b"\r\n")
    field("benchmark", BENCHMARK)
    parts.append(("--%s--\r\n" % boundary).encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        CENSUS_URL, data=body, method="POST",
        headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary},
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        text = resp.read().decode("utf-8", "replace")

    matched = []
    for row in csv.reader(io.StringIO(text)):
        # id, input address, "Match"/"No_Match", exact/non-exact, matched address, "lon,lat", tiger id, side
        if len(row) >= 6 and row[2] == "Match":
            try:
                lon, lat = row[5].split(",")
                matched.append((row[0], float(lat), float(lon), row[4]))
            except ValueError:
                continue
    return matched


def load_staging(matched):
    if not matched:
        return
    buf = io.StringIO()
    w = csv.writer(buf)
    for m in matched:
        w.writerow(m)
    subprocess.run(
        ["psql", "-c", "COPY hw_geocode_staging (lead_id, lat, long, matched_address) FROM STDIN WITH CSV"],
        input=buf.getvalue(), text=True, check=True,
    )


def main():
    rows = fetch_pending()
    print("pending rows: %d" % len(rows), flush=True)
    total_matched = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        for attempt in range(3):
            try:
                m = post_batch(chunk)
                break
            except Exception as e:  # network / 502 from Census
                print("  chunk %d attempt %d failed: %s" % (i // CHUNK, attempt + 1, e), flush=True)
                m = []
                time.sleep(5)
        load_staging(m)
        total_matched += len(m)
        print("chunk %d: %d/%d matched (running total %d)"
              % (i // CHUNK, len(m), len(chunk), total_matched), flush=True)
    print("DONE: %d matched of %d attempted" % (total_matched, len(rows)))


if __name__ == "__main__":
    main()
