"use client";
import {useEffect} from "react";
const labels:Record<string,[string,string]>={off:["マイク停止・開始ボタンで受付開始","麦克风已关闭，请点击开始"],starting:["マイク準備中・まだ話さないでください","麦克风准备中，请稍候"],listening:["音声受付中・話せます","正在接收语音，可以说话"],speech:["聞き取り中","正在聆听"],ending:["発話の区切りを検出・受付状態を確認中","检测到停顿，正在确认接收状态"],stopping:["マイク停止中","正在关闭麦克风"],stopped:["マイク停止・音声受付は終了しました","麦克风已关闭，语音接收已结束"],error:["音声受付エラー・マイクを確認してください","语音接收错误，请检查麦克风"]};
export default function MicrophoneLifecycle(){useEffect(()=>{const root=document.querySelector<HTMLElement>(".honyaku"),bar=root?.querySelector<HTMLElement>(".language-bar");if(!root||!bar)return;const status=document.createElement("div");status.className="mic-lifecycle-status";status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.setAttribute("aria-atomic","true");const indicator=document.createElement("span");indicator.className="mic-lifecycle-indicator";indicator.setAttribute("aria-hidden","true");const text=document.createElement("span");status.append(indicator,text);bar.append(status);const sync=()=>{const raw=root.dataset.micPhase||"off",phase=Object.hasOwn(labels,raw)?raw:"error";root.dataset.micLifecycle=phase;const label=labels[phase][root.dataset.uiLanguage==="zh"?1:0];if(text.textContent!==label)text.textContent=label;};const observer=new MutationObserver(sync);observer.observe(root,{attributes:true,attributeFilter:["data-mic-phase","data-ui-language"]});sync();return()=>{observer.disconnect();status.remove();delete root.dataset.micLifecycle;};},[]);return <style>{`
.honyaku.honyaku .language-bar{padding-bottom:90px}
.honyaku.honyaku .mic-lifecycle-status{position:absolute;z-index:20;left:12px;right:12px;bottom:12px;display:flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:8px 12px;border:1px solid #94b6c8;border-radius:12px;background:#07131f;color:#edf8ff;font-size:14px;line-height:1.5;text-align:center;pointer-events:none}
.mic-lifecycle-indicator{flex:none;width:12px;height:12px;border-radius:50%;background:#8293a0;transition:background .2s,box-shadow .2s}
.honyaku[data-mic-lifecycle=starting] .mic-lifecycle-indicator{background:#efcf83;animation:mic-ready-pulse 1s ease-in-out infinite alternate}
.honyaku:is([data-mic-lifecycle=listening],[data-mic-lifecycle=speech]) .mic-lifecycle-indicator{background:#82f1c5;box-shadow:0 0 12px #82f1c5}
.honyaku:is([data-mic-lifecycle=ending],[data-mic-lifecycle=stopping]) .mic-lifecycle-indicator{background:#ffc46b}
.honyaku[data-mic-lifecycle=error] .mic-lifecycle-indicator{background:#ff9b96}
.honyaku.honyaku[data-mic-lifecycle] .voice-router-core--landscape .voice-garden>canvas{transform-origin:center;transition:transform .7s ease-in-out,opacity .7s ease-in-out;transform:scale(1)!important;opacity:1!important}
.honyaku.honyaku[data-mic-lifecycle=starting] .voice-router-core--landscape .voice-garden>canvas{transform:scale(.35)!important;opacity:.35!important}
.honyaku.honyaku[data-mic-lifecycle=ending] .voice-router-core--landscape .voice-garden>canvas{transform:rotate(90deg) scale(.75)!important;opacity:.8!important}
.honyaku.honyaku[data-mic-lifecycle=stopping] .voice-router-core--landscape .voice-garden>canvas{transform:rotate(360deg) scale(.15)!important;opacity:.2!important}
.honyaku.honyaku:is([data-mic-lifecycle=off],[data-mic-lifecycle=stopped],[data-mic-lifecycle=error]) .voice-router-core--landscape .voice-garden>canvas{transform:rotate(540deg) scale(.01)!important;opacity:0!important}
@keyframes mic-ready-pulse{from{opacity:.35}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.honyaku.honyaku[data-mic-lifecycle] .voice-router-core--landscape .voice-garden>canvas{transition:none;transform:none!important}.mic-lifecycle-indicator{animation:none!important;transition:none}}
`}</style>;}
