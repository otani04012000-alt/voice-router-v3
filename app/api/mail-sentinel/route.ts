import { NextRequest, NextResponse } from "next/server";
import { createSentinelAlert, SentinelAlert } from "@/lib/mail-sentinel";

declare global {
  var mailSentinelAlerts: SentinelAlert[] | undefined;
}

const alerts = global.mailSentinelAlerts ?? (global.mailSentinelAlerts = []);

export async function POST(request: NextRequest) {
  const secret = process.env.MAIL_SENTINEL_SECRET;
  if (!secret || request.headers.get("x-mail-sentinel-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  if (typeof payload.from !== "string" || typeof payload.subject !== "string" || typeof payload.body !== "string") {
    return NextResponse.json({ error: "from, subject and body are required" }, { status: 400 });
  }

  const alert = createSentinelAlert({
    from: payload.from,
    subject: payload.subject,
    body: payload.body,
    receivedAt: typeof payload.receivedAt === "string" ? payload.receivedAt : new Date().toISOString(),
  });

  if (!alert) return NextResponse.json({ accepted: false, reason: "Sender is not watched" });
  alerts.unshift(alert);
  alerts.splice(20);
  return NextResponse.json({ accepted: true, alert });
}
