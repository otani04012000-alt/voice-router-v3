export const METER_INTERVAL_MS = 40;
export const METER_ATTACK_MS = 45;
export const METER_RELEASE_MS = 100;

export function followMeter(current: number, target: number, elapsedMs: number): number {
  const from = Number.isFinite(current) ? Math.max(0, Math.min(1, current)) : 0;
  const to = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return from;
  const tau = to > from ? METER_ATTACK_MS : METER_RELEASE_MS;
  return from + (to - from) * -Math.expm1(-elapsedMs / tau);
}
