"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import "./secretary-presence.css";

const MESSAGES = [
  "お任せください。",
  "そのまま話して大丈夫です。",
  "意味を変えずに、自然に届けます。",
  "ことばの向こうまで、整えます。",
];

export default function SecretaryPresence() {
  const pathname = usePathname();
  const visible = pathname === "/" || pathname.startsWith("/secret-room/");
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % MESSAGES.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, [visible]);

  const status = useMemo(() => MESSAGES[index], [index]);
  if (!visible) return null;

  return (
    <aside className={`secretary-presence ${open ? "is-open" : "is-closed"}`} aria-label="翻訳王 秘書">
      <button
        className="secretary-core"
        type="button"
        aria-label={open ? "秘書を小さくする" : "秘書を開く"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="secretary-halo halo-a" />
        <span className="secretary-halo halo-b" />
        <span className="secretary-pulse" />
        <Sparkles size={20} strokeWidth={1.5} />
      </button>

      <div className="secretary-card" aria-live="polite">
        <div className="secretary-kicker">
          <i />
          SECRETARY
          <span>翻訳王</span>
        </div>
        <p key={status}>{status}</p>
        <div className="secretary-wave" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i />
        </div>
      </div>
    </aside>
  );
}
