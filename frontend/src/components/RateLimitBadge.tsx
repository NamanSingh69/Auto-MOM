import { useState, useEffect, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';

const MAX_REQUESTS = 15;
const WINDOW_MS = 60_000; // 60 seconds

interface RateLimitState {
  count: number;
  resetAt: number;
}

function getRateLimitState(): RateLimitState {
  const raw = localStorage.getItem('gemini_rate_count');
  const resetRaw = localStorage.getItem('gemini_rate_reset');
  const now = Date.now();

  if (!raw || !resetRaw) {
    return { count: 0, resetAt: 0 };
  }

  const resetAt = parseInt(resetRaw, 10);
  if (now >= resetAt) {
    // Window expired — reset
    localStorage.removeItem('gemini_rate_count');
    localStorage.removeItem('gemini_rate_reset');
    return { count: 0, resetAt: 0 };
  }

  return { count: parseInt(raw, 10) || 0, resetAt };
}

export function consumeRateLimit(): boolean {
  const now = Date.now();
  let { count, resetAt } = getRateLimitState();

  // If window expired, start fresh
  if (now >= resetAt || resetAt === 0) {
    count = 0;
    resetAt = now + WINDOW_MS;
  }

  if (count >= MAX_REQUESTS) {
    const secondsLeft = Math.ceil((resetAt - now) / 1000);
    toast.error(`Rate limit reached. Resets in ${secondsLeft}s.`);
    return false;
  }

  count += 1;
  localStorage.setItem('gemini_rate_count', String(count));
  localStorage.setItem('gemini_rate_reset', String(resetAt));

  const remaining = MAX_REQUESTS - count;
  if (remaining === 2) {
    toast.warning('Rate limit: only 2 requests remaining!');
  } else if (remaining === 1) {
    toast.warning('Rate limit: only 1 request remaining!');
  }

  return true;
}

export function canMakeRequest(): boolean {
  const { count, resetAt } = getRateLimitState();
  if (resetAt === 0) return true;
  if (Date.now() >= resetAt) return true;
  return count < MAX_REQUESTS;
}

export function RateLimitBadge() {
  const [remaining, setRemaining] = useState(MAX_REQUESTS);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const refresh = useCallback(() => {
    const { count, resetAt } = getRateLimitState();
    const now = Date.now();
    setRemaining(MAX_REQUESTS - count);
    if (resetAt > now && count > 0) {
      setSecondsLeft(Math.ceil((resetAt - now) / 1000));
    } else {
      setSecondsLeft(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const pct = Math.max(0, Math.min(100, (remaining / MAX_REQUESTS) * 100));
  const isLow = remaining <= 3;
  const isExhausted = remaining <= 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
        isExhausted
          ? 'border-red-500/40 bg-red-500/10 text-red-400'
          : isLow
            ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
            : 'border-slate-700 bg-surface-2 text-slate-300'
      }`}
      aria-label={`Rate limit: ${remaining} of ${MAX_REQUESTS} requests remaining`}
      role="status"
    >
      <Zap size={14} className={isExhausted ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-brand-400'} />
      <span>
        {isExhausted && secondsLeft > 0
          ? `Resets ${secondsLeft}s`
          : `${remaining}/${MAX_REQUESTS}`
        }
      </span>
      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isExhausted ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-brand-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
