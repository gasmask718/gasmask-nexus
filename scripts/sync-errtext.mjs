#!/usr/bin/env node
/**
 * errText lives twice: the Deno edge copy and the browser copy. Neither runtime
 * can import the other's path, so the mirror is generated rather than trusted.
 * Default run rewrites the mirror; --check fails the build when it has drifted.
 */
import { readFileSync, writeFileSync } from "node:fs";

const CANONICAL = "supabase/functions/_shared/errText.ts";
const MIRROR = "src/lib/errText.ts";

const canonical = readFileSync(CANONICAL, "utf8");
const check = process.argv.includes("--check");

let mirror = "";
try {
  mirror = readFileSync(MIRROR, "utf8");
} catch {
  /* missing mirror is a drift, handled below */
}

if (canonical === mirror) {
  if (!check) console.log(`errText mirror already in sync (${MIRROR}).`);
  process.exit(0);
}

if (check) {
  console.error(
    `\n✖ errText mirror drift.\n  ${MIRROR} does not match ${CANONICAL}.\n` +
      `  Edit the canonical file, then run: npm run sync:errtext\n`
  );
  process.exit(1);
}

writeFileSync(MIRROR, canonical);
console.log(`Regenerated ${MIRROR} from ${CANONICAL}.`);
