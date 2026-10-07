import { test } from "node:test";
import assert from "node:assert/strict";
import { microphoneTransition as next, type MicrophonePhase } from "../components/translator/microphone-state";
test("microphone shows readiness only after capture starts and speech only on detection", () => {
  let phase: MicrophonePhase = next("off", "request");
  assert.equal(phase, "starting");
  phase = next(phase, "ready"); assert.equal(phase, "listening");
  phase = next(phase, "speech"); assert.equal(phase, "speech");
  phase = next(phase, "quiet"); assert.equal(phase, "ending");
  phase = next(phase, "speech"); assert.equal(phase, "speech");
  phase = next(phase, "quiet"); assert.equal(phase, "ending");
  assert.equal(next(phase, "audioend"), "stopped");
});
test("stop remains pending until audio ends; late callbacks cannot revive capture", () => {
  const phase = next("speech", "stop"); assert.equal(phase, "stopping");
  for (const event of ["ready", "speech", "quiet"] as const) assert.equal(next(phase, event), "stopping");
  assert.equal(next(phase, "end"), "stopped");
  assert.equal(next("stopped", "speech"), "stopped");
  assert.equal(next("stopped", "request"), "starting");
});
test("silence enters a visible ending phase but speech can resume before cutoff", () => {
  assert.equal(next("speech", "quiet"), "ending");
  assert.equal(next("ending", "speech"), "speech");
  assert.equal(next("ending", "stop"), "stopping");
});
test("permission and service errors remain visible after the session ends", () => {
  const phase = next("starting", "error");
  assert.equal(next(phase, "audioend"), "error");
  assert.equal(next(phase, "end"), "error");
  assert.equal(next(phase, "ready"), "error");
  assert.equal(next(phase, "request"), "starting");
});
