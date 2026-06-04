#!/usr/bin/env node
/**
 * T2 build-time guard: asserts every sidebar href in src/components/Layout.tsx
 * resolves to a <Route> registered in src/routes/AppRoutes.tsx.
 *
 * Run via `node scripts/check-sidebar-routes.mjs`. Non-zero exit on mismatch.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const layoutSrc = fs.readFileSync(path.join(ROOT, 'src/components/Layout.tsx'), 'utf8');
const routesSrc = fs.readFileSync(path.join(ROOT, 'src/routes/AppRoutes.tsx'), 'utf8');

// ─── Extract sidebar paths from Layout.tsx ──────────────────────────────────
const sidebarPaths = Array.from(
  layoutSrc.matchAll(/path:\s*['"]([^'"]+)['"]/g),
  (m) => m[1],
).filter((p) => p.startsWith('/'));

// ─── Walk AppRoutes.tsx, brace-aware, tracking <Route> nesting ──────────────
function extractRoutes(src) {
  const resolved = new Set();
  const stack = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('<Route', i) && /\s|>/.test(src[i + 6] ?? '')) {
      let j = i + 6;
      let depth = 0;
      while (j < src.length) {
        const c = src[j];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
        j++;
      }
      const tag = src.slice(i, j + 1);
      const selfClose = tag.replace(/\s+$/, '').endsWith('/>');
      const pm = tag.match(/path\s*=\s*"([^"]*)"/);
      if (pm) {
        const raw = pm[1];
        let full;
        if (raw.startsWith('/')) full = raw;
        else {
          const parent = stack[stack.length - 1] ?? '';
          full = raw === '' ? (parent || '/') : ((parent || '').replace(/\/$/, '') + '/' + raw);
        }
        resolved.add(full);
        if (!selfClose) stack.push(full);
      } else if (!selfClose) {
        stack.push(stack[stack.length - 1] ?? '');
      }
      i = j + 1;
      continue;
    }
    if (src.startsWith('</Route>', i)) {
      stack.pop();
      i += 8;
      continue;
    }
    i++;
  }
  return resolved;
}

const resolved = extractRoutes(routesSrc);
const exact = new Set([...resolved].filter((r) => !r.includes(':') && !r.includes('*')));
const params = [...resolved].filter((r) => r.includes(':') && !r.includes('*'));
const wilds = [...resolved]
  .filter((r) => r.endsWith('/*') && r !== '/*')
  .map((r) => r.slice(0, -2));

function matches(p) {
  if (exact.has(p)) return true;
  for (const r of params) {
    const pat = '^' + r.replace(/:[^/]+/g, '[^/]+') + '$';
    if (new RegExp(pat).test(p)) return true;
  }
  for (const w of wilds) if (p === w || p.startsWith(w + '/')) return true;
  return false;
}

const missing = [...new Set(sidebarPaths)].filter((p) => !matches(p)).sort();

if (missing.length) {
  console.error('\n❌ Sidebar → Route mismatch detected:\n');
  for (const m of missing) console.error('   ' + m);
  console.error(`\n${missing.length} sidebar href(s) have no matching <Route> in AppRoutes.tsx.\n`);
  process.exit(1);
}

console.log(`✅ All ${new Set(sidebarPaths).size} sidebar hrefs resolve to registered routes.`);
