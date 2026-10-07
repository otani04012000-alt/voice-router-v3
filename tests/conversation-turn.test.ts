import { test } from "node:test";
import assert from "node:assert/strict";
import { nextConversationTurn } from "../components/translator/conversation-turn";

test("local conversation alternates from the user to the partner", () => {
  assert.deepEqual(
    nextConversationTurn({
      speaker: "you",
      myLanguage: "ja",
      otherLanguage: "km",
      conversationMode: true,
      remote: false,
      speechFinished: true,
    }),
    {
      nextSpeaker: "partner",
      nextLanguage: "km",
      advanceSpeaker: true,
      restartMicrophone: true,
    },
  );
});

test("local conversation alternates back to the user", () => {
  assert.deepEqual(
    nextConversationTurn({
      speaker: "partner",
      myLanguage: "ja",
      otherLanguage: "km",
      conversationMode: true,
      remote: false,
      speechFinished: true,
    }),
    {
      nextSpeaker: "you",
      nextLanguage: "ja",
      advanceSpeaker: true,
      restartMicrophone: true,
    },
  );
});

test("shared rooms never restart the other person's microphone", () => {
  const next = nextConversationTurn({
    speaker: "you",
    myLanguage: "ja",
    otherLanguage: "km",
    conversationMode: true,
    remote: true,
    speechFinished: true,
  });
  assert.equal(next.advanceSpeaker, false);
  assert.equal(next.restartMicrophone, false);
});

test("turn does not restart after conversation mode is switched off", () => {
  const next = nextConversationTurn({
    speaker: "you",
    myLanguage: "ja",
    otherLanguage: "km",
    conversationMode: false,
    remote: false,
    speechFinished: true,
  });
  assert.equal(next.restartMicrophone, false);
});

test("turn does not restart before speech playback finishes", () => {
  const next = nextConversationTurn({
    speaker: "you",
    myLanguage: "ja",
    otherLanguage: "km",
    conversationMode: true,
    remote: false,
    speechFinished: false,
  });
  assert.equal(next.restartMicrophone, false);
});
