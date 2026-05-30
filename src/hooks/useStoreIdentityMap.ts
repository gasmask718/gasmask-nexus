import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StoreIdentityMatch {
  /** Best display name (contact > owner > store). */
  primaryName: string;
  /** One-line address (street, city ST zip). */
  address: string | null;
  /** Distinct store ids matched by this phone. */
  storeIds: string[];
  /** Distinct store names (one per location). */
  storeNames: string[];
  /** True if phone maps to more than one store. */
  isMultiple: boolean;
  /** Source of primaryName, for debugging/UI hinting. */
  source: "contact" | "owner" | "store";
}

const last10 = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
};

const fetchAll = async <T,>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> => {
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  // hard safety cap
  for (let i = 0; i < 20; i++) {
    let q: any = (supabase as any).from(table).select(columns).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error || !data) break;
    out.push(...(data as T[]));
    if ((data as any[]).length < pageSize) break;
    from += pageSize;
  }
  return out;
};

const buildAddress = (s: any): string | null => {
  if (!s) return null;
  const street = s.address_street || s.address || null;
  const city = s.address_city || s.city || null;
  const state = s.address_state || s.state || null;
  const zip = s.address_zip || s.zip || null;
  const cityLine = [city, state].filter(Boolean).join(", ");
  const tail = [cityLine, zip].filter(Boolean).join(" ").trim();
  if (street && tail) return `${street}, ${tail}`;
  return street || tail || null;
};

export function useStoreIdentityMap() {
  return useQuery({
    queryKey: ["store-identity-map"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [stores, masters, contacts] = await Promise.all([
        fetchAll<any>("stores", "id, name, phone, alt_phone, address_street, address_city, address_state, address_zip", (q) =>
          q.or("phone.not.is.null,alt_phone.not.is.null")
        ),
        fetchAll<any>("store_master", "id, phone, owner_name, contact_name, address, city, state, zip", (q) =>
          q.not("phone", "is", null)
        ),
        fetchAll<any>("store_contacts", "id, store_id, name, phone", (q) => q.not("phone", "is", null)),
      ]);

      // Index stores by id for address lookup from contacts/masters
      const storeById = new Map<string, any>();
      for (const s of stores) storeById.set(s.id, s);

      // phone10 -> { storeIds:Set, contactNames:Set, ownerNames:Set, storeNames:Set, addresses:Map<storeId,address> }
      type Bucket = {
        storeIds: Set<string>;
        contactNames: Set<string>;
        ownerNames: Set<string>;
        storeNames: Set<string>;
        addressByStore: Map<string, string>;
      };
      const newBucket = (): Bucket => ({
        storeIds: new Set(),
        contactNames: new Set(),
        ownerNames: new Set(),
        storeNames: new Set(),
        addressByStore: new Map(),
      });
      const map = new Map<string, Bucket>();
      const get = (p10: string) => {
        let b = map.get(p10);
        if (!b) {
          b = newBucket();
          map.set(p10, b);
        }
        return b;
      };

      for (const s of stores) {
        const addr = buildAddress(s);
        for (const raw of [s.phone, s.alt_phone]) {
          const p10 = last10(raw);
          if (!p10) continue;
          const b = get(p10);
          b.storeIds.add(s.id);
          if (s.name) b.storeNames.add(s.name);
          if (addr) b.addressByStore.set(s.id, addr);
        }
      }

      for (const m of masters) {
        const p10 = last10(m.phone);
        if (!p10) continue;
        const b = get(p10);
        b.storeIds.add(m.id);
        const linkedStore = storeById.get(m.id);
        const addr = buildAddress(linkedStore) || buildAddress(m);
        if (addr) b.addressByStore.set(m.id, addr);
        if (m.owner_name) b.ownerNames.add(m.owner_name);
        if (m.contact_name) b.contactNames.add(m.contact_name);
        if (linkedStore?.name) b.storeNames.add(linkedStore.name);
      }

      for (const c of contacts) {
        const p10 = last10(c.phone);
        if (!p10) continue;
        const b = get(p10);
        if (c.store_id) {
          b.storeIds.add(c.store_id);
          const linkedStore = storeById.get(c.store_id);
          const addr = buildAddress(linkedStore);
          if (addr) b.addressByStore.set(c.store_id, addr);
          if (linkedStore?.name) b.storeNames.add(linkedStore.name);
        }
        if (c.name) b.contactNames.add(c.name);
      }

      // Materialize to final shape
      const out = new Map<string, StoreIdentityMatch>();
      for (const [p10, b] of map.entries()) {
        const contactName = [...b.contactNames][0];
        const ownerName = [...b.ownerNames][0];
        const storeName = [...b.storeNames][0];
        let primaryName = "";
        let source: StoreIdentityMatch["source"] = "store";
        if (contactName) {
          primaryName = contactName;
          source = "contact";
        } else if (ownerName) {
          primaryName = ownerName;
          source = "owner";
        } else if (storeName) {
          primaryName = storeName;
          source = "store";
        }
        if (!primaryName) continue;

        const storeIds = [...b.storeIds];
        // Pick address from first store with one
        let address: string | null = null;
        for (const sid of storeIds) {
          const a = b.addressByStore.get(sid);
          if (a) {
            address = a;
            break;
          }
        }

        out.set(p10, {
          primaryName,
          address,
          storeIds,
          storeNames: [...b.storeNames],
          isMultiple: storeIds.length > 1,
          source,
        });
      }

      return out;
    },
  });
}

export const phoneToKey = last10;
