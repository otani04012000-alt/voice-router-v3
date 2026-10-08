import { test } from "node:test";
import assert from "node:assert/strict";
import { planSpeech, playSpeechSequence } from "../components/translator/speech-playback";

test("Japanese and Chinese questions retain words and punctuation", () => {
  for (const text of ["こんにちは。お元気ですか？はい、元気です。", "你好。你好吗？我很好，谢谢！"]) {
    const plan = planSpeech(text);
    assert.equal(plan.map((segment) => segment.text).join(""), text);
    assert.equal(plan.length, 3);
    assert.equal(plan[2].pauseAfter, 0);
  }
  assert.equal(planSpeech("「本当？」はい。")[0].text, "「本当？」");
  assert.equal(planSpeech("価格は3.14です。").length, 1);
});

test("short replies are brisk, long explanations slower, slow mode stays slow", () => {
  assert.equal(planSpeech("谢谢！")[0].rate, 1);
  assert.equal(planSpeech("説明".repeat(40) + "。")[0].rate, 0.9);
  assert.ok(planSpeech("你好。你好吗？", true).every((segment) => segment.rate === 0.7));
  assert.deepEqual(planSpeech(" \n "), []);
});

function playback() {
  const spoken: string[] = [];
  const events: { end: () => void; error: () => void }[] = [];
  let pending: (() => void) | undefined;
  let finishes = 0;
  const cancel = playSpeechSequence(planSpeech("你好。你好吗？"), (segment, end, error) => {
    spoken.push(segment.text);
    events.push({ end, error });
  }, () => { finishes++; }, (callback, delay) => {
    assert.equal(delay, 140);
    pending = callback;
    return () => { pending = undefined; };
  });
  return { spoken, events, cancel, flush: () => { const callback = pending; pending = undefined; callback?.(); }, finishes: () => finishes };
}

test("speaker handoff happens once only after the last sentence", () => {
  const p = playback();
  p.events[0].end();
  assert.equal(p.finishes(), 0);
  p.flush();
  assert.deepEqual(p.spoken, ["你好。", "你好吗？"]);
  p.events[1].end();
  p.events[1].end();
  assert.equal(p.finishes(), 1);
});

test("stop during playback or a pause cancels remaining speech and handoff", () => {
  for (const duringPause of [false, true]) {
    const p = playback();
    if (duringPause) p.events[0].end();
    p.cancel();
    p.events[0].end();
    p.flush();
    assert.deepEqual(p.spoken, ["你好。"]);
    assert.equal(p.finishes(), 0);
  }
});

test("speech failure never advances the speaker", () => {
  const p = playback();
  p.events[0].error();
  p.events[0].end();
  p.flush();
  assert.equal(p.finishes(), 0);
  assert.equal(p.spoken.length, 1);
});
