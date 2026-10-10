export const MAX_RETRIES = 2;
export function initialConversation(language = "ja") {
  return { phase: "off", language, original: "", retries: 0, turn: 0, error: null };
}
const normalize = value => String(value).normalize("NFKC").toLowerCase().replace(/[\s。、，！？!?.,]/g, "");
const commands = {
  A: ["送信確認", "确认发送", "確認發送"],
  B: ["最初から", "重新录音", "重新錄音"],
  YES: ["はい", "送って", "yes", "是", "发送", "發送"],
  NO: ["いいえ", "やり直し", "no", "否", "重来", "重來"]
};
export function classifyCommand(text, phase) {
  const allowed = ["listening", "draining"].includes(phase) ? ["A", "B"] : phase === "confirming" ? ["B", "YES", "NO"] : [];
  const word = normalize(text);
  return allowed.find(key => commands[key].some(value => normalize(value) === word)) ?? null;
}
export function confirmationPrompt(language) {
  return language === "zh" ? "大致对吗？" : "だいたい合ってる？";
}
export function transition(state, event) {
  const next = (changes, effects = []) => ({ state: { ...state, ...changes }, effects });
  const retry = () => state.retries >= MAX_RETRIES
    ? next({ phase: "manual" }, [{ type: "stopRecognition" }, { type: "offerManualInput", original: state.original }])
    : next({ phase: "listening", original: "", retries: state.retries + 1, turn: state.turn + 1 }, [{ type: "stopRecognition" }, { type: "startRecognition", purpose: "dictation" }]);
  if (event.type === "STOP") return next({ phase: "off", turn: state.turn + 1 }, [{ type: "stopRecognition" }, { type: "cancelSpeech" }]);
  if (event.turn !== undefined && event.turn !== state.turn) return next({});
  if (event.type === "START" && state.phase === "off") return next({ phase: "listening", original: "", retries: 0, turn: state.turn + 1, error: null }, [{ type: "startRecognition", purpose: "dictation" }]);
  if (event.type === "ERROR") return next({ phase: "error", error: event.message, turn: state.turn + 1 }, [{ type: "stopRecognition" }, { type: "cancelSpeech" }]);
  if (event.type === "TRANSCRIPT" && ["listening", "draining"].includes(state.phase)) return next({ original: String(event.text) });
  if (event.type === "SILENCE" && state.phase === "listening") return next({ phase: "draining" });
  if (event.type === "VOICE" && state.phase === "draining") return next({ phase: "listening" });
  const command = event.type === "COMMAND" && event.final === true ? classifyCommand(event.text, state.phase) : null;
  if (command === "B" || command === "NO") return retry();
  if (command === "YES" && state.original.trim()) return next({ phase: "translating" }, [{ type: "stopRecognition" }, { type: "translateAndSend", original: state.original, language: state.language }]);
  if (command === "A" || (event.type === "INPUT_ENDED" && ["listening", "draining"].includes(state.phase))) {
    if (!state.original.trim()) return next({ phase: "listening" }, [{ type: "startRecognition", purpose: "dictation" }]);
    return next({ phase: "prompting" }, [{ type: "stopRecognition" }, { type: "speakPrompt", text: confirmationPrompt(state.language) }]);
  }
  if (event.type === "PROMPT_ENDED" && state.phase === "prompting") return next({ phase: "confirming" }, [{ type: "startRecognition", purpose: "confirmation" }]);
  if (event.type === "TRANSLATED" && state.phase === "translating") return next({ phase: "speaking" }, [{ type: "speakTranslation", text: event.text, language: event.target }]);
  if (event.type === "PLAYBACK_ENDED" && state.phase === "speaking") return next({ phase: "standby", retries: 0 }, [{ type: "awaitNextSpeaker" }]);
  if (event.type === "NEXT_TURN" && state.phase === "standby") return next({ phase: "listening", original: "", retries: 0, turn: state.turn + 1 }, [{ type: "startRecognition", purpose: "dictation" }]);
  return next({});
}
