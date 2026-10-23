import test from 'node:test';
import assert from 'node:assert/strict';
import { followMeter } from '../components/translator/voice-meter';
function run(step: number, target: number, initial: number, duration: number) { let value = initial; for (let t = 0; t < duration;) { const dt = Math.min(step, duration - t); value = followMeter(value, target, dt); t += dt; } return value; }
test('release uses elapsed time at 60 Hz, 25 Hz, 2 Hz and 1 Hz', () => { const values = [1000 / 60, 40, 500, 1000].map(dt => run(dt, 0, 1, 1000)); assert.ok(Math.max(...values) - Math.min(...values) < 1e-12); });
test('attack uses elapsed time at different sampling rates', () => { const values = [1000 / 60, 40, 500, 1000].map(dt => run(dt, 1, 0, 1000)); assert.ok(Math.max(...values) - Math.min(...values) < 1e-12); });
test('silence crosses the voice threshold within 360 ms', () => assert.ok(run(40, 0, 1, 360) < .035));
test('a delayed silent sample does not retain stale energy', () => assert.ok(followMeter(1, 0, 500) < .035));
test('speech responds on the next 40 ms measurement', () => assert.ok(followMeter(0, .2, 40) > .035));
test('speech resumes after silence', () => assert.ok(followMeter(followMeter(1, 0, 500), .7, 40) > .035));
test('long pauses remain bounded', () => assert.equal(followMeter(1, 0, 60000), 0));
test('zero elapsed time preserves the value', () => assert.equal(followMeter(.4, 0, 0), .4));
test('backwards time preserves the value', () => assert.equal(followMeter(.4, 0, -20), .4));
test('invalid input stays finite', () => assert.ok(Number.isFinite(followMeter(NaN, Infinity, 40))));
test('out-of-range inputs stay bounded', () => { const value = followMeter(-2, 3, 40); assert.ok(value >= 0 && value <= 1); });
test('irregular intervals match total elapsed time', () => { let value = 1; for (const dt of [40, 170, 20, 410, 360]) value = followMeter(value, 0, dt); assert.ok(Math.abs(value - followMeter(1, 0, 1000)) < 1e-12); });
