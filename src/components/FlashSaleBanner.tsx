import { useActiveFlashSale, useCountdown } from "@/lib/dynastyDirect/useActiveFlashSale";

/**
 * Site-wide flash sale banner. Renders nothing when no active flash sale exists.
 * Auto-hides when the countdown reaches zero (next refetch will pick up the
 * ended state from the server).
 */
export function FlashSaleBanner() {
  const { data: sale } = useActiveFlashSale();
  const { label, expired } = useCountdown(sale?.ends_at);

  if (!sale) return null;
  if (expired) return null;

  const text = sale.banner_text || `${sale.discount_pct}% Off — Limited Time!`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-gradient-to-r from-red-700 via-red-600 to-rose-600 text-white text-sm font-semibold shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 flex-wrap">
        <span className="truncate">⚡ {text}</span>
        {sale.show_countdown !== false && (
          <span className="font-mono tabular-nums bg-black/25 rounded px-2 py-0.5">
            Ends in {label}
          </span>
        )}
      </div>
    </div>
  );
}

export default FlashSaleBanner;
