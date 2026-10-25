// マイク受付の状態を「中央へ集まる度合い(progress)」1本で表す。
// 0 = 受付中で大きく開いている / 1 = 受付終了で中央に集まりきった。
//
// Chrome の continuous=false では、話し終えてから約1秒の無音でブラウザが受付を切り、
// speechend / audioend / end はほぼ同時に届く。そのため「ending」状態はほぼ一瞬で、
// 切れる前の予兆として使えるのは音量（無音が続いている時間）だけ。
//  - 話している間        : 開く（0）
//  - 話し終えて無音が続く : 無音の長さに比例して HOLD まで集まる（=切れるまでのカウントダウン）
//  - 実際に受付が切れた  : 残りを CLOSE_MS で一気に閉じる（=切れた瞬間が目で分かる）
export type Convergence = {
  phase: string; progress: number; last: number;
  quietMs: number; spoke: boolean; peak: number;
  closingAt: number | null; closingFrom: number;
};
export const EXPECT_MS = 900;   // 話し終えてからブラウザが切るまでの目安
export const HOLD = .8;         // 受付が続いている間はここまでしか集まらない
export const CLOSE_MS = 420;    // 停止通知から閉じ切るまで
const OPEN_TAU = 90, CLOSE_TAU = 140, HEARD_MIN = .035, HEARD_RATIO = .2;

export function initialConvergence(now: number): Convergence {
  return { phase: 'off', progress: .85, last: now, quietMs: 0, spoke: false, peak: 0, closingAt: null, closingFrom: .85 };
}

// level: 0〜1 の音量。計測できない時は null。
export function advanceConvergence(s: Convergence, now: number, phase: string, level: number | null): Convergence {
  now = Math.max(s.last, now);
  const dt = now - s.last;
  const n: Convergence = { ...s, last: now, phase };
  if (phase === 'starting' && s.phase !== 'starting') Object.assign(n, { closingAt: null, quietMs: 0, spoke: false, peak: 0 });
  if (['stopping', 'stopped', 'error'].includes(phase) && n.closingAt === null) { n.closingAt = now; n.closingFrom = s.progress; }
  if (n.closingAt !== null) {
    const x = Math.max(0, Math.min(1, (now - n.closingAt) / CLOSE_MS));
    n.progress = n.closingFrom + (1 - n.closingFrom) * (1 - (1 - x) ** 3);
    return n;
  }
  let target = .85;
  if (phase === 'starting') target = .45;
  else if (['listening', 'speech', 'ending'].includes(phase)) {
    let heard: boolean;
    if (level === null || !Number.isFinite(level)) heard = phase === 'speech';
    else { n.peak = Math.max(n.peak, level); heard = level > Math.max(HEARD_MIN, n.peak * HEARD_RATIO); }
    if (heard || phase === 'speech') n.spoke = true;
    n.quietMs = heard ? 0 : n.spoke ? n.quietMs + dt : 0;
    target = n.spoke ? HOLD * Math.min(1, n.quietMs / EXPECT_MS) : 0;
    if (phase === 'ending') target = Math.max(target, HOLD);
  }
  n.progress += (target - n.progress) * -Math.expm1(-dt / (target > n.progress ? CLOSE_TAU : OPEN_TAU));
  return n;
}
