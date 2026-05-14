/**
 * AutoTranslateRoot — wraps a subtree and live-translates all visible text
 * to the target language by walking text nodes + observing DOM mutations.
 *
 * - When language === 'en' → no-op (originals restored).
 * - When language === 'es' → batches untranslated text via the
 *   `va-translate-batch` edge function (DB-cached) and swaps `nodeValue`
 *   while preserving the original on a WeakMap so we can restore on toggle.
 *
 * Skips inputs, scripts, styles, code/pre, [data-no-translate], and any
 * pure-numeric / symbol-only / very short non-letter strings.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';

type Lang = 'en' | 'es';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SVG', 'PATH',
]);

const isTranslatableText = (s: string) => {
  const t = s.trim();
  if (t.length < 2) return false;
  // Must contain at least 2 letters
  const letters = t.match(/[A-Za-zÀ-ÿ]/g);
  if (!letters || letters.length < 2) return false;
  return true;
};

const shouldSkipNode = (node: Node): boolean => {
  let p: Node | null = node.parentNode;
  while (p && p instanceof Element) {
    if (SKIP_TAGS.has(p.tagName)) return true;
    if (p.hasAttribute('data-no-translate')) return true;
    if (p.getAttribute('contenteditable') === 'true') return true;
    p = p.parentNode;
  }
  return false;
};

export function AutoTranslateRoot({ children }: { children: React.ReactNode }) {
  const { language } = useVASession();
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Map text node → original english value
  const originals = useRef<WeakMap<Text, string>>(new WeakMap());
  // sessionStorage-backed translation cache (per-tab)
  const cache = useRef<Map<string, string>>(new Map());
  const pending = useRef<Set<Text>>(new Set());
  const flushTimer = useRef<number | null>(null);
  const inflight = useRef<Set<string>>(new Set());

  // Hydrate cache from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('va_tr_cache_es');
      if (raw) {
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) cache.current.set(k, v as string);
      }
    } catch {}
  }, []);

  const persistCache = () => {
    try {
      const obj: Record<string, string> = {};
      cache.current.forEach((v, k) => { obj[k] = v; });
      sessionStorage.setItem('va_tr_cache_es', JSON.stringify(obj));
    } catch {}
  };

  // Restore originals (used when switching back to EN)
  const restoreAll = () => {
    if (!rootRef.current) return;
    const walker = document.createTreeWalker(rootRef.current, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const tn = n as Text;
      const orig = originals.current.get(tn);
      if (orig != null && tn.nodeValue !== orig) tn.nodeValue = orig;
    }
  };

  // Apply current language to a single text node
  const applyToNode = (tn: Text, lang: Lang) => {
    if (shouldSkipNode(tn)) return;
    const current = tn.nodeValue ?? '';
    if (!originals.current.has(tn)) {
      if (!isTranslatableText(current)) return;
      originals.current.set(tn, current);
    }
    const orig = originals.current.get(tn)!;
    if (lang === 'en') {
      if (tn.nodeValue !== orig) tn.nodeValue = orig;
      return;
    }
    // es
    const key = orig.trim();
    const hit = cache.current.get(key);
    if (hit) {
      // Preserve leading/trailing whitespace from original
      const lead = orig.match(/^\s*/)?.[0] ?? '';
      const trail = orig.match(/\s*$/)?.[0] ?? '';
      tn.nodeValue = lead + hit + trail;
    } else if (!inflight.current.has(key)) {
      pending.current.add(tn);
      scheduleFlush();
    }
  };

  const scheduleFlush = () => {
    if (flushTimer.current) return;
    flushTimer.current = window.setTimeout(flush, 200);
  };

  const flush = async () => {
    flushTimer.current = null;
    const nodes = Array.from(pending.current);
    pending.current.clear();
    if (!nodes.length) return;

    const keys = Array.from(new Set(
      nodes.map((n) => (originals.current.get(n) || '').trim()).filter(Boolean),
    )).filter((k) => !cache.current.has(k) && !inflight.current.has(k));

    if (keys.length === 0) {
      // Just apply from cache
      nodes.forEach((n) => applyToNode(n, 'es'));
      return;
    }

    keys.forEach((k) => inflight.current.add(k));

    // Chunk to keep prompts manageable
    const CHUNK = 40;
    for (let i = 0; i < keys.length; i += CHUNK) {
      const slice = keys.slice(i, i + CHUNK);
      try {
        const { data, error } = await supabase.functions.invoke('va-translate-batch', {
          body: { texts: slice, target_lang: 'es' },
        });
        if (error) throw error;
        const translations: string[] = data?.translations || [];
        slice.forEach((src, idx) => {
          const tr = translations[idx] || src;
          cache.current.set(src, tr);
        });
      } catch (e) {
        // On failure, leave originals so UI doesn't break
        console.warn('[AutoTranslate] batch failed', e);
      } finally {
        slice.forEach((k) => inflight.current.delete(k));
      }
    }
    persistCache();
    // Apply now-cached translations to the captured nodes
    nodes.forEach((n) => applyToNode(n, 'es'));
  };

  // Main effect: walk + observe
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (language === 'en') {
      restoreAll();
      return;
    }

    // Initial walk
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) applyToNode(n as Text, 'es');
    if (pending.current.size) scheduleFlush();

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          applyToNode(m.target as Text, 'es');
        }
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              applyToNode(node as Text, 'es');
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
              let t: Node | null;
              while ((t = w.nextNode())) applyToNode(t as Text, 'es');
            }
          });
        }
      }
      if (pending.current.size) scheduleFlush();
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      obs.disconnect();
      if (flushTimer.current) {
        window.clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
    };
  }, [language]);

  return (
    <div ref={rootRef} className="contents" lang={language}>
      {children}
    </div>
  );
}
