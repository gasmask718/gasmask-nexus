## Scope

Two files only.

- **CREATE** `src/components/map/GeoMapView.tsx`
- **MODIFY** `src/components/territory/TerritoryMapView.tsx` → thin adapter
- **UNTOUCHED**: `src/pages/territory/TerritoryOverview.tsx` — its `<TerritoryMapView />` at line 144 keeps working because the zero-prop signature is preserved

The UT Partner Map page is explicitly NOT created in this pass.

---

## 1. `src/components/map/GeoMapView.tsx` (new)

### Exported types

```ts
export interface GeoPoint {
  id: string;
  lng: number;
  lat: number;
  title: string;
  subtitle?: string;
  groupKey?: string;
  statusKey?: string;
  meta?: Record<string, any>;
}
```

Props exactly as you specified, plus defaults `showHulls = false`, `clustering = false`. Unknown `statusKey` falls back to `#6b7280` — the current fallback in `statusColor`.

### Moved unchanged

- `convexHull` (`:83-118`) — Andrew's monotone chain, verbatim
- `padHull` (`:121-129`) — verbatim
- Group → hull memo (`:155-182`), with `resolveBoroughForCity(a.city)` swapped for `resolveGroup(p)`; `TERRITORY_COLORS` stays in GeoMapView (generic palette, no GasMask meaning)
- Layer pipeline (`:261-319`): `fill` @ 0.15, `line` width 2 / 0.8, `symbol` label `${name} (${count})` in `DIN Pro Medium`, hover → 0.35, click → select group
- Marker path (`:332-362`): 8px circle div, `1px rgba(255,255,255,0.4)` border, popup `offset: 10, closeButton: false`
- `flyTo` (`:364-375`) — zoom 16, duration 1200
- `fitBounds` on group filter (`:322-326`) — padding 60, duration 800
- Map init (`:208-224`): `dark-v11`, `NavigationControl` top-left, `mapLoaded` state
- Chrome: filter `Select` top-right, `Search` `Input`, 380px slide-out panel, `ScrollArea`, close button

### One addition to your prop list

Today's popup HTML (`:356`) hardcodes `store_name` / `full_address` / `phone` / `discovery_status` / `discovered_by`. To keep GasMask's popup byte-identical without leaking those field names into the shared component, I'll add:

```ts
renderPopupHTML?: (p: GeoPoint) => string;
```

TerritoryMapView passes the exact current template. Without it, GeoMapView falls back to generic `title` / `subtitle` / `statusKey` markup. Flagging because it's outside your stated prop list.

### Fix 1 — clean teardown

`:231-255` currently removes layers three times and contains a dead no-op loop (`:235-242`). Replaced with one pass over explicit refs:

```ts
layerIdsRef.current.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
sourceIdsRef.current.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
layerIdsRef.current = [];
sourceIdsRef.current = [];
```

A new `sourceIdsRef` tracks sources directly instead of deriving them via layer-id string surgery.

### Fix 2 — slugified layer IDs

`slug(name) = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')`. IDs become `grp-<slug>-fill` / `-line` / `-label`, source `grp-<slug>-src`. Kills the `Staten Island-fill` latent bug. A `slug → display name` map keeps click handlers resolving to the real group name.

### Fix 3 — handler leak (not previously flagged)

The current code calls `map.on('mouseenter'|'mouseleave'|'click', fillId, ...)` on every redraw and never calls `map.off`. Since layer IDs were stable, duplicate handlers silently stacked on each filter change. Teardown will now `map.off` the three handlers before layer removal. Not user-observable — handlers were idempotent.

### NEW — clustering (`clustering === true`)

Entirely separate branch; the marker path is untouched when `false`.

- GeoJSON source `pts-src`, `cluster: true`, `clusterMaxZoom: 14`, `clusterRadius: 50`; features carry `id`, `title`, `subtitle`, `statusKey`
- `clusters` — `circle`, `filter: ['has','point_count']`, step-scaled radius + colour
- `cluster-count` — `symbol`, `{point_count_abbreviated}`
- `unclustered-point` — `circle`, `filter: ['!',['has','point_count']]`, colour from `['match', ['get','statusKey'], ...flatten(statusColors), '#6b7280']`
- Cluster click → `getClusterExpansionZoom` → `easeTo`
- Point click → resolve by `id` → `onPointClick` + open detail panel
- Pointer cursor on both layers
- `points` changes update via `setData`, not teardown/rebuild

