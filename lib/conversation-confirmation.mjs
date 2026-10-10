export const MAX_RETRIES = 2;
export function initialConversation(language = "ja") {
  return {phase:"off", language, original:"", retries:0, turn:0, error:null};
}
const normalize = text => String(text).normalize("NFKC").toLowerCase().replace(/[\s。、，！？!?.,]/g, "");
export function classifyCommand(text, phase) {
  if (!["listening","draining"].includes(phase)) return null;
  const value = normalize(text);
  if (["送る","发送","發送"].includes(value)) return "A";
  if (["最初から","重新录音","重新錄音"].includes(value)) return "B";
  return null;
}
export function transition(state, event) {
  const next = (changes, effects=[]) => ({state:{...state,...changes},effects});
  if (event.type === "STOP") return next({phase:"off",turn:state.turn+1},[{type:"stopRecognition"},{type:"cancelSpeech"}]);
  if (event.turn !== undefined && event.turn !== state.turn) return next({});
  if (event.type === "START" && state.phase === "off") return next({phase:"listening",original:"",retries:0,turn:state.turn+1,error:null},[{type:"startRecognition",purpose:"dictation"}]);
  if (event.type === "ERROR") return next({phase:"error",error:event.message,turn:state.turn+1},[{type:"stopRecognition"},{type:"cancelSpeech"}]);
  const active = ["listening","draining"].includes(state.phase);
  if (event.type === "TRANSCRIPT" && active) return next({original:String(event.text)});
  if (event.type === "SILENCE" && state.phase === "listening") return next({phase:"draining"});
  if (event.type === "VOICE" && state.phase === "draining") return next({phase:"listening"});
  const command = event.type === "COMMAND" && event.final === true ? classifyCommand(event.text,state.phase) : null;
  if (command === "B") {
    if (state.retries >= MAX_RETRIES) return next({phase:"manual",turn:state.turn+1},[{type:"stopRecognition"},{type:"offerManualInput",original:state.original}]);
    return next({phase:"listening",original:"",retries:state.retries+1,turn:state.turn+1},[{type:"stopRecognition"},{type:"startRecognition",purpose:"dictation"}]);
  }
  if (command === "A" || (event.type === "INPUT_ENDED" && active)) {
    if (!state.original.trim()) return next({phase:"listening",turn:state.turn+1},[{type:"startRecognition",purpose:"dictation"}]);
    return next({phase:"translating"},[{type:"stopRecognition"},{type:"translateAndSend",original:state.original,language:state.language}]);
  }
  if (event.type === "TRANSLATED" && state.phase === "translating") return next({phase:"speaking"},[{type:"speakTranslation",text:event.text,language:event.target}]);
  if (event.type === "PLAYBACK_ENDED" && state.phase === "speaking") return next({phase:"standby",retries:0},[{type:"awaitNextSpeaker"}]);
  if (event.type === "NEXT_TURN" && state.phase === "standby") return next({phase:"listening",original:"",retries:0,turn:state.turn+1},[{type:"startRecognition",purpose:"dictation"}]);
  return next({});
}
