"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { resolveUiLanguage, translateUi, type UiLanguage } from "./ui-language";
import "./secretary-presence.css";

type SecretaryDetail = {
  uiLanguage?: UiLanguage;
  message: string;
  label: string;
  action: "focus" | "join" | "read" | "notifications";
  badge?: number;
  tone?: "idle" | "active" | "alert" | "error";
};

const INITIAL: SecretaryDetail = {
  message: "入力の準備ができています。",
  label: "入力へ",
  action: "focus",
  tone: "idle",
};

export default function SecretaryPresence() {
  const pathname = usePathname();
  const visible = pathname === "/" || pathname.startsWith("/secret-room/");
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<SecretaryDetail>(INITIAL);

  useEffect(() => {
    if (!visible) return;
    // A direct Chinese invitation can load before the studio's first status event.
    try {
      const uiLanguage = resolveUiLanguage(new URLSearchParams(window.location.search), localStorage.getItem("honyaku.ui-language"), navigator.language);
      setStatus((current) => ({ ...current, uiLanguage }));
    } catch {}
    if (window.matchMedia("(max-width: 820px)").matches) setOpen(false);
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<SecretaryDetail>).detail;
      if (detail?.message && detail?.action) setStatus(detail);
    };
    window.addEventListener("honyaku:secretary-status", receive);
    return () =>
      window.removeEventListener("honyaku:secretary-status", receive);
  }, [visible]);

  const uiText = (value: string) => translateUi(status.uiLanguage || "ja", value);
  if (!visible) return null;

  return (
    <aside
      className={`secretary-presence ${open ? "is-open" : "is-closed"} tone-${status.tone || "idle"}`}
      aria-label={uiText("翻訳王 状態アシスタント")}
    >
      <button
        className="secretary-core"
        type="button"
        aria-label={
          open ? uiText("状態表示を小さくする") : `${uiText("状態表示を開く。")}${uiText(status.message)}`
        }
        onClick={() => setOpen((value) => !value)}
      >
        <span className="secretary-halo halo-a" />
        <span className="secretary-halo halo-b" />
        <span className="secretary-pulse" />
        <Sparkles size={20} strokeWidth={1.5} />
        {Boolean(status.badge) && (
          <strong className="secretary-badge">{status.badge}</strong>
        )}
      </button>

      {!open && <p className="secretary-summary" role="status">{uiText(status.message)}</p>}
      <div className="secretary-card" aria-live="polite" aria-hidden={!open}>
        <div className="secretary-kicker">
          <i />
          {uiText("ことばの秘書")}
          <span>{uiText("状態")}</span>
        </div>
        <p key={status.message}>{uiText(status.message)}</p>
        <button
          type="button"
          className="secretary-action"
          tabIndex={open ? 0 : -1}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("honyaku:secretary-action", {
                detail: { action: status.action },
              }),
            )
          }
        >
          {uiText(status.label)}
          <ArrowRight size={13} />
        </button>
        <div className="secretary-wave" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </aside>
  );
}
