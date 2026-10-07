import type { Language } from "@/lib/translation";

export type Speaker = "you" | "partner";

export type ConversationTurn = {
  nextSpeaker: Speaker;
  nextLanguage: Language;
  advanceSpeaker: boolean;
  restartMicrophone: boolean;
};

export function nextConversationTurn({
  speaker,
  myLanguage,
  otherLanguage,
  conversationMode,
  remote,
  speechFinished,
}: {
  speaker: Speaker;
  myLanguage: Language;
  otherLanguage: Language;
  conversationMode: boolean;
  remote: boolean;
  speechFinished: boolean;
}): ConversationTurn {
  const nextSpeaker: Speaker = speaker === "you" ? "partner" : "you";
  const nextLanguage = nextSpeaker === "you" ? myLanguage : otherLanguage;

  return {
    nextSpeaker,
    nextLanguage,
    advanceSpeaker: conversationMode && !remote,
    restartMicrophone:
      conversationMode && !remote && speechFinished,
  };
}
