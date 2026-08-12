import { NextResponse } from "next/server";
import { SentinelAlert } from "@/lib/mail-sentinel";

declare global {
  var mailSentinelAlerts: SentinelAlert[] | undefined;
}

export async function GET() {
  return NextResponse.json({ alerts: global.mailSentinelAlerts ?? [] });
}
