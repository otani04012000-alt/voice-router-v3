// Run with QA_NODE_MODULES pointing to an installed playwright-core directory.
// The secret room syncs through Supabase Realtime, so run a local test-only
// Supabase (`supabase start`, needs Docker) and build against it first:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key> pnpm build
// Never build this test against a production Supabase project.
const { chromium } = require(
  process.env.QA_NODE_MODULES
    ? process.env.QA_NODE_MODULES + "/playwright-core"
    : "playwright-core",
);
const { spawn } = require("child_process");
const assert = require("assert/strict");
const fs = require("fs");
const cwd = require("path").resolve(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunkDir = require("path").join(cwd, ".next/static/chunks");
const bundled = fs
  .readdirSync(chunkDir, { recursive: true })
  .filter((f) => String(f).endsWith(".js"))
  .map((f) => fs.readFileSync(require("path").join(chunkDir, String(f)), "utf8"))
  .join("\n");
assert.match(
  bundled,
  /https?:\/\/(127\.0\.0\.1|localhost):54321/,
  "Build with NEXT_PUBLIC_SUPABASE_URL pointing to a local test Supabase.",
);
const log = fs.openSync("/tmp/studio-runtime.log", "w");
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3320",
    "--hostname",
    "127.0.0.1",
  ],
  { cwd, stdio: ["ignore", log, log] },
);
(async () => {
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if (
          (
            await fetch("http://127.0.0.1:3320", {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        )
          break;
      } catch {}
      await sleep(100);
    }
    browser = await chromium.launch({
      ...(process.env.QA_CHROMIUM
        ? { executablePath: process.env.QA_CHROMIUM }
        : {}),
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1120 },
      permissions: ["notifications"],
    });
    const errors = [];
    context.setDefaultTimeout(12000);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    let fail = false;
    await context.route("**/api/translate", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: { provider: "openrouter", toneAvailable: true, maxText: 600 },
        });
      if (fail)
        return route.fulfill({
          status: 502,
          json: { error: "テスト用の接続エラー" },
        });
      const data = route.request().postDataJSON();
      await sleep(100);
      return route.fulfill({
        json: {
          original: data.text,
          translated:
            data.target === "vi"
              ? "Xin chào. Rất vui được gặp bạn."
              : data.target === "km"
                ? "សួស្តី"
                : data.target === "zh"
                  ? "你好。很高兴认识你。"
                : "こんにちは。会えてうれしいです。",
          source: data.source,
          target: data.target,
          provider: "openrouter",
          toneApplied: true,
        },
      });
    });
    await page.goto("http://127.0.0.1:3320");
    await page.getByLabel("翻訳する文章").waitFor();
    await page.getByLabel("相手の言語").selectOption("vi");
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page
        .getByRole("button", { name: "翻訳する", exact: true })
        .isDisabled(),
      true,
    );
    await page.screenshot({ path: "/tmp/studio-desktop.png", fullPage: true });
    await page
      .getByLabel("翻訳する文章")
      .fill("こんにちは。会えてうれしいです。");
    await page.getByRole("button", { name: "翻訳する", exact: true }).click();
    await page.locator(".translated-text").waitFor();
    assert.match(
      await page.locator(".translated-text").textContent(),
      /Xin chào/,
    );
    console.log("Translation rendered");
    await page.getByRole("button", { name: "戻し訳", exact: true }).click();
    await page.locator(".back-translation").waitFor();
    await page.getByLabel("フレーズを保存", { exact: true }).click();
    await page
      .getByRole("button", { name: "相手に見せる", exact: true })
      .click();
    await page.locator(".presentation-dialog[open]").waitFor();
    await page.getByLabel("相手に向けて180度回転").click();
    assert.match(
      await page.locator(".presentation-dialog").getAttribute("class"),
      /flipped/,
    );
    await page.getByRole("button", { name: "返事をする · Reply" }).click();
    assert.match(
      await page.locator(".speaker-switch .selected").textContent(),
      /相手/,
    );
    await page
      .getByRole("button", { name: "あなたが話す", exact: true })
      .click();
    await page.getByLabel("設定", { exact: true }).click();
    await page.getByLabel("会話をこの端末に残す").check();
    await page.getByLabel("閉じる", { exact: true }).click();
    await page.reload();
    await page.locator(".conversation-turn").waitFor();
    await page.getByLabel("フレーズ帳", { exact: true }).click();
    await page.locator(".saved-phrase").waitFor();
    await page.getByLabel("閉じる", { exact: true }).click();
    await page.getByLabel("相手の言語").selectOption("zh");
    await page.getByLabel("翻訳する文章").fill("こんにちは");
    await page.getByRole("button", { name: "翻訳する", exact: true }).click();
    await page.locator(".translated-text").getByText(/你好/).waitFor();
    await page.getByLabel("相手の言語").selectOption("vi");
    fail = true;
    await page.getByLabel("翻訳する文章").fill("失敗しても消えない文章");
    await page.getByRole("button", { name: "翻訳する", exact: true }).click();
    await page.getByRole("status").getByText("テスト用の接続エラー").waitFor();
    assert.equal(
      await page.getByLabel("翻訳する文章").inputValue(),
      "失敗しても消えない文章",
    );
    fail = false;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByLabel("翻訳する文章").waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({ path: "/tmp/studio-mobile.png", fullPage: true });
    console.log(
      "PASS: desktop/mobile layout, Japanese/Chinese UI translation, reverse check, saved phrases, presentation/rotation/reply, opt-in history, error retention",
    );
    await page.setViewportSize({ width: 1440, height: 1120 });
    // A fresh room per run so presence left over from earlier runs never counts.
    const room = `http://127.0.0.1:3320/secret-room/qa-${Date.now()}`;
    await page.goto(`${room}?from=ja&to=vi`);
    await page.getByLabel("あなたの表示名").fill("大谷");
    await page.getByRole("button", { name: "この名前で入室" }).click();
    await page.getByText("1人の部屋", { exact: true }).waitFor();
    await page.locator(".room-member").filter({ hasText: "大谷" }).waitFor();
    const guest = await context.newPage();
    guest.on("pageerror", (e) => errors.push(e.message));
    await guest.goto(`${room}?from=vi&to=ja`);
    await guest.getByLabel("Tên hiển thị của bạn").fill("リン");
    await guest.getByRole("button", { name: "Vào phòng với tên này" }).click();
    await page.getByText("2人の部屋", { exact: true }).waitFor();
    await guest.getByText("Phòng 2 người", { exact: true }).waitFor();
    await page.getByRole("status").getByText("リンさんが入室しました。").waitFor();
    await page.locator(".room-member").filter({ hasText: "リン" }).waitFor();
    await guest.locator(".room-member").filter({ hasText: "大谷" }).waitFor();
    await page
      .getByLabel("翻訳する文章")
      .fill("こんにちは。会えてうれしいです。");
    await page.getByRole("button", { name: "翻訳する", exact: true }).click();
    await page.locator(".translated-text").waitFor();
    await page.getByRole("button", { name: "相手に送る", exact: true }).click();
    await page.getByRole("button", { name: "中継済み", exact: true }).waitFor();
    await guest.locator(".conversation-turn").waitFor();
    assert.match(
      await guest.locator(".turn-translation").textContent(),
      /Xin chào/,
    );
    await guest.getByLabel("Văn bản cần dịch").fill("Xin chào");
    await guest
      .getByRole("button", { name: "Dịch", exact: true })
      .click();
    await guest.locator(".translated-text").waitFor();
    await guest
      .getByRole("button", { name: "Gửi cho người kia", exact: true })
      .click();
    await page.locator(".conversation-turn.partner").waitFor();
    await page.getByRole("button", { name: "新着 1件を見る" }).click();
    assert.equal(await page.locator(".room-new-message").count(), 0);
    await page.screenshot({ path: "/tmp/studio-room.png", fullPage: true });
    assert.equal(await guest.getByLabel("Ngôn ngữ của bạn").inputValue(), "vi");
    await guest.reload();
    await guest.getByText("Phòng 2 người", { exact: true }).waitFor();
    assert.equal(await guest.locator(".conversation-turn").count(), 0);
    await guest.close();
    await page.getByText("1人の部屋", { exact: true }).waitFor();
    await page.getByRole("status").getByText("リンさんが退室しました。").waitFor();
    assert.equal(
      await page.locator(".room-member").filter({ hasText: "リン" }).count(),
      0,
    );
    console.log(
      "PASS: room entry, member count 1→2→1, named participants, join/leave notices, new-message notification/mark as read, Japanese/Vietnamese reply, Supabase Realtime relay/ack, guest-language setup, ephemeral room history",
    );
    assert.deepEqual(errors, []);
    console.log("PASS: no browser runtime exceptions");
  } finally {
    if (browser) await browser.close();
    app.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
