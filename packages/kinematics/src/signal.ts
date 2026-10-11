// 1D signal helpers for per-frame metric series.

/** Centered moving average. Window is forced odd; edges use the samples available. NaNs are skipped. */
export function smooth(values: number[], window = 5): number[] {
  const half = Math.max(0, Math.floor(window / 2));
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      const x = values[j]!;
      if (!Number.isNaN(x)) {
        sum += x;
        n++;
      }
    }
    return n === 0 ? Number.NaN : sum / n;
  });
}

/**
 * Time derivative in units per second (central difference, one-sided at the ends).
 * `timestampsMs` must be increasing and the same length as `values`.
 */
export function derivative(values: number[], timestampsMs: number[]): number[] {
  const n = values.length;
  if (n < 2) return values.map(() => 0);
  return values.map((_, i) => {
    const lo = i === 0 ? 0 : i - 1;
    const hi = i === n - 1 ? n - 1 : i + 1;
    const dt = (timestampsMs[hi]! - timestampsMs[lo]!) / 1000;
    return dt > 0 ? (values[hi]! - values[lo]!) / dt : 0;
  });
}

export function min(values: number[]): number {
  return values.reduce((m, x) => (x < m ? x : m), Number.POSITIVE_INFINITY);
}

export function max(values: number[]): number {
  return values.reduce((m, x) => (x > m ? x : m), Number.NEGATIVE_INFINITY);
}

export function mean(values: number[]): number {
  return values.length === 0 ? Number.NaN : values.reduce((s, x) => s + x, 0) / values.length;
}
