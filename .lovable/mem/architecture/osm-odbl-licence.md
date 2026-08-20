---
name: OSM ODbL Licence Constraint
description: OpenStreetMap-sourced leads are ODbL — internal enrichment/outreach fine, publishing or selling a derived list triggers share-alike; tag rows source='osm'
type: constraint
---

Any lead/store data sourced from OpenStreetMap (Overpass) is licensed **ODbL 1.0**.

- Internal use — enriching our own records, outreach, routing, territory planning — is unrestricted.
- **Publishing, selling, or handing a derived list to a partner triggers share-alike**: the derived database must be released under ODbL with attribution.
- **Why:** the obligation attaches to the derived database, not the individual fact, so it survives merging into our own tables.
- **How to apply:** every ingested OSM row carries `source = 'osm'` so derived-list exposure is traceable. OSM-sourced rows are never included in `show_on_public_site` surfaces, public views, or any list sold or shared externally.

Measured baseline (2026-08-20, Brooklyn): 2,172 OSM shop features vs 1,196 live Brooklyn `store_master` rows → 90 overlap, 2,082 new (858 with a phone), 12 phone enrichments. See `docs/territory/OSM-BROOKLYN-OVERLAP-2026-08-20.md`.
