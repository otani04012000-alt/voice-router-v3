export type MicrophonePhase = "off" | "starting" | "listening" | "speech" | "ending" | "stopping" | "stopped" | "error";
export type MicrophoneEvent = "request" | "ready" | "speech" | "quiet" | "stop" | "audioend" | "end" | "error";

// Late speech events must never turn a stopped microphone back on.
export function microphoneTransition(phase: MicrophonePhase, event: MicrophoneEvent): MicrophonePhase {
  if (event === "request") return "starting";
  if (event === "error") return "error";
  if (event === "audioend" || event === "end") return phase === "error" ? "error" : "stopped";
  if (["off", "stopped", "error"].includes(phase)) return phase;
  if (event === "stop") return "stopping";
  if (phase === "stopping") return phase;
  if (event === "speech") return "speech";
  if (event === "quiet") return phase === "speech" ? "ending" : phase;
  if (event === "ready") return "listening";
  return phase;
}
