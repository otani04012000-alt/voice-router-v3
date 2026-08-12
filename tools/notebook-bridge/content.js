function clean(text) { return text.replace(/\n{3,}/g, "\n\n").trim(); }
function readNotebook() {
  const title = clean(document.querySelector("h1")?.innerText || document.title.replace(/\s*[-|].*$/, "") || "Gemini Notebook");
  const sourceNames = [...document.querySelectorAll("[role=listitem], [data-source-id]")]
    .map((node) => clean(node.innerText)).filter((text) => text && text.length < 260).slice(0, 100);
  const main = document.querySelector("main") || document.body;
  const text = clean(main.innerText || document.body.innerText || "");
  const uniqueSources = [...new Set(sourceNames)];
  const markdown = [
    `# ${title}`,
    "",
    `- 保存日時: ${new Date().toISOString()}`,
    `- 元URL: ${location.href}`,
    "## 表示テキスト",
    "",
    text,
    uniqueSources.length ? `\n## 画面から取得した候補ソース\n\n${uniqueSources.map((name) => `- ${name}`).join("\n")}` : ""
  ].join("\n");
  return { title, markdown, url: location.href };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "READ_NOTEBOOK") return;
  try { sendResponse({ ok: true, ...readNotebook() }); }
  catch (error) { sendResponse({ ok: false, error: String(error) }); }
  return true;
});
