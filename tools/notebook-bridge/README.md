# WORLD TREE Notebook Bridge

Gemini Notebookを開いた状態で、表示中の本文をMarkdownにし、GitHubへ保存するChrome拡張です。

## 使い方

1. Chromeで `chrome://extensions` を開く。
2. 開発者モードをオンにする。
3. 「パッケージ化されていない拡張機能を読み込む」から、このフォルダを選ぶ。
4. Gemini Notebookを開き、拡張アイコンを押す。
5. GitHubの細かい権限のトークン（対象リポジトリのContents: Read and writeだけ）を入力する。
6. 「今のNotebookを保存」を押す。

トークンはChromeのこの端末内の拡張ストレージにのみ保存されます。不要になったら拡張機能を削除するか、トークン欄を空にして保存してください。
