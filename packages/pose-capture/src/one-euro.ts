/**
 * One Euro filter (Casiez et al., 2012): a low-pass filter whose cutoff rises with speed, so a still joint
 * stops jittering while a fast one isn't dragged behind.
 */
export interface OneEuroParams {
  /** Cutoff (Hz) when the signal is still. Lower = smoother at rest. */
  minCutoff: number;
  /** How fast the cutoff rises with speed. Higher = less lag when moving. */
  beta: number;
  /** Cutoff (Hz) for the speed estimate itself. */
  dCutoff: number;
}

/**
 * Tuned for normalized image coordinates and meters at lifting speeds. Signal-processing settings, not clinical
 * values; MediaPipe already smooths a little in VIDEO mode, so this is deliberately light.
 */
export const DEFAULT_ONE_EURO: OneEuroParams = { minCutoff: 1, beta: 40, dCutoff: 1 };

const alpha = (cutoff: number, dtSec: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtSec);
};

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private tMs = 0;
  private readonly params: OneEuroParams;

  constructor(params: OneEuroParams = DEFAULT_ONE_EURO) {
    this.params = params;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
  }

  filter(value: number, timestampMs: number): number {
    if (this.x === null || timestampMs <= this.tMs) {
      this.x = value;
      this.tMs = timestampMs;
      return value;
    }
    const dt = (timestampMs - this.tMs) / 1000;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.params.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    this.tMs = timestampMs;
    return this.x;
  }
}
