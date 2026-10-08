import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSpeechLanguage,
  selectSpeechVoice,
} from "../components/translator/speech-voice";

test("speech language normalization accepts browser underscore locales", () => {
  assert.equal(normalizeSpeechLanguage("zh_CN"), "zh-cn");
});

test("speech voice selection prefers an exact locale", () => {
  const voices = [{ lang: "zh-TW" }, { lang: "zh-CN" }];
  assert.equal(selectSpeechVoice(voices, "zh-CN"), voices[1]);
});

test("speech voice selection falls back to the same base language", () => {
  const voices = [{ lang: "ja-JP" }, { lang: "zh-TW" }];
  assert.equal(selectSpeechVoice(voices, "zh-CN"), voices[1]);
});

test("missing device voice is left to the browser language fallback", () => {
  assert.equal(selectSpeechVoice([{ lang: "ja-JP" }], "zh-CN"), undefined);
});
