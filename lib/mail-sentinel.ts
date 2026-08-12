export type MailSource = "bitget" | "immigration" | "other";

export type SentinelAlert = {
  id: string;
  source: MailSource;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  nextAction: string;
};

export function classifyMailSource(from: string): MailSource {
  const value = from.toLowerCase();
  if (value.includes("support.web3@bitget.com")) return "bitget";
  if (value.includes("@imi.gov.my")) return "immigration";
  return "other";
}

export function nextActionFor(source: MailSource): string {
  if (source === "bitget") return "カード再連携・再発行の可否と、求められる識別情報を確認";
  if (source === "immigration") return "出国可否・必要窓口・支払い方法を最優先で確認";
  return "監視対象外";
}

export function createSentinelAlert(input: Omit<SentinelAlert, "id" | "source" | "nextAction">): SentinelAlert | null {
  const source = classifyMailSource(input.from);
  if (source === "other") return null;
  return { ...input, id: crypto.randomUUID(), source, nextAction: nextActionFor(source) };
}
