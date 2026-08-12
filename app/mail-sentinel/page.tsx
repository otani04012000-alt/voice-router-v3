"use client";

import { useEffect, useState } from "react";

type Alert = {
  id: string;
  source: "bitget" | "immigration";
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  nextAction: string;
};

function soundAlarm() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  [660, 880, 660].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + index * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.22 + 0.19);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + index * 0.22);
    oscillator.stop(context.currentTime + index * 0.22 + 0.2);
  });
}

function announce(alert: Alert) {
  soundAlarm();
  const label = alert.source === "immigration" ? "移民局" : "Bitget Wallet";
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`${label}から返信`, { body: `${alert.subject}\n次の一手：${alert.nextAction}` });
  }
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(`${label}から返信。${alert.nextAction}`));
  }
}

export default function MailSentinelPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [permission, setPermission] = useState("default");
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    const poll = async () => {
      const response = await fetch("/api/mail-sentinel/latest", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setAlerts(data.alerts);
      const newest = data.alerts[0] as Alert | undefined;
      if (newest && seen && newest.id !== seen) announce(newest);
      if (newest) setSeen(newest.id);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 10000);
    return () => window.clearInterval(timer);
  }, [seen]);

  const allowNotifications = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const testAlert = () => announce({
    id: "test", source: "immigration", from: "webmaster@imi.gov.my",
    subject: "テスト警報", body: "", receivedAt: new Date().toISOString(),
    nextAction: "通知と音声が聞こえたら、この画面は準備完了",
  });

  return <main style={{ minHeight: "100vh", padding: "32px", background: "#081411", color: "#e8f3eb", fontFamily: "system-ui" }}>
    <p style={{ color: "#8ad6ae", letterSpacing: ".12em" }}>MAIL SENTINEL / 返信監視</p>
    <h1 style={{ fontSize: "clamp(32px,6vw,64px)", margin: "8px 0" }}>メールが来たら、声で呼ぶ。</h1>
    <p style={{ color: "#b9c9bd", maxWidth: 680 }}>監視対象：Bitget Wallet（support.web3@bitget.com）／マレーシア移民局（@imi.gov.my）</p>
    <section style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "28px 0" }}>
      <button onClick={allowNotifications} style={{ padding: "14px 18px", borderRadius: 12, border: 0, background: "#8ad6ae", color: "#07100c", fontWeight: 800 }}>通知を許可する（現在：{permission}）</button>
      <button onClick={testAlert} style={{ padding: "14px 18px", borderRadius: 12, border: "1px solid #8ad6ae", background: "transparent", color: "#e8f3eb", fontWeight: 800 }}>声＋通知をテスト</button>
    </section>
    <p style={{ color: "#f2c66c" }}>Gmail中継は未接続。接続後、この画面は10秒ごとに新着警報を確認する。</p>
    <section style={{ display: "grid", gap: 12, marginTop: 24 }}>
      {alerts.length === 0 && <div style={{ padding: 20, border: "1px solid #2b4e3c", borderRadius: 14 }}>まだ警報はない。</div>}
      {alerts.map((alert) => <article key={alert.id} style={{ padding: 20, border: "1px solid #47725a", borderRadius: 14, background: "#0d2018" }}>
        <strong>{alert.source === "immigration" ? "移民局" : "Bitget Wallet"}</strong>
        <h2 style={{ marginBottom: 4 }}>{alert.subject}</h2>
        <p style={{ color: "#b9c9bd" }}>{alert.nextAction}</p>
        <small>{new Date(alert.receivedAt).toLocaleString("ja-JP")}</small>
      </article>)}
    </section>
  </main>;
}