### Token guard

Mirrors `src/components/ambassador/AmbassadorStoreMap.tsx:142-162`: when `!import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN`, render a bordered placeholder — `Map unavailable: VITE_MAPBOX_PUBLIC_TOKEN is not configured.` — and skip map init. Semantic tokens only (`bg-muted/30`, `text-muted-foreground`), no hardcoded colours.

### Purity guarantee

Zero occurrences of `territory_addresses`, `borough`, `grabba`, `store_name`, `discovery_status`, `supabase`, `useQuery`. Verified with `rg -i` and pasted.

---

## 2. `src/components/territory/TerritoryMapView.tsx` (adapter, ~140 lines)

Signature unchanged: `export function TerritoryMapView()` — zero props.

**Kept locally (GasMask-specific):**
- `BOROUGH_CITY_MAP` (`:16-22`) — verbatim
- `resolveBoroughForCity` (`:24-30`) — verbatim
- `interface TerritoryAddress` (`:32-49`) — verbatim
- `statusColor` (`:64-72`) → flattened to `STATUS_COLORS = { new:'#3b82f6', verified:'#22c55e', rejected:'#ef4444', pending_visit:'#eab308' }`, passed as `statusColors`
- `statusBadgeVariant` (`:74-80`) — verbatim, used in `renderListItem`
- The `useQuery` block (`:141-152`) — verbatim: same `queryKey: ['territory-map-addresses']`, same 16-column select, same two `.not(...)` filters

**Mapping:**

```ts
const points: GeoPoint[] = useMemo(() => addresses
  .filter(a => a.latitude != null && a.longitude != null)
  .map(a => ({
    id: a.id,
    lng: a.longitude!,
    lat: a.latitude!,
    title: a.store_name || 'Unknown Store',
    subtitle: a.full_address || '—',
    groupKey: resolveBoroughForCity(a.city || 'Unknown'),
    statusKey: (a.discovery_status || 'new').toLowerCase(),
    meta: a,
  })), [addresses]);
```

**Props passed:** `showHulls`, `clustering={false}`, `initialCenter={[-73.95, 40.73]}`, `initialZoom={10.5}`, `resolveGroup={p => p.groupKey ?? null}`, `groupFilterLabel="All Territories"`, `searchFields` returning `store_name` / `full_address` / `notes` / `discovered_by`, `renderPopupHTML` with the exact `:356` template, `renderListItem` reproducing `:448-484` verbatim (MapPin + address, `address_type` outline badge, `Eye` + `discovered_by`, `created_at` locale date, `statusBadgeVariant` badge, and the `verified_sells_grabba` → green `CheckCircle` **Grabba** badge at `:478-482`), `renderDetail` supplying the `"{n} ingested addresses"` header copy (`:415`), and the `No addresses found` `emptyState`.

---

## Behavioural deltas — full disclosure

Everything visible is identical. Three internal changes, none observable:

| Change | Observable? |
|---|---|
| Layer IDs slugified | No — internal to Mapbox |
| Teardown collapsed to one pass | No — same end state |
| `map.off` before removal | No — fixes a leak |

Genuine risk: popup and list markup move across a file boundary as render props. I'll diff the rendered output against the original rather than eyeballing it.

---

## Verification before reporting done

1. `rg -n "export function TerritoryMapView" src/` → zero-prop signature
2. `git diff --stat src/pages/territory/TerritoryOverview.tsx` → empty, pasted verbatim
3. `rg -in "territory_addresses|borough|grabba|store_name|discovery_status|supabase" src/components/map/GeoMapView.tsx` → zero hits, pasted
4. `rg -n "clustering" src/components/territory/TerritoryMapView.tsx` → `clustering={false}` only
5. `tsgo` typecheck clean
6. Playwright on the territory overview in map mode: screenshot, confirm NYC center, labelled borough polygons, coloured markers; click a polygon → panel opens; confirm a Grabba badge renders; check console for Mapbox errors

Say **apply** and I'll write both files.