"use client";
export default function HokusaiUpgrade(){return <style>{`
.honyaku.honyaku .input-card>.hokusai-live-canvas,
.honyaku.honyaku .energy-field{display:none!important}
.honyaku.honyaku .input-card::before{visibility:visible!important;animation:none!important;transition:none!important}
.honyaku.honyaku .input-card::after,
.honyaku.honyaku .energy-rail::before,
.honyaku.honyaku .energy-rail::after{animation:none!important;transition:none!important}
.honyaku.honyaku[data-mic-phase]:not([data-mic-phase=off]):not([data-mic-phase=error]),
.honyaku.honyaku[data-mic-phase]:not([data-mic-phase=off]):not([data-mic-phase=error]) *,
.honyaku.honyaku[data-mic-phase]:not([data-mic-phase=off]):not([data-mic-phase=error]) *::before,
.honyaku.honyaku[data-mic-phase]:not([data-mic-phase=off]):not([data-mic-phase=error]) *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important;box-shadow:none!important;text-shadow:none!important;mix-blend-mode:normal!important;animation:none!important;transition:none!important}
`}</style>;}
