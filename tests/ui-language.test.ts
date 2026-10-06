import { test } from "node:test";
import assert from "node:assert/strict";
import { UI_TRANSLATIONS, resolveUiLanguage, translateUi, isUiLanguage } from "../components/translator/ui-language";

test("every supported interface has the same complete labels and no Japanese fallback", () => {
  const keys = Object.keys(UI_TRANSLATIONS.zh).sort();
  for (const language of ["zh", "vi", "km"] as const) {
    assert.deepEqual(Object.keys(UI_TRANSLATIONS[language]).sort(), keys);
    for (const key of keys) {
      const result = translateUi(language, key);
      assert.ok(result.trim(), `${language}: ${key}`);
      assert.equal(/[ぁ-んァ-ヶ]/.test(result), false, `${language}: ${key}`);
    }
  }
});

test("invitation locale wins over saved preferences and accepts Vietnamese and Khmer", () => {
  assert.equal(resolveUiLanguage(new URLSearchParams("ui=vi&from=ja"), "zh", "ja-JP"), "vi");
  assert.equal(resolveUiLanguage(new URLSearchParams("from=km"), "ja", "ja-JP"), "km");
  assert.equal(resolveUiLanguage(new URLSearchParams("ui=invalid"), "vi", "ja-JP"), "vi");
  assert.equal(resolveUiLanguage(new URLSearchParams(), null, "km-KH"), "km");
  assert.equal(resolveUiLanguage(new URLSearchParams(), null, "en-US"), "ja");
  assert.equal(isUiLanguage("__proto__"), false);
});

test("dynamic notices preserve names and counts and never interpret arbitrary text as dictionary objects", () => {
  assert.equal(translateUi("vi", "Linhさんから新着メッセージが届きました。"), "Linh đã gửi tin nhắn mới.");
  assert.equal(translateUi("vi", "Linhさんとして入室します。"), "Linh — đang vào phòng.");
  assert.equal(translateUi("km", "2人の部屋"), "បន្ទប់មាន 2 នាក់");
  assert.equal(translateUi("vi", "Daraさんが退室しました。"), "Dara đã rời phòng.");
  for (const language of ["ja", "zh", "vi", "km"] as const) {
    assert.equal(translateUi(language, "__proto__"), "__proto__");
    assert.equal(translateUi(language, "constructor"), "constructor");
    assert.equal(translateUi(language, "Linh / Dara / 小王"), "Linh / Dara / 小王");
  }
});
